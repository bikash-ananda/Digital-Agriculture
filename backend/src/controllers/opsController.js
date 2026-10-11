const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { logAudit } = require('../utils/audit');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
const isSuper = (req) => req.user.roles.includes('super_admin');
const FW_DIR = process.env.FIRMWARE_DIR || (process.platform === 'win32' ? path.join(__dirname, '..', '..', 'uploads', 'firmware') : '/opt/greenhouse/firmware');
const BASE = (process.env.PUBLIC_BASE_URL || 'http://localhost').replace(/\/+$/, '');
const parse = (v) => { if (v === null || v === undefined) return null; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch (e) { return null; } };
const int = (v) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : null);
const js = (o) => { if (!o || typeof o !== 'object') return null; const s = JSON.stringify(o); return s.length <= 6000 ? s : null; };
const bad = (res, message) => res.status(400).json({ message });

// ---------------- device side (same contract as the old Python service) ----------------
exports.deviceAuth = async (req, res, next) => {
  try {
    const id = req.get('x-device-id');
    const token = req.get('x-device-token');
    if (!id || !token || req.params.opsId !== id) return res.status(401).json({ message: 'Device credentials required' });
    const [rows] = await db.query(
      'SELECT od.id, od.ops_id, od.device_id, od.token_hash, d.growing_unit_id FROM ops_devices od JOIN iot_devices d ON d.id = od.device_id WHERE od.ops_id = ? LIMIT 1', [id]);
    const row = rows[0];
    const given = Buffer.from(sha256(token), 'hex');
    const stored = Buffer.from(row ? row.token_hash : '0'.repeat(64), 'hex');
    if (!row || stored.length !== given.length || !crypto.timingSafeEqual(stored, given)) return res.status(401).json({ message: 'Invalid device credentials' });
    req.ops = row;
    next();
  } catch (e) { next(e); }
};

async function openAlert(ops, severity, message) {
  const [ex] = await db.query("SELECT id FROM alerts WHERE device_id = ? AND message = ? AND status IN ('open','acknowledged') LIMIT 1", [ops.device_id, message]);
  if (!ex.length) await db.query('INSERT INTO alerts (device_id, growing_unit_id, severity, message) VALUES (?, ?, ?, ?)', [ops.device_id, ops.growing_unit_id, severity, message]);
}

async function healthAlerts(ops, h, sensors) {
  const active = [];
  const add = (sev, msg) => active.push([sev, `Device health: ${msg}`]);
  const rssi = Number(h.rssi);
  if (Number.isFinite(rssi) && rssi < -85) add('warning', `weak Wi-Fi signal (${rssi} dBm)`);
  if (['panic', 'task_wdt', 'int_wdt', 'wdt', 'brownout'].includes(String(h.reset_reason)) && Number(h.uptime_s) < 86400) add('warning', `last restart was caused by ${h.reset_reason}`);
  if (/^(failed|rolled_back)/.test(String(h.ota_state || ''))) add('warning', `firmware update ${h.ota_state}`);
  if (sensors && typeof sensors === 'object') {
    Object.entries(sensors).forEach(([k, v]) => {
      if ((v && typeof v === 'object' && v.ok === false) || (/_ok$/.test(k) && v === false)) add('warning', `sensor "${k.replace(/_ok$/, '')}" reports a fault`);
    });
  }
  const [prev] = await db.query('SELECT wifi_reconnects, http_fails FROM ops_health WHERE ops_device_id = ? AND recorded_at <= NOW() - INTERVAL 55 MINUTE ORDER BY id DESC LIMIT 1', [ops.id]);
  if (prev[0]) {
    if (Number(h.wifi_reconnects) - Number(prev[0].wifi_reconnects) >= 5) add('warning', 'Wi-Fi keeps reconnecting (5 or more in the last hour)');
    if (Number(h.http_fails) - Number(prev[0].http_fails) >= 10) add('warning', 'many failed server requests in the last hour');
  }
  for (const [sev, msg] of active) await openAlert(ops, sev, msg);
  if (active.length) await db.query("UPDATE alerts SET status = 'resolved', resolved_at = NOW() WHERE device_id = ? AND status IN ('open','acknowledged') AND message LIKE 'Device health:%' AND message NOT IN (?)", [ops.device_id, active.map((a) => a[1])]);
  else await db.query("UPDATE alerts SET status = 'resolved', resolved_at = NOW() WHERE device_id = ? AND status IN ('open','acknowledged') AND message LIKE 'Device health:%'", [ops.device_id]);
}

async function housekeeping(opsId) {
  await db.query("UPDATE ops_commands SET status = 'expired', message = 'Not collected in time' WHERE ops_device_id = ? AND status = 'queued' AND expires_at < NOW()", [opsId]);
  await db.query("UPDATE ops_commands SET status = 'error', message = 'No acknowledgement from the device' WHERE ops_device_id = ? AND status = 'sent' AND sent_at < NOW() - INTERVAL 15 MINUTE", [opsId]);
  await db.query("UPDATE ops_commands SET payload = JSON_SET(payload, '$.password', '[removed]') WHERE ops_device_id = ? AND type = 'wifi_add' AND status IN ('expired','error','cancelled') AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.password')) <> '[removed]'", [opsId]);
}

exports.telemetry = async (req, res, next) => {
  try {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const h = b.health && typeof b.health === 'object' ? b.health : {};
    await db.query('INSERT INTO ops_health SET ?', [{
      ops_device_id: req.ops.id, uptime_s: int(h.uptime_s), rssi: int(h.rssi), ip: str(h.ip, 45), ssid: str(h.ssid, 64), heap_free: int(h.heap_free), heap_min: int(h.heap_min),
      reset_reason: str(h.reset_reason, 30), wifi_reconnects: int(h.wifi_reconnects), http_fails: int(h.http_fails), last_error: str(h.last_error, 255), ota_state: str(h.ota_state, 80),
      image_validated: h.image_validated === undefined || h.image_validated === null ? null : (h.image_validated ? 1 : 0),
      pump_total_s_irrigation: int(h.pump_total_s_irrigation), pump_total_s_misting: int(h.pump_total_s_misting), firmware: str(b.firmware || h.firmware, 30),
      sensors: js(b.sensors), relays: js(b.relays), config: js(b.config), wifi_saved: js(h.wifi_saved)
    }]);
    await db.query('UPDATE ops_devices SET last_telemetry_at = NOW(), config_mirror = COALESCE(?, config_mirror) WHERE id = ?', [js(b.config), req.ops.id]);
    await healthAlerts(req.ops, h, b.sensors);
    if (Math.random() < 0.01) await db.query('DELETE FROM ops_health WHERE recorded_at < NOW() - INTERVAL 30 DAY');
    res.json({ ok: true, server_time: new Date().toISOString() });
  } catch (e) { next(e); }
};

exports.poll = async (req, res, next) => {
  try {
    await db.query('UPDATE ops_devices SET last_poll_at = NOW() WHERE id = ?', [req.ops.id]);
    await housekeeping(req.ops.id);
    const [rows] = await db.query("SELECT id, type, payload FROM ops_commands WHERE ops_device_id = ? AND status = 'queued' ORDER BY id LIMIT 5", [req.ops.id]);
    if (rows.length) await db.query("UPDATE ops_commands SET status = 'sent', sent_at = NOW() WHERE id IN (?)", [rows.map((r) => r.id)]);
    const [m] = await db.query('SELECT config_mirror FROM ops_devices WHERE id = ?', [req.ops.id]);
    res.json({ commands: rows.map((r) => ({ id: r.id, type: r.type, ...(parse(r.payload) || {}) })), config: parse(m[0] && m[0].config_mirror) || {} });
  } catch (e) { next(e); }
};

exports.ack = async (req, res, next) => {
  try {
    const { id, status, msg } = req.body || {};
    if (!Number.isInteger(Number(id)) || !['ok', 'rejected', 'error', 'skipped', 'started'].includes(status)) return bad(res, 'id and a valid status are required');
    const [r] = await db.query('UPDATE ops_commands SET status = ?, message = ?, acked_at = NOW() WHERE id = ? AND ops_device_id = ?', [status, str(msg, 255), Number(id), req.ops.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Command not found' });
    await db.query("UPDATE ops_commands SET payload = JSON_SET(payload, '$.password', '[removed]') WHERE id = ? AND type = 'wifi_add' AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.password')) <> '[removed]'", [Number(id)]);
    res.json({ ok: true });
  } catch (e) { next(e); }
};

// ---------------- staff side (JWT + permissions) ----------------
async function loadOps(req, opsId) {
  const sc = isSuper(req) ? { sql: '', params: [] } : { sql: ' AND s.organization_id = ?', params: [req.user.organization_id] };
  const [r] = await db.query(
    `SELECT od.*, d.device_code, d.growing_unit_id FROM ops_devices od JOIN iot_devices d ON d.id = od.device_id JOIN sites s ON s.id = d.site_id WHERE od.ops_id = ?${sc.sql}`, [opsId, ...sc.params]);
  return r[0];
}

exports.listDevices = async (req, res, next) => {
  try {
    const sc = isSuper(req) ? { sql: '', params: [] } : { sql: ' AND s.organization_id = ?', params: [req.user.organization_id] };
    const [rows] = await db.query(
      `SELECT od.id, od.ops_id, od.last_telemetry_at, od.last_poll_at, d.id AS device_id, d.device_code, d.growing_unit_id, gu.name_en AS unit_name,
              TIMESTAMPDIFF(SECOND, GREATEST(COALESCE(od.last_telemetry_at, '1970-01-02'), COALESCE(od.last_poll_at, '1970-01-02')), NOW()) AS age_s
         FROM ops_devices od JOIN iot_devices d ON d.id = od.device_id JOIN sites s ON s.id = d.site_id LEFT JOIN growing_units gu ON gu.id = d.growing_unit_id
        WHERE 1 = 1${sc.sql} ORDER BY od.id`, sc.params);
    res.json(rows.map((r) => ({ ...r, online: r.age_s !== null && r.age_s < 180 })));
  } catch (e) { next(e); }
};

exports.health = async (req, res, next) => {
  try {
    const ops = await loadOps(req, req.params.opsId);
    if (!ops) return res.status(404).json({ message: 'Device not found' });
    const hours = Math.min(Math.max(parseInt(req.query.hours, 10) || 24, 1), 168);
    const [rows] = await db.query(
      'SELECT UNIX_TIMESTAMP(recorded_at) AS ts, rssi, heap_free, uptime_s, wifi_reconnects, http_fails, reset_reason FROM ops_health WHERE ops_device_id = ? AND recorded_at >= NOW() - INTERVAL ? HOUR ORDER BY recorded_at', [ops.id, hours]);
    const [latest] = await db.query('SELECT *, UNIX_TIMESTAMP(recorded_at) AS ts, TIMESTAMPDIFF(SECOND, recorded_at, NOW()) AS age_s FROM ops_health WHERE ops_device_id = ? ORDER BY id DESC LIMIT 1', [ops.id]);
    const l = latest[0] || null;
    if (l) ['sensors', 'relays', 'config', 'wifi_saved'].forEach((k) => { l[k] = parse(l[k]); });
    const resets = [];
    rows.forEach((r, i) => { if (i > 0 && r.uptime_s !== null && rows[i - 1].uptime_s !== null && r.uptime_s < rows[i - 1].uptime_s) resets.push({ ts: Number(r.ts), reason: r.reset_reason }); });
    res.json({ ops_id: ops.ops_id, hours, latest: l, series: rows.map((r) => ({ ...r, ts: Number(r.ts) })), resets });
  } catch (e) { next(e); }
};

exports.commands = async (req, res, next) => {
  try {
    const ops = await loadOps(req, req.params.opsId);
    if (!ops) return res.status(404).json({ message: 'Device not found' });
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const [rows] = await db.query(
      'SELECT c.id, c.type, c.payload, c.status, c.message, c.created_at, c.acked_at, u.username FROM ops_commands c LEFT JOIN users u ON u.id = c.created_by WHERE c.ops_device_id = ? ORDER BY c.id DESC LIMIT ?', [ops.id, limit]);
    res.json(rows.map((r) => {
      const p = parse(r.payload) || {};
      return { id: r.id, type: r.type, status: r.status, message: r.message, created_at: r.created_at, acked_at: r.acked_at, by: r.username,
        summary: r.type === 'wifi_add' || r.type === 'wifi_remove' ? { ssid: p.ssid } : r.type === 'ota' ? { version: p.version, force: !!p.force } : r.type === 'set_config' ? p.config : r.type === 'calibrate_soil' ? { point: p.point } : {} };
    }));
  } catch (e) { next(e); }
};

const LIMITS = { readings_s: [5, 600], health_s: [30, 3600], poll_s: [5, 120], soil_dry: [0, 4095], soil_wet: [0, 4095], max_irrigation_s: [10, 3600], max_misting_s: [10, 1800], min_off_s: [0, 3600], temp_offset_c: [-10, 10], hum_offset_pct: [-20, 20], lux_scale: [0.1, 10] };

exports.queue = async (req, res, next) => {
  try {
    const ops = await loadOps(req, req.params.opsId);
    if (!ops) return res.status(404).json({ message: 'Device not found' });
    const b = req.body || {};
    let payload = {};
    let ttl = 30;
    switch (b.type) {
      case 'wifi_add': {
        const ssid = typeof b.ssid === 'string' ? b.ssid : '';
        const pw = typeof b.password === 'string' ? b.password : '';
        if (ssid.length < 1 || ssid.length > 32 || /[\u0000-\u001f]/.test(ssid)) return bad(res, 'Network name must be 1 to 32 characters');
        if (pw !== '' && (pw.length < 8 || pw.length > 63)) return bad(res, 'Wi-Fi password must be 8 to 63 characters (or empty for an open network)');
        payload = { ssid, password: pw };
        ttl = 15;
        break;
      }
      case 'wifi_remove': {
        const [h] = await db.query('SELECT wifi_saved FROM ops_health WHERE ops_device_id = ? ORDER BY id DESC LIMIT 1', [ops.id]);
        const saved = (h[0] && parse(h[0].wifi_saved)) || [];
        if (!saved.includes(b.ssid)) return bad(res, 'That network is not in the device’s saved list');
        if (saved.length <= 1 && b.confirm_last !== true) return bad(res, 'This is the only saved network. Removing it can leave the device offline.');
        payload = { ssid: b.ssid };
        break;
      }
      case 'set_config': {
        const c = b.config;
        if (!c || typeof c !== 'object' || !Object.keys(c).length) return bad(res, 'No settings supplied');
        const out = {};
        for (const [k, v] of Object.entries(c)) {
          if (!LIMITS[k]) return bad(res, `Unknown setting "${k}"`);
          const n = Number(v);
          if (!Number.isFinite(n) || n < LIMITS[k][0] || n > LIMITS[k][1]) return bad(res, `${k} must be between ${LIMITS[k][0]} and ${LIMITS[k][1]}`);
          out[k] = n;
        }
        if (out.soil_dry !== undefined && out.soil_wet !== undefined && Math.abs(out.soil_dry - out.soil_wet) < 200) return bad(res, 'Soil dry and wet values must differ by at least 200');
        payload = { config: out };
        break;
      }
      case 'calibrate_soil':
        if (!['dry', 'wet'].includes(b.point)) return bad(res, 'point must be dry or wet');
        payload = { point: b.point };
        break;
      case 'read_now':
      case 'reboot':
        payload = {};
        break;
      case 'ota': {
        if (!req.user.permissions.includes('settings.update')) return res.status(403).json({ message: 'Only a super administrator can start a firmware update' });
        const [img] = await db.query('SELECT * FROM firmware_images WHERE id = ?', [b.image_id]);
        if (!img[0]) return bad(res, 'Choose an uploaded firmware version');
        const [h] = await db.query('SELECT TIMESTAMPDIFF(SECOND, recorded_at, NOW()) AS age FROM ops_health WHERE ops_device_id = ? ORDER BY id DESC LIMIT 1', [ops.id]);
        if (!h[0] || h[0].age > 300) return res.status(409).json({ message: 'The device has not reported in the last 5 minutes, so an update would be unsafe' });
        const [open] = await db.query("SELECT id FROM ops_commands WHERE ops_device_id = ? AND type = 'ota' AND status IN ('queued','sent','started')", [ops.id]);
        if (open.length) return res.status(409).json({ message: 'A firmware update is already in progress' });
        payload = { version: img[0].version, url: `${BASE}/fw/${img[0].filename}`, md5: img[0].md5, force: b.force === true };
        ttl = 60;
        break;
      }
      default:
        return bad(res, 'Unknown command type');
    }
    const [r] = await db.query("INSERT INTO ops_commands (ops_device_id, type, payload, created_by, expires_at) VALUES (?, ?, ?, ?, NOW() + INTERVAL ? MINUTE)", [ops.id, b.type, JSON.stringify(payload), req.user.id, ttl]);
    const safe = b.type === 'wifi_add' ? { ssid: payload.ssid } : b.type === 'ota' ? { version: payload.version, force: payload.force } : payload;
    await logAudit(req.user.id, `ops_${b.type}`, 'ops_device', ops.id, safe, req);
    res.status(201).json({ id: r.insertId, status: 'queued' });
  } catch (e) { next(e); }
};

exports.cancel = async (req, res, next) => {
  try {
    const sc = isSuper(req) ? { sql: '', params: [] } : { sql: ' AND s.organization_id = ?', params: [req.user.organization_id] };
    const [r] = await db.query(
      `SELECT c.id FROM ops_commands c JOIN ops_devices od ON od.id = c.ops_device_id JOIN iot_devices d ON d.id = od.device_id JOIN sites s ON s.id = d.site_id WHERE c.id = ? AND c.status = 'queued'${sc.sql}`, [req.params.id, ...sc.params]);
    if (!r[0]) return res.status(404).json({ message: 'Queued command not found' });
    await db.query("UPDATE ops_commands SET status = 'cancelled', payload = IF(type = 'wifi_add', JSON_SET(payload, '$.password', '[removed]'), payload) WHERE id = ?", [r[0].id]);
    res.json({ message: 'Cancelled' });
  } catch (e) { next(e); }
};

exports.firmwareList = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT f.id, f.version, f.size_bytes, f.md5, f.notes, f.uploaded_at, u.username FROM firmware_images f LEFT JOIN users u ON u.id = f.uploaded_by ORDER BY f.id DESC LIMIT 30');
    res.json(rows);
  } catch (e) { next(e); }
};

exports.firmwareUpload = async (req, res, next) => {
  try {
    const f = req.file;
    const version = String((req.body && req.body.version) || '').trim();
    if (!f) return bad(res, 'Choose a .bin file');
    if (!/^\d+\.\d+\.\d+(-[A-Za-z0-9.]+)?$/.test(version)) return bad(res, 'Version must look like 1.1.2');
    if (f.buffer.length < 100000 || f.buffer[0] !== 0xe9) return bad(res, 'This does not look like an ESP32 firmware image');
    const [ex] = await db.query('SELECT id FROM firmware_images WHERE version = ?', [version]);
    if (ex.length) return res.status(409).json({ message: `Version ${version} already exists. Use a new version number.` });
    const filename = `greenhouse-${version}.bin`;
    try {
      fs.mkdirSync(FW_DIR, { recursive: true });
      fs.writeFileSync(path.join(FW_DIR, filename), f.buffer, { mode: 0o640 });
    } catch (e) {
      return res.status(500).json({ message: `Cannot write to ${FW_DIR}. Make the folder writable for the API service user.` });
    }
    const [r] = await db.query('INSERT INTO firmware_images SET ?', [{ version, filename, size_bytes: f.buffer.length, md5: md5(f.buffer), sha256: sha256(f.buffer), notes: str(req.body.notes, 255), uploaded_by: req.user.id }]);
    await logAudit(req.user.id, 'firmware_upload', 'firmware', r.insertId, { version, size: f.buffer.length }, req);
    res.status(201).json({ id: r.insertId, version, md5: md5(f.buffer), size_bytes: f.buffer.length });
  } catch (e) { next(e); }
};

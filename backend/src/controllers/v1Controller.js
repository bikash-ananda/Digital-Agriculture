const db = require('../config/db');

const { indexSensors, resolveTelemetrySensor, toSensorTypeKey } = require('../utils/sensorMapping');

const UPLOAD_SECONDS = Math.min(Math.max(parseInt(process.env.DEVICE_UPLOAD_SECONDS, 10) || 30, 10), 300);
const STALE_SECONDS = 180;
const stamp = (ms) => new Date(ms).toISOString().slice(0, 23).replace('T', ' ');
const isSuper = (req) => req.user.roles.includes('super_admin');

function sameDevice(req, res) {
  if (req.params.code !== req.device.code) { res.status(403).json({ success: false, message: 'Device code does not match the authenticated device' }); return false; }
  return true;
}

async function actuatorsOf(deviceId) {
  const [rows] = await db.query('SELECT id, actuator_type, name, current_state, last_state_at, status, max_runtime_seconds FROM actuators WHERE device_id = ? ORDER BY id', [deviceId]);
  const seen = {};
  return rows.map((a) => { seen[a.actuator_type] = (seen[a.actuator_type] || 0) + 1; return { ...a, key: seen[a.actuator_type] === 1 ? a.actuator_type : `${a.actuator_type}_${seen[a.actuator_type]}` }; });
}

async function setState(actuatorId, state, source, commandId) {
  const [rows] = await db.query('SELECT current_state FROM actuators WHERE id = ?', [actuatorId]);
  const prev = rows[0] ? rows[0].current_state : 'unknown';
  await db.query('UPDATE actuators SET current_state = ?, last_state_at = NOW() WHERE id = ?', [state, actuatorId]);
  if (state === 'on' && prev !== 'on') {
    await db.query("INSERT INTO actuator_events (actuator_id, command_id, state, trigger_source, started_at) VALUES (?, ?, 'on', ?, NOW())", [actuatorId, commandId || null, source || 'device']);
  }
  if (state === 'off') {
    await db.query("UPDATE actuator_events SET ended_at = NOW(), duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW()) WHERE actuator_id = ? AND state = 'on' AND ended_at IS NULL", [actuatorId]);
  }
}

async function housekeeping(deviceId) {
  await db.query(
    `UPDATE actuator_commands c JOIN actuators a ON a.id = c.actuator_id SET c.status = 'expired'
      WHERE a.device_id = ? AND c.status = 'pending' AND c.expires_at IS NOT NULL AND c.expires_at < NOW()`, [deviceId]);
  await db.query(
    `UPDATE actuator_commands c JOIN actuators a ON a.id = c.actuator_id SET c.status = 'failed', c.error_message = 'No acknowledgement from device'
      WHERE a.device_id = ? AND c.status = 'sent' AND c.sent_at < (NOW() - INTERVAL 2 MINUTE)`, [deviceId]);
}

exports.telemetry = async (req, res, next) => {
  try {
    const b = req.body;
    const dev = req.device;
    if (b.device_id !== dev.code) return res.status(403).json({ success: false, message: 'device_id does not match the authenticated device' });
    const now = Date.now();
    const st = b.status || {};
    let boot = Number.isSafeInteger(Number(st.boot_count)) && Number(st.boot_count) >= 0 ? Number(st.boot_count) : 0;
    const seq = b.sequence === undefined ? null : Number(b.sequence);
    const [dr] = await db.query(
      `SELECT d.last_sequence, d.last_boot_count,
              (SELECT t.uptime_s FROM device_telemetry t WHERE t.device_id = d.id ORDER BY t.id DESC LIMIT 1) AS last_uptime_s
         FROM iot_devices d WHERE d.id = ?`, [dev.id]);
    const last = dr[0] || {};
    let missed = 0;
    let duplicate = false;
    let rebootDetected = false;
    if (seq !== null && last.last_sequence !== null && last.last_sequence !== undefined && Number(last.last_boot_count) === boot) {
      if (seq <= Number(last.last_sequence)) {
        const uptime = st.uptime_seconds === null || st.uptime_seconds === undefined ? Number.NaN : Number(st.uptime_seconds);
        const previousUptime = last.last_uptime_s === null || last.last_uptime_s === undefined ? Number.NaN : Number(last.last_uptime_s);
        const uptimeReset = Number.isFinite(uptime) && Number.isFinite(previousUptime) && uptime + 2 < previousUptime;
        rebootDetected = seq < Number(last.last_sequence) || uptimeReset;
        if (!rebootDetected) duplicate = true;
      }
      else missed = seq - Number(last.last_sequence) - 1;
    }
    const base = { success: true, device_id: dev.code, received_at: new Date(now).toISOString(), server_time: new Date(now).toISOString(), next_upload_seconds: UPLOAD_SECONDS };

    if (duplicate) {
      await db.query("UPDATE iot_devices SET last_seen_at = NOW(), status = 'online', duplicate_messages = duplicate_messages + 1 WHERE id = ?", [dev.id]);
      return res.json({ ...base, duplicate: true, stored: 0 });
    }

    let recMs = now;
    let adjusted = false;
    if (b.timestamp) {
      const t = Date.parse(b.timestamp);
      if (Number.isFinite(t) && t <= now + 5 * 60000 && t >= now - 24 * 3600000) recMs = t;
      else adjusted = true;
    }

    const [sens] = await db.query(
      "SELECT id, name, sensor_type, channel_key, calibration_offset, calibration_scale, min_valid, max_valid FROM sensors WHERE device_id = ? AND status <> 'disabled' ORDER BY id", [dev.id]);
    const byKey = indexSensors(sens);
    const [openRows] = await db.query("SELECT sensor_id FROM alerts WHERE device_id = ? AND status IN ('open','acknowledged') AND message LIKE 'Sensor fault:%'", [dev.id]);
    const open = new Set(openRows.map((r) => r.sensor_id));
    const raise = async (s) => {
      if (open.has(s.id)) return;
      open.add(s.id);
      await db.query("INSERT INTO alerts (device_id, sensor_id, growing_unit_id, severity, message) VALUES (?, ?, ?, 'warning', ?)", [dev.id, s.id, dev.growing_unit_id, `Sensor fault: ${s.name}`]);
    };

    let stored = 0;
    const rejected = [];
    const faults = [];
    for (const [name, raw] of Object.entries(b.sensors || {})) {
      const normalized = toSensorTypeKey(name);
      const s = resolveTelemetrySensor(name, byKey);
      if (!s) { rejected.push({ name, reason: normalized ? 'sensor not registered on this device' : 'unknown sensor name' }); continue; }
      if (raw === null) { faults.push(name); await raise(s); continue; }
      const value = Number(raw) * s.calibration_scale + s.calibration_offset;
      const bad = !Number.isFinite(value) || (s.min_valid !== null && value < s.min_valid) || (s.max_valid !== null && value > s.max_valid);
      if (bad) { rejected.push({ name, reason: 'out of valid range' }); faults.push(name); await raise(s); continue; }
      await db.query('INSERT INTO sensor_readings (sensor_id, value, recorded_at) VALUES (?, ?, ?)', [s.id, value, stamp(recMs)]);
      await db.query('UPDATE sensors SET sensor_value = ?, last_sensor_reading_at = ? WHERE id = ? AND (last_sensor_reading_at IS NULL OR last_sensor_reading_at <= ?)', [value, stamp(recMs).slice(0, 19), s.id, stamp(recMs).slice(0, 19)]);
      if (open.has(s.id)) {
        open.delete(s.id);
        await db.query("UPDATE alerts SET status = 'resolved', resolved_at = NOW() WHERE device_id = ? AND sensor_id = ? AND status IN ('open','acknowledged') AND message LIKE 'Sensor fault:%'", [dev.id, s.id]);
      }
      stored++;
    }

    if (b.actuators) {
      const acts = await actuatorsOf(dev.id);
      for (const a of acts) {
        if (typeof b.actuators[a.key] !== 'boolean') continue;
        const reported = b.actuators[a.key] ? 'on' : 'off';
        const recent = a.last_state_at && now - new Date(a.last_state_at).getTime() < 20000;
        if (reported !== a.current_state && !recent) await setState(a.id, reported, 'device');
      }
    }

    await db.query(
      `UPDATE iot_devices SET last_seen_at = NOW(), status = 'online', ip_address = ?, firmware_version = COALESCE(?, firmware_version),
              last_sequence = ?, last_boot_count = ?, missed_messages = missed_messages + ? WHERE id = ?`,
      [(req.ip || '').slice(0, 45), st.firmware || null, seq, boot, missed, dev.id]);

    const [recent] = await db.query('SELECT id FROM device_telemetry WHERE device_id = ? AND recorded_at > (NOW() - INTERVAL 5 MINUTE) LIMIT 1', [dev.id]);
    if (!recent.length || Number(last.last_boot_count) !== boot || rebootDetected) {
      await db.query('INSERT INTO device_telemetry SET ?', [{
        device_id: dev.id, rssi: Number.isInteger(st.rssi) ? st.rssi : null, uptime_s: Number.isInteger(st.uptime_seconds) ? st.uptime_seconds : null,
        free_heap: Number.isInteger(st.free_heap) ? st.free_heap : null, reset_reason: typeof st.reset_reason === 'string' ? st.reset_reason.slice(0, 30) : null,
        firmware: typeof st.firmware === 'string' ? st.firmware.slice(0, 30) : null, sensor_errors: Number.isInteger(st.sensor_errors) ? st.sensor_errors : null,
        wifi_reconnects: Number.isInteger(st.wifi_reconnects) ? st.wifi_reconnects : null, http_failures: Number.isInteger(st.http_failures) ? st.http_failures : null
      }]);
    }
    res.json({ ...base, stored, rejected, faults, missed, timestamp_adjusted: adjusted });
  } catch (e) { next(e); }
};

exports.nextCommand = async (req, res, next) => {
  try {
    if (!sameDevice(req, res)) return;
    await housekeeping(req.device.id);
    const [rows] = await db.query(
      `SELECT c.id, c.actuator_id, c.command, c.duration_seconds, c.expires_at, a.max_runtime_seconds
         FROM actuator_commands c JOIN actuators a ON a.id = c.actuator_id
        WHERE a.device_id = ? AND c.status = 'pending' AND a.status = 'active' ORDER BY c.id LIMIT 1`, [req.device.id]);
    const c = rows[0];
    if (!c) return res.json({ success: true, command: null });
    await db.query("UPDATE actuator_commands SET status = 'sent', sent_at = NOW() WHERE id = ?", [c.id]);
    const acts = await actuatorsOf(req.device.id);
    const a = acts.find((x) => x.id === c.actuator_id);
    const dur = c.command === 'on' ? Math.min(c.duration_seconds || c.max_runtime_seconds, c.max_runtime_seconds) : 0;
    res.json({ success: true, command: { id: c.id, actuator: a ? a.key : null, actuator_id: c.actuator_id, action: c.command, duration_seconds: dur, expires_at: c.expires_at } });
  } catch (e) { next(e); }
};

exports.ackCommand = async (req, res, next) => {
  try {
    if (!sameDevice(req, res)) return;
    const { command_id: id, success, error } = req.body;
    const [rows] = await db.query(
      `SELECT c.id, c.actuator_id, c.command, c.source, c.status FROM actuator_commands c JOIN actuators a ON a.id = c.actuator_id WHERE c.id = ? AND a.device_id = ?`, [id, req.device.id]);
    const c = rows[0];
    if (!c) return res.status(404).json({ success: false, message: 'Command not found' });
    if (!['pending', 'sent'].includes(c.status)) return res.json({ success: true, message: 'Command was already closed' });
    if (success) {
      await db.query("UPDATE actuator_commands SET status = 'acknowledged', acknowledged_at = NOW() WHERE id = ?", [c.id]);
      await setState(c.actuator_id, c.command, c.source, c.id);
    } else {
      const msg = String(error || 'Device reported failure').slice(0, 255);
      await db.query("UPDATE actuator_commands SET status = 'failed', error_message = ? WHERE id = ?", [msg, c.id]);
      await db.query("INSERT INTO alerts (device_id, growing_unit_id, severity, message) VALUES (?, ?, 'critical', ?)", [req.device.id, req.device.growing_unit_id, `Actuator command failed on ${req.device.code}: ${msg}`]);
    }
    res.json({ success: true });
  } catch (e) { next(e); }
};

exports.deviceStatus = async (req, res, next) => {
  try {
    const sc = isSuper(req) ? { sql: '', params: [] } : { sql: ' AND s.organization_id = ?', params: [req.user.organization_id] };
    const [rows] = await db.query(
      `SELECT d.id, d.device_code, d.status, d.last_seen_at, d.firmware_version, d.last_sequence, d.last_boot_count, d.missed_messages, d.duplicate_messages,
              TIMESTAMPDIFF(SECOND, d.last_seen_at, NOW()) AS age_s
         FROM iot_devices d JOIN sites s ON s.id = d.site_id WHERE d.device_code = ?${sc.sql}`, [req.params.code, ...sc.params]);
    const d = rows[0];
    if (!d) return res.status(404).json({ message: 'Device not found' });
    const [sensors] = await db.query('SELECT id, name, sensor_type, channel_key, unit, status, sensor_value AS `last_value`, last_sensor_reading_at AS last_reading_at, TIMESTAMPDIFF(SECOND, last_sensor_reading_at, NOW()) AS age_s FROM sensors WHERE device_id = ? ORDER BY id', [d.id]);
    const acts = await actuatorsOf(d.id);
    const [[p]] = await db.query("SELECT COUNT(*) AS n FROM actuator_commands c JOIN actuators a ON a.id = c.actuator_id WHERE a.device_id = ? AND c.status IN ('pending','sent')", [d.id]);
    res.json({
      device_id: d.device_code, status: d.last_seen_at === null ? 'registered' : d.age_s > 300 ? 'offline' : 'online', last_seen_at: d.last_seen_at, age_seconds: d.age_s,
      stale: d.age_s === null || d.age_s > STALE_SECONDS, firmware: d.firmware_version, last_sequence: d.last_sequence, boot_count: d.last_boot_count,
      missed_messages: d.missed_messages, duplicate_messages: d.duplicate_messages, pending_commands: Number(p.n),
      sensors: sensors.map((s) => ({ key: s.channel_key || s.sensor_type, name: s.name, unit: s.unit, value: s.last_value, last_reading_at: s.last_reading_at, age_seconds: s.age_s, stale: s.age_s === null || s.age_s > STALE_SECONDS, status: s.status })),
      actuators: acts.map((a) => ({ key: a.key, name: a.name, state: a.current_state, status: a.status }))
    });
  } catch (e) { next(e); }
};

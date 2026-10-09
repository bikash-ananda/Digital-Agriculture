const db = require('../config/db');
const crypto = require('crypto');
const { logAudit } = require('../utils/audit');

const clean = (v) => (v === '' || v === undefined ? null : v);
const isSuper = (req) => req.user.roles.includes('super_admin');
const orgSql = (req, alias = 's') =>
  isSuper(req) ? { sql: '', params: [] } : { sql: ` AND ${alias}.organization_id = ?`, params: [req.user.organization_id] };
const pad = (n, w) => String(n).padStart(w, '0');
const tmp = () => `T-${crypto.randomBytes(8).toString('hex')}`;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const LIVE = `CASE WHEN d.status = 'disabled' THEN 'disabled'
  WHEN d.last_seen_at IS NULL THEN 'registered'
  WHEN d.last_seen_at < (NOW() - INTERVAL 5 MINUTE) THEN 'offline'
  ELSE 'online' END`;
const DEVICE_COLS = `d.id, d.uuid, d.device_code, d.site_id, d.growing_unit_id, d.device_type, d.firmware_version,
  d.ip_address, d.status, d.last_seen_at, d.installed_at, d.created_at, ${LIVE} AS live_status`;

async function findSite(req, id) {
  const sc = orgSql(req);
  const [rows] = await db.query(
    `SELECT s.*, ll.name_ne AS local_level_ne, ll.name_en AS local_level_en
       FROM sites s LEFT JOIN local_levels ll ON ll.id = s.local_level_id
      WHERE s.id = ?${sc.sql} LIMIT 1`, [id, ...sc.params]);
  return rows[0];
}

async function findDevice(req, id) {
  const sc = orgSql(req);
  const [rows] = await db.query(
    `SELECT ${DEVICE_COLS}, s.name_en AS site_name_en, s.name_ne AS site_name_ne,
            gu.name_en AS unit_name_en, gu.name_ne AS unit_name_ne
       FROM iot_devices d JOIN sites s ON s.id = d.site_id
       LEFT JOIN growing_units gu ON gu.id = d.growing_unit_id
      WHERE d.id = ?${sc.sql} LIMIT 1`, [id, ...sc.params]);
  return rows[0];
}

exports.listSites = async (req, res, next) => {
  try {
    const sc = orgSql(req);
    const [rows] = await db.query(
      `SELECT s.id, s.code, s.name_ne, s.name_en, s.site_type, s.address, s.latitude, s.longitude, s.status,
              ll.name_ne AS local_level_ne, ll.name_en AS local_level_en,
              (SELECT COUNT(*) FROM growing_units gu WHERE gu.site_id = s.id) AS unit_count,
              (SELECT COUNT(*) FROM iot_devices d WHERE d.site_id = s.id) AS device_count
         FROM sites s LEFT JOIN local_levels ll ON ll.id = s.local_level_id
        WHERE 1=1${sc.sql} ORDER BY s.id`, sc.params);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.getSite = async (req, res, next) => {
  try {
    const site = await findSite(req, req.params.id);
    if (!site) return res.status(404).json({ message: 'Site not found' });
    const [units] = await db.query(
      `SELECT gu.*, (SELECT COUNT(*) FROM iot_devices d WHERE d.growing_unit_id = gu.id) AS device_count
         FROM growing_units gu WHERE gu.site_id = ? ORDER BY gu.id`, [site.id]);
    const [devices] = await db.query(
      `SELECT ${DEVICE_COLS}, gu.name_en AS unit_name_en,
              (SELECT COUNT(*) FROM sensors x WHERE x.device_id = d.id) AS sensor_count,
              (SELECT COUNT(*) FROM actuators a WHERE a.device_id = d.id) AS actuator_count
         FROM iot_devices d LEFT JOIN growing_units gu ON gu.id = d.growing_unit_id
        WHERE d.site_id = ? ORDER BY d.id`, [site.id]);
    res.json({ site, units, devices });
  } catch (e) { next(e); }
};

exports.createSite = async (req, res, next) => {
  try {
    if (!req.user.organization_id) return res.status(400).json({ message: 'Your account is not linked to an organization' });
    const b = req.body;
    const [r] = await db.query('INSERT INTO sites SET ?', [{
      organization_id: req.user.organization_id, code: tmp(), name_en: b.name_en, name_ne: b.name_ne || b.name_en,
      site_type: b.site_type || 'demonstration', local_level_id: clean(b.local_level_id),
      address: clean(b.address), latitude: clean(b.latitude), longitude: clean(b.longitude)
    }]);
    const code = `SITE-${pad(r.insertId, 4)}`;
    await db.query('UPDATE sites SET code = ? WHERE id = ?', [code, r.insertId]);
    await logAudit(req.user.id, 'site_create', 'site', r.insertId, { code, name: b.name_en }, req);
    res.status(201).json({ id: r.insertId, code });
  } catch (e) { next(e); }
};

exports.createUnit = async (req, res, next) => {
  try {
    const site = await findSite(req, req.params.id);
    if (!site) return res.status(404).json({ message: 'Site not found' });
    const b = req.body;
    const [r] = await db.query('INSERT INTO growing_units SET ?', [{
      site_id: site.id, unit_type: b.unit_type, code: tmp(), name_en: b.name_en,
      name_ne: clean(b.name_ne), area_sqm: clean(b.area_sqm)
    }]);
    const code = `GU-${pad(r.insertId, 6)}`;
    await db.query('UPDATE growing_units SET code = ? WHERE id = ?', [code, r.insertId]);
    await logAudit(req.user.id, 'growing_unit_create', 'growing_unit', r.insertId, { site_id: site.id, code }, req);
    res.status(201).json({ id: r.insertId, code });
  } catch (e) { next(e); }
};

exports.createDevice = async (req, res, next) => {
  try {
    const site = await findSite(req, req.params.id);
    if (!site) return res.status(404).json({ message: 'Site not found' });
    const b = req.body;
    if (b.growing_unit_id) {
      const [u] = await db.query('SELECT id FROM growing_units WHERE id = ? AND site_id = ?', [b.growing_unit_id, site.id]);
      if (!u.length) return res.status(400).json({ message: 'Growing unit does not belong to this site' });
    }
    const apiKey = crypto.randomBytes(24).toString('hex');
    const [r] = await db.query('INSERT INTO iot_devices SET ?', [{
      uuid: crypto.randomUUID(), device_code: b.device_code, site_id: site.id,
      growing_unit_id: clean(b.growing_unit_id), device_type: b.device_type || 'esp32',
      api_key_hash: sha256(apiKey), installed_at: clean(b.installed_at)
    }]);
    await logAudit(req.user.id, 'device_create', 'iot_device', r.insertId, { device_code: b.device_code, site_id: site.id }, req);
    res.status(201).json({ id: r.insertId, device_code: b.device_code, api_key: apiKey });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Device code already exists' });
    next(e);
  }
};

exports.getDevice = async (req, res, next) => {
  try {
    const device = await findDevice(req, req.params.id);
    if (!device) return res.status(404).json({ message: 'Device not found' });
    const [sensors] = await db.query(
      `SELECT id, sensor_type, name, unit, model, status, sensor_value AS last_value, last_sensor_reading_at AS last_reading_at, min_valid, max_valid
         FROM sensors WHERE device_id = ? ORDER BY id`, [device.id]);
    const [actuators] = await db.query(
      `SELECT id, actuator_type, name, control_mode, current_state, max_runtime_seconds, status, last_state_at
         FROM actuators WHERE device_id = ? ORDER BY id`, [device.id]);
    res.json({ device, sensors, actuators });
  } catch (e) { next(e); }
};

exports.rotateKey = async (req, res, next) => {
  try {
    const device = await findDevice(req, req.params.id);
    if (!device) return res.status(404).json({ message: 'Device not found' });
    const apiKey = crypto.randomBytes(24).toString('hex');
    await db.query('UPDATE iot_devices SET api_key_hash = ? WHERE id = ?', [sha256(apiKey), device.id]);
    await logAudit(req.user.id, 'device_key_rotate', 'iot_device', device.id, { device_code: device.device_code }, req);
    res.json({ device_code: device.device_code, api_key: apiKey });
  } catch (e) { next(e); }
};

exports.addSensor = async (req, res, next) => {
  try {
    const device = await findDevice(req, req.params.id);
    if (!device) return res.status(404).json({ message: 'Device not found' });
    const b = req.body;
    const [r] = await db.query('INSERT INTO sensors SET ?', [{
      device_id: device.id, growing_unit_id: device.growing_unit_id, sensor_type: b.sensor_type, name: b.name,
      channel_key: clean(b.channel_key), unit: clean(b.unit), model: clean(b.model), min_valid: clean(b.min_valid), max_valid: clean(b.max_valid)
    }]);
    await logAudit(req.user.id, 'sensor_create', 'sensor', r.insertId, { device_id: device.id, type: b.sensor_type }, req);
    res.status(201).json({ id: r.insertId });
  } catch (e) { next(e); }
};

exports.addActuator = async (req, res, next) => {
  try {
    const device = await findDevice(req, req.params.id);
    if (!device) return res.status(404).json({ message: 'Device not found' });
    const b = req.body;
    const [r] = await db.query('INSERT INTO actuators SET ?', [{
      device_id: device.id, growing_unit_id: device.growing_unit_id, actuator_type: b.actuator_type,
      name: b.name, relay_channel: clean(b.relay_channel), gpio_pin: clean(b.gpio_pin), max_runtime_seconds: b.max_runtime_seconds || 900
    }]);
    await logAudit(req.user.id, 'actuator_create', 'actuator', r.insertId, { device_id: device.id, type: b.actuator_type }, req);
    res.status(201).json({ id: r.insertId });
  } catch (e) { next(e); }
};



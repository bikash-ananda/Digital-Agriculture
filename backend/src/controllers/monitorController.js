const db = require('../config/db');
const { logAudit } = require('../utils/audit');

const isSuper = (req) => req.user.roles.includes('super_admin');
const orgSql = (req, alias = 's') =>
  isSuper(req) ? { sql: '', params: [] } : { sql: ` AND ${alias}.organization_id = ?`, params: [req.user.organization_id] };
const LIVE = `CASE WHEN d.status = 'disabled' THEN 'disabled'
  WHEN d.last_seen_at IS NULL THEN 'registered'
  WHEN d.last_seen_at < (NOW() - INTERVAL 5 MINUTE) THEN 'offline'
  ELSE 'online' END`;

exports.live = async (req, res, next) => {
  try {
    const sc = orgSql(req);
    const [units] = await db.query(
      `SELECT gu.id, gu.code, gu.name_en, gu.name_ne, gu.unit_type, s.name_en AS site_name_en, s.name_ne AS site_name_ne
         FROM growing_units gu JOIN sites s ON s.id = gu.site_id WHERE gu.id = ?${sc.sql}`, [req.params.id, ...sc.params]);
    if (!units[0]) return res.status(404).json({ message: 'Growing unit not found' });
    const unitId = units[0].id;

    const [sensors] = await db.query(
      `SELECT id, device_id, sensor_type, name, unit, status, sensor_value AS last_value, last_sensor_reading_at AS last_reading_at, min_valid, max_valid,
              TIMESTAMPDIFF(SECOND, last_sensor_reading_at, NOW()) AS age_seconds
         FROM sensors WHERE growing_unit_id = ? ORDER BY id`, [unitId]);
    const [actuators] = await db.query(
      `SELECT id, device_id, actuator_type, name, control_mode, current_state, max_runtime_seconds, status, last_state_at
         FROM actuators WHERE growing_unit_id = ? ORDER BY id`, [unitId]);
    const [devices] = await db.query(
      `SELECT d.id, d.device_code, d.last_seen_at, ${LIVE} AS live_status FROM iot_devices d WHERE d.growing_unit_id = ? ORDER BY d.id`, [unitId]);
    const [[al]] = await db.query("SELECT COUNT(*) AS n FROM alerts WHERE growing_unit_id = ? AND status = 'open'", [unitId]);

    res.json({ unit: units[0], sensors, actuators, devices, open_alerts: al.n, server_time: new Date().toISOString() });
  } catch (e) { next(e); }
};

exports.history = async (req, res, next) => {
  try {
    const sc = orgSql(req);
    const [rows] = await db.query(
      `SELECT se.id, se.name, se.unit, se.sensor_type
         FROM sensors se JOIN iot_devices d ON d.id = se.device_id JOIN sites s ON s.id = d.site_id
        WHERE se.id = ?${sc.sql}`, [req.params.id, ...sc.params]);
    const sensor = rows[0];
    if (!sensor) return res.status(404).json({ message: 'Sensor not found' });

    const hasFrom = Boolean(req.query.from);
    const hasTo = Boolean(req.query.to);
    if (hasFrom !== hasTo) return res.status(400).json({ message: 'Both from and to dates are required' });

    let hours = Math.min(Math.max(parseInt(req.query.hours, 10) || 24, 1), 720);
    let rangeSql;
    let rangeParams = [];
    let fromIso = null;
    let toIso = null;
    if (hasFrom && hasTo) {
      const from = new Date(req.query.from);
      const requestedTo = new Date(req.query.to);
      const now = new Date();
      if (!Number.isFinite(from.getTime()) || !Number.isFinite(requestedTo.getTime()) || from >= requestedTo || from > now) {
        return res.status(400).json({ message: 'The custom date range is invalid' });
      }
      const to = requestedTo > now ? now : requestedTo;
      const spanMs = to.getTime() - from.getTime();
      if (spanMs <= 0 || spanMs > 720 * 60 * 60 * 1000) {
        return res.status(400).json({ message: 'Custom date ranges must be 30 days or less' });
      }
      hours = Math.max(1, Math.ceil(spanMs / 3600000));
      const sqlDate = (date) => date.toISOString().slice(0, 19).replace('T', ' ');
      fromIso = from.toISOString();
      toIso = to.toISOString();
      rangeSql = 'recorded_at >= ? AND recorded_at < ?';
      rangeParams = [sqlDate(from), sqlDate(to)];
    } else {
      rangeSql = `recorded_at >= (NOW() - INTERVAL ${hours} HOUR)`;
    }

    const bucketSeconds = Math.max(60, Math.ceil((hours * 3600) / 240 / 60) * 60);
    const [points] = await db.query(
      `SELECT FROM_UNIXTIME(b * ?) AS t, AVG(value) AS avg, MIN(value) AS min, MAX(value) AS max, COUNT(*) AS n
         FROM (SELECT FLOOR(UNIX_TIMESTAMP(recorded_at) / ?) AS b, value
                 FROM sensor_readings WHERE sensor_id = ? AND ${rangeSql}) x
        GROUP BY b ORDER BY b`, [bucketSeconds, bucketSeconds, sensor.id, ...rangeParams]);
    res.json({ sensor, hours, from: fromIso, to: toIso, bucket_seconds: bucketSeconds, points });
  } catch (e) { next(e); }
};
async function findActuator(req, id) {
  const sc = orgSql(req);
  const [rows] = await db.query(
    `SELECT a.*, d.device_code, ${LIVE} AS live_status
       FROM actuators a JOIN iot_devices d ON d.id = a.device_id JOIN sites s ON s.id = d.site_id
      WHERE a.id = ?${sc.sql}`, [id, ...sc.params]);
  return rows[0];
}

exports.sendCommand = async (req, res, next) => {
  try {
    const a = await findActuator(req, req.params.id);
    if (!a) return res.status(404).json({ message: 'Actuator not found' });
    if (a.status !== 'active') return res.status(409).json({ message: 'Actuator is not active' });
    if (a.live_status !== 'online') return res.status(409).json({ message: 'Device is offline. Command not sent.' });

    const command = req.body.command;
    const duration = command === 'on'
      ? Math.min(parseInt(req.body.duration_seconds, 10) || a.max_runtime_seconds, a.max_runtime_seconds) : null;

    await db.query("UPDATE actuator_commands SET status = 'cancelled' WHERE actuator_id = ? AND status = 'pending'", [a.id]);
    const [r] = await db.query(
      `INSERT INTO actuator_commands (actuator_id, command, source, requested_by, duration_seconds, status, expires_at)
       VALUES (?, ?, 'manual', ?, ?, 'pending', NOW() + INTERVAL 5 MINUTE)`,
      [a.id, command, req.user.id, duration]);
    await logAudit(req.user.id, 'actuator_command', 'actuator', a.id, { command, duration, device: a.device_code }, req);
    res.status(201).json({ id: r.insertId, status: 'pending', command, duration_seconds: duration });
  } catch (e) { next(e); }
};

exports.commandStatus = async (req, res, next) => {
  try {
    const sc = orgSql(req);
    const [rows] = await db.query(
      `SELECT c.id, c.actuator_id, c.command, c.status, c.duration_seconds, c.requested_at, c.sent_at, c.acknowledged_at, c.error_message
         FROM actuator_commands c JOIN actuators a ON a.id = c.actuator_id
         JOIN iot_devices d ON d.id = a.device_id JOIN sites s ON s.id = d.site_id
        WHERE c.id = ?${sc.sql}`, [req.params.id, ...sc.params]);
    if (!rows[0]) return res.status(404).json({ message: 'Command not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
};

exports.setMode = async (req, res, next) => {
  try {
    const a = await findActuator(req, req.params.id);
    if (!a) return res.status(404).json({ message: 'Actuator not found' });
    await db.query('UPDATE actuators SET control_mode = ? WHERE id = ?', [req.body.control_mode, a.id]);
    await logAudit(req.user.id, 'actuator_mode_change', 'actuator', a.id, { from: a.control_mode, to: req.body.control_mode }, req);
    res.json({ message: 'Mode updated' });
  } catch (e) { next(e); }
};

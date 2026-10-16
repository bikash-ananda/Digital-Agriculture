const db = require('../config/db');
const { analyzeUnit } = require('../services/analysisService');
const { logAudit } = require('../utils/audit');
const {
  MAX_RAW_ROWS,
  MAX_SENSORS,
  makeCsv,
  makeWorkbook,
  resolveDateRange,
  sanitizeText
} = require('../services/greenhouseReport');

const organizationFilter = (req) => (req.user.roles.includes('super_admin')
  ? { sql: '', params: [] }
  : { sql: ' AND s.organization_id = ?', params: [req.user.organization_id] });

function timezoneIsValid(value) {
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(new Date()); return true; }
  catch { return false; }
}

async function createReport(req, res, next, format) {
  try {
    const scope = organizationFilter(req);
    const [units] = await db.query(
      `SELECT gu.id, gu.farm_id, gu.code, gu.name_en, gu.name_ne, gu.unit_type, gu.area_sqm,
              s.id AS site_id, s.code AS site_code, s.name_en AS site_name_en, s.name_ne AS site_name_ne,
              s.address AS site_address, s.latitude AS site_latitude, s.longitude AS site_longitude,
              f.name AS farm_name, f.area_sqm AS farm_area_sqm, f.address AS farm_address,
              COALESCE(f.latitude, s.latitude) AS latitude, COALESCE(f.longitude, s.longitude) AS longitude
         FROM growing_units gu JOIN sites s ON s.id = gu.site_id
         LEFT JOIN farms f ON f.id = gu.farm_id
        WHERE gu.id = ?${scope.sql}`,
      [req.params.id, ...scope.params]
    );
    const unit = units[0];
    if (!unit) return res.status(404).json({ message: 'Growing unit not found' });

    const suppliedIds = String(req.query.sensor_ids || '').split(',').filter(Boolean).map((id) => Number(id));
    const sensorIds = [...new Set(suppliedIds)];
    if (!sensorIds.length || sensorIds.length !== suppliedIds.length || sensorIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
      return res.status(400).json({ message: 'Choose one or more sensors for this report' });
    }
    if (sensorIds.length > MAX_SENSORS) {
      return res.status(400).json({ message: `Choose no more than ${MAX_SENSORS} sensors per report` });
    }
    const [sensors] = await db.query(
      `SELECT se.id, se.device_id, se.sensor_type, se.name, se.unit, se.status, se.min_valid, se.max_valid,
              se.calibration_offset, se.calibration_scale, d.device_code
         FROM sensors se JOIN iot_devices d ON d.id = se.device_id
        WHERE se.growing_unit_id = ? AND se.id IN (?) AND se.status <> 'disabled' ORDER BY se.id`,
      [unit.id, sensorIds]
    );
    if (sensors.length !== sensorIds.length) {
      return res.status(400).json({ message: 'One or more selected sensors are unavailable for this growing unit' });
    }
    const metricUnits = new Set(sensors.map((sensor) => `${sensor.sensor_type}|${sensor.unit || ''}`));
    if (metricUnits.size !== 1) {
      return res.status(400).json({ message: 'Select sensors with the same metric and unit' });
    }

    const timeZone = String(req.query.time_zone || 'Asia/Kathmandu');
    if (timeZone.length > 64 || !timezoneIsValid(timeZone)) {
      return res.status(400).json({ message: 'The selected time zone is invalid' });
    }
    let range;
    try {
      range = resolveDateRange({ from: req.query.from, to: req.query.to, hours: req.query.hours });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const [[countRow]] = await db.query(
      'SELECT COUNT(*) AS row_count FROM sensor_readings WHERE sensor_id IN (?) AND recorded_at >= ? AND recorded_at < ?',
      [sensorIds, range.startSql, range.endSql]
    );
    const rowCount = Number(countRow.row_count || 0);
    if (rowCount > MAX_RAW_ROWS) {
      return res.status(413).json({ message: `This period contains more than ${MAX_RAW_ROWS.toLocaleString()} readings. Shorten the date range or select fewer sensors.` });
    }

    const [readings] = rowCount ? await db.query(
      `SELECT id, sensor_id, value, recorded_at FROM sensor_readings
        WHERE sensor_id IN (?) AND recorded_at >= ? AND recorded_at < ?
        ORDER BY recorded_at, sensor_id, id LIMIT ?`,
      [sensorIds, range.startSql, range.endSql, MAX_RAW_ROWS + 1]
    ) : [[]];
    if (readings.length > MAX_RAW_ROWS) {
      return res.status(413).json({ message: `This period contains more than ${MAX_RAW_ROWS.toLocaleString()} readings. Shorten the date range or select fewer sensors.` });
    }
    const [[commandRows], [eventRows]] = await Promise.all([
      db.query(
        `SELECT c.id, c.actuator_id, a.name AS actuator_name, c.command, c.duration_seconds,
                c.source, c.status, c.error_message, c.requested_at, c.acknowledged_at, u.username
           FROM actuator_commands c JOIN actuators a ON a.id = c.actuator_id
           LEFT JOIN users u ON u.id = c.requested_by
          WHERE a.growing_unit_id = ? AND c.requested_at >= ? AND c.requested_at < ?
          ORDER BY c.requested_at, c.id`,
        [unit.id, range.startSql, range.endSql]
      ),
      db.query(
        `SELECT e.id, e.actuator_id, a.name AS actuator_name, e.state, e.trigger_source,
                e.started_at, e.ended_at,
                COALESCE(e.duration_seconds, TIMESTAMPDIFF(SECOND, e.started_at, COALESCE(e.ended_at, NOW()))) AS duration_seconds
           FROM actuator_events e JOIN actuators a ON a.id = e.actuator_id
          WHERE a.growing_unit_id = ? AND e.started_at < ? AND COALESCE(e.ended_at, NOW()) >= ?
          ORDER BY e.started_at, e.id`,
        [unit.id, range.endSql, range.startSql]
      )
    ]);

    let analysis = null;
    try { analysis = await analyzeUnit(unit.id); }
    catch (error) { console.warn('[greenhouse report crop analysis unavailable]', error.message); }
    let tasks = [];
    if (analysis?.cycle?.id) {
      [tasks] = await db.query(
        `SELECT t.title, t.due_on, t.priority, t.status, u.username AS created_by_name
           FROM crop_tasks t LEFT JOIN users u ON u.id = t.created_by
          WHERE t.cycle_id = ? ORDER BY t.due_on IS NULL, t.due_on, t.id`,
        [analysis.cycle.id]
      ).catch(() => [[]]);
    }

    const generatedAt = new Date();
    const intervalMinutes = Number(req.query.interval_minutes) || 0;
    const buffer = format === 'csv'
      ? makeCsv({ unit, sensors, readings, range: { start: range.start, end: range.end }, timeZone })
      : await makeWorkbook({
        unit, sensors, readings, commands: commandRows, events: eventRows, analysis, tasks,
        range: { start: range.start, end: range.end }, timeZone, generatedAt, intervalMinutes
      });
    const filenamePart = sanitizeText(unit.code || `unit-${unit.id}`).replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60) || `unit-${unit.id}`;
    const extension = format === 'csv' ? 'csv' : 'xlsx';
    const filename = `smart-farming-${filenamePart}-${range.start.toISOString().slice(0, 10)}-to-${range.end.toISOString().slice(0, 10)}.${extension}`;
    await logAudit(req.user.id, 'greenhouse_report_export', 'growing_unit', unit.id, {
      sensor_ids: sensorIds,
      from: range.start.toISOString(),
      to: range.end.toISOString(),
      timezone: timeZone,
      format,
      row_count: readings.length
    }, req);
    res.set({
      'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, no-store'
    });
    return res.status(200).send(buffer);
  } catch (error) {
    return next(error);
  }
}

exports.download = (req, res, next) => createReport(req, res, next, 'xlsx');
exports.downloadCsv = (req, res, next) => createReport(req, res, next, 'csv');

const db = require('../config/db');
const { logAudit } = require('../utils/audit');
const S = require('../services/dataCenterService');
const ST = require('../services/stats');
const { METRICS, KEYS } = require('../services/researchMetrics');
const { localDate, addDays } = require('../services/rollupService');

const isSuper = (req) => req.user.roles.includes('super_admin');
const orgSql = (req, col = 's.organization_id') => (isSuper(req) ? { sql: '', params: [] } : { sql: ` AND ${col} = ?`, params: [req.user.organization_id] });
const notFound = (res, what) => res.status(404).json({ message: `${what} not found` });
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const parseIds = (v, max = 10) => [...new Set(String(v || '').split(',').map((x) => parseInt(x, 10)).filter((x) => Number.isInteger(x) && x > 0))].slice(0, max);
const num = (v) => (v === null || v === undefined ? null : Number(v));

function range(req, defDays = 30, maxDays = 730) {
  const to = isDay(req.query.to) ? req.query.to : localDate(0);
  const from = isDay(req.query.from) ? req.query.from : addDays(to, -(defDays - 1));
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 + 1;
  if (span < 1) return { error: 'The start date must not be after the end date' };
  if (span > maxDays) return { error: `The date range can be at most ${maxDays} days` };
  return { from, to, span };
}

async function allowedUnits(req, ids) {
  if (!ids.length) return [];
  const sc = orgSql(req);
  const [rows] = await db.query(
    `SELECT gu.id, gu.code, gu.name_en, gu.name_ne, gu.is_simulated, gu.farm_id FROM growing_units gu JOIN sites s ON s.id = gu.site_id
       LEFT JOIN farms fm ON fm.id = gu.farm_id LEFT JOIN farmers f ON f.id = fm.farmer_id
      WHERE gu.id IN (?) AND (gu.farm_id IS NULL OR (f.consent_research = 1 AND f.verification_status = 'verified'))${sc.sql}`, [ids, ...sc.params]);
  return rows;
}

exports.metrics = (req, res) => res.json(Object.entries(METRICS).map(([key, v]) => ({ key, ...v })));

exports.storage = async (req, res, next) => {
  try {
    const [[dbSize]] = await db.query(
      `SELECT COALESCE(SUM(data_length + index_length), 0) AS bytes, COUNT(*) AS tables
         FROM information_schema.tables WHERE table_schema = DATABASE()`);
    const [[daily]] = await db.query('SELECT MIN(day) AS first_day, MAX(day) AS last_day, COUNT(*) AS rows FROM unit_daily');
    res.json({
      database_bytes: Number(dbSize.bytes), database_tables: Number(dbSize.tables),
      backup_limit_bytes: 5_000_000_000,
      daily_rollups: { first_day: daily.first_day, last_day: daily.last_day, rows: Number(daily.rows) },
      retention_plan: { raw_readings_days: 30, hourly_rollups_days: 62, daily_rollups_days: 730, automated_pruning: false },
      note: 'Database footprint is reported separately from compressed backup files. Google Weather API values are not part of the research archive.'
    });
  } catch (e) { next(e); }
};

exports.units = async (req, res, next) => {
  try {
    const sc = orgSql(req);
    const [rows] = await db.query(
      `SELECT gu.id, gu.code, gu.name_en, gu.name_ne, gu.unit_type, gu.is_simulated, (gu.farm_id IS NOT NULL) AS farmer_owned, s.name_en AS site_en, s.name_ne AS site_ne,
              (SELECT MIN(d.day) FROM unit_daily d WHERE d.growing_unit_id = gu.id) AS first_day,
              (SELECT MAX(d.day) FROM unit_daily d WHERE d.growing_unit_id = gu.id) AS last_day,
              (SELECT COUNT(*) FROM unit_daily d WHERE d.growing_unit_id = gu.id) AS days,
              (SELECT c.name_en FROM crop_cycles cc JOIN crops c ON c.id = cc.crop_id WHERE cc.growing_unit_id = gu.id AND cc.status = 'active' ORDER BY cc.id DESC LIMIT 1) AS crop_en
         FROM growing_units gu JOIN sites s ON s.id = gu.site_id LEFT JOIN farms fm ON fm.id = gu.farm_id LEFT JOIN farmers f ON f.id = fm.farmer_id
        WHERE (gu.farm_id IS NULL OR (f.consent_research = 1 AND f.verification_status = 'verified'))${sc.sql} ORDER BY gu.is_simulated, gu.id`, sc.params);
    res.json(rows.map((r) => ({ ...r, days: Number(r.days), farmer_owned: !!r.farmer_owned, is_simulated: !!r.is_simulated })));
  } catch (e) { next(e); }
};

exports.daily = async (req, res, next) => {
  try {
    const rg = range(req, 30);
    if (rg.error) return res.status(400).json({ message: rg.error });
    const [u] = await allowedUnits(req, [Number(req.params.id)]);
    if (!u) return notFound(res, 'Growing unit');
    const [rows] = await db.query(`SELECT day, dap, ${KEYS.join(', ')} FROM unit_daily WHERE growing_unit_id = ? AND day BETWEEN ? AND ? ORDER BY day`, [u.id, rg.from, rg.to]);
    res.json({ unit: u, from: rg.from, to: rg.to, rows });
  } catch (e) { next(e); }
};

exports.hourly = async (req, res, next) => {
  try {
    const rg = range(req, 7, 62);
    if (rg.error) return res.status(400).json({ message: rg.error });
    const [u] = await allowedUnits(req, [Number(req.params.id)]);
    if (!u) return notFound(res, 'Growing unit');
    const [rows] = await db.query(
      `SELECT DATE_FORMAT(h.hour_local, '%Y-%m-%d %H:00') AS hour_local, SUM(h.v_avg * h.n) / SUM(h.n) AS v_avg, MIN(h.v_min) AS v_min, MAX(h.v_max) AS v_max, SUM(h.n) AS n
         FROM sensor_hourly h JOIN sensors s ON s.id = h.sensor_id
        WHERE s.growing_unit_id = ? AND s.sensor_type = ? AND h.hour_local >= ? AND h.hour_local < ? GROUP BY h.hour_local ORDER BY h.hour_local`,
      [u.id, req.query.type, `${rg.from} 00:00:00`, `${addDays(rg.to, 1)} 00:00:00`]);
    res.json({ unit: u, type: req.query.type, rows: rows.map((r) => ({ ...r, v_avg: num(r.v_avg), v_min: num(r.v_min), v_max: num(r.v_max), n: Number(r.n) })) });
  } catch (e) { next(e); }
};

exports.summary = async (req, res, next) => {
  try {
    const rg = range(req, 30);
    if (rg.error) return res.status(400).json({ message: rg.error });
    const [u] = await allowedUnits(req, [Number(req.params.id)]);
    if (!u) return notFound(res, 'Growing unit');
    const [[m]] = await db.query(
      `SELECT COUNT(*) AS days, ${KEYS.map((k) => `AVG(${k}) AS ${k}`).join(', ')}, SUM(irrigation_min) AS irrigation_total_min, SUM(gdd) AS gdd_total, SUM(dli) AS dli_total
         FROM unit_daily WHERE growing_unit_id = ? AND day BETWEEN ? AND ?`, [u.id, rg.from, rg.to]);
    const [sens] = await db.query(
      `SELECT s.id, s.name, s.sensor_type, s.unit, s.status, s.calibration_offset, s.calibration_scale,
              (SELECT MAX(c.performed_at) FROM sensor_calibrations c WHERE c.sensor_id = s.id) AS last_calibrated,
              COUNT(d.day) AS days, ROUND(AVG(d.hours_covered) / 24 * 100) AS coverage, COALESCE(SUM(d.v_std = 0 AND d.n >= 30), 0) AS stuck_days
         FROM sensors s LEFT JOIN sensor_daily d ON d.sensor_id = s.id AND d.day BETWEEN ? AND ? AND d.day < ?
        WHERE s.growing_unit_id = ? GROUP BY s.id ORDER BY s.id`, [rg.from, rg.to, localDate(0), u.id]);
    const means = {};
    KEYS.forEach((k) => { means[k] = m[k] === null ? null : Math.round(Number(m[k]) * 1000) / 1000; });
    res.json({
      unit: u, from: rg.from, to: rg.to, days: Number(m.days), means,
      totals: { irrigation_min: num(m.irrigation_total_min), gdd: num(m.gdd_total), dli: num(m.dli_total) },
      sensors: sens.map((s) => ({ ...s, days: Number(s.days), coverage: s.coverage === null ? null : Number(s.coverage), stuck_days: Number(s.stuck_days) }))
    });
  } catch (e) { next(e); }
};

exports.correlation = async (req, res, next) => {
  try {
    const { x, y } = req.query;
    if (x === y) return res.status(400).json({ message: 'Choose two different metrics' });
    const units = await allowedUnits(req, parseIds(req.query.unit_ids));
    if (!units.length) return res.status(400).json({ message: 'Select at least one greenhouse unit' });
    const rg = range(req, 60);
    if (rg.error) return res.status(400).json({ message: rg.error });
    const minCov = Math.min(Math.max(Number(req.query.min_coverage) || 70, 0), 100);
    const method = req.query.method === 'spearman' ? 'spearman' : 'pearson';
    const [rows] = await db.query(
      `SELECT growing_unit_id AS u, day, ${x} AS x, ${y} AS y FROM unit_daily
        WHERE growing_unit_id IN (?) AND day BETWEEN ? AND ? AND ${x} IS NOT NULL AND ${y} IS NOT NULL AND data_coverage >= ? ORDER BY day`, [units.map((u) => u.id), rg.from, rg.to, minCov]);
    const xs = rows.map((r) => Number(r.x));
    const ys = rows.map((r) => Number(r.y));
    const stats = ST.correlate(xs, ys, method);
    const caveats = ['Correlation shows association, not cause.', 'Daily values from one greenhouse are serially correlated, so treat p-values as exploratory.'];
    if (rows.length < 10) caveats.push('Fewer than 10 days: the estimate is unstable.');
    if (units.length > 1) caveats.push('Several greenhouses are pooled; differences between them can create or hide a relationship.');
    if (!stats) caveats.push('No correlation could be computed (too few points or no variation).');
    res.json({ x, y, method, n: rows.length, stats, units: units.map((u) => ({ id: u.id, code: u.code })), caveats, points: rows.slice(-2000).map((r) => ({ u: r.u, day: r.day, x: Number(r.x), y: Number(r.y) })) });
  } catch (e) { next(e); }
};

exports.compare = async (req, res, next) => {
  try {
    const metric = req.query.metric;
    const units = await allowedUnits(req, parseIds(req.query.unit_ids, 8));
    if (units.length < 2) return res.status(400).json({ message: 'Select at least two greenhouse units' });
    const rg = range(req, 30);
    if (rg.error) return res.status(400).json({ message: rg.error });
    const [rows] = await db.query(
      `SELECT growing_unit_id AS u, ${metric} AS v FROM unit_daily WHERE growing_unit_id IN (?) AND day BETWEEN ? AND ? AND ${metric} IS NOT NULL AND data_coverage >= 70`, [units.map((u) => u.id), rg.from, rg.to]);
    const by = {};
    rows.forEach((r) => { (by[r.u] = by[r.u] || []).push(Number(r.v)); });
    const stats = units.map((u) => ({ unit_id: u.id, code: u.code, name: u.name_en, n: (by[u.id] || []).length, mean: ST.mean(by[u.id] || []), sd: ST.sd(by[u.id] || []) }));
    const test = ST.compareGroups(units.map((u) => by[u.id] || []));
    res.json({
      metric, stats, test,
      caveats: ['Each greenhouse is a single unit, so days are pseudo-replicates: the test describes these greenhouses over these days, not greenhouses in general.',
        'Use the Experiments tab, with at least 2 greenhouses per group, for a proper comparison.']
    });
  } catch (e) { next(e); }
};

exports.devicesHealth = async (req, res, next) => {
  try {
    const sc = orgSql(req);
    const [rows] = await db.query(
      `SELECT d.id, d.device_code, d.status, d.last_seen_at, d.firmware_version, d.missed_messages, d.duplicate_messages, gu.name_en AS unit_name, TIMESTAMPDIFF(SECOND, d.last_seen_at, NOW()) AS age_s,
              (SELECT t.rssi FROM device_telemetry t WHERE t.device_id = d.id ORDER BY t.id DESC LIMIT 1) AS rssi,
              (SELECT t.uptime_s FROM device_telemetry t WHERE t.device_id = d.id ORDER BY t.id DESC LIMIT 1) AS uptime_s,
              (SELECT t.free_heap FROM device_telemetry t WHERE t.device_id = d.id ORDER BY t.id DESC LIMIT 1) AS free_heap,
              (SELECT t.reset_reason FROM device_telemetry t WHERE t.device_id = d.id ORDER BY t.id DESC LIMIT 1) AS reset_reason,
              (SELECT t.sensor_errors FROM device_telemetry t WHERE t.device_id = d.id ORDER BY t.id DESC LIMIT 1) AS sensor_errors,
              (SELECT t.wifi_reconnects FROM device_telemetry t WHERE t.device_id = d.id ORDER BY t.id DESC LIMIT 1) AS wifi_reconnects,
              (SELECT t.http_failures FROM device_telemetry t WHERE t.device_id = d.id ORDER BY t.id DESC LIMIT 1) AS http_failures,
              (SELECT ROUND(AVG(t.rssi)) FROM device_telemetry t WHERE t.device_id = d.id AND t.recorded_at >= NOW() - INTERVAL 24 HOUR) AS rssi_avg_24h,
              (SELECT COUNT(*) FROM device_telemetry t WHERE t.device_id = d.id AND t.recorded_at >= NOW() - INTERVAL 24 HOUR AND t.uptime_s < 120) AS reboots_24h
         FROM iot_devices d JOIN sites s ON s.id = d.site_id LEFT JOIN growing_units gu ON gu.id = d.growing_unit_id
         LEFT JOIN farms fm ON fm.id = d.farm_id LEFT JOIN farmers f ON f.id = fm.farmer_id
        WHERE d.status <> 'disabled' AND (d.farm_id IS NULL OR (f.consent_research = 1 AND f.verification_status = 'verified'))${sc.sql} ORDER BY d.id`, sc.params);
    res.json(rows.map((r) => ({ ...r, reboots_24h: Number(r.reboots_24h), live: r.last_seen_at === null ? 'registered' : r.age_s > 300 ? 'offline' : 'online' })));
  } catch (e) { next(e); }
};

exports.calibrate = async (req, res, next) => {
  try {
    const sc = orgSql(req);
    const [rows] = await db.query(
      `SELECT se.id, se.calibration_offset AS o, se.calibration_scale AS sc FROM sensors se JOIN iot_devices d ON d.id = se.device_id JOIN sites s ON s.id = d.site_id WHERE se.id = ?${sc.sql}`, [req.params.id, ...sc.params]);
    const s = rows[0];
    if (!s) return notFound(res, 'Sensor');
    const b = req.body;
    const m1 = Number(b.point1_measured), r1 = Number(b.point1_reference);
    const hasTwo = b.point2_measured !== undefined && b.point2_measured !== null && b.point2_reference !== undefined && b.point2_reference !== null;
    let a = 1, c = r1 - m1;
    if (hasTwo) {
      const m2 = Number(b.point2_measured), r2 = Number(b.point2_reference);
      if (m2 === m1) return res.status(400).json({ message: 'The two measured values must differ' });
      a = (r2 - r1) / (m2 - m1);
      c = r1 - a * m1;
      if (!(a > 0.2 && a < 5)) return res.status(400).json({ message: `The calculated scale factor (${a.toFixed(3)}) is outside 0.2 to 5. Check the readings.` });
    }
    const scaleAfter = a * s.sc;
    const offsetAfter = a * s.o + c;
    await db.query('UPDATE sensors SET calibration_offset = ?, calibration_scale = ? WHERE id = ?', [offsetAfter, scaleAfter, s.id]);
    await db.query('INSERT INTO sensor_calibrations SET ?', [{
      sensor_id: s.id, method: b.method, reference_instrument: b.reference_instrument || null, point1_measured: m1, point1_reference: r1,
      point2_measured: hasTwo ? Number(b.point2_measured) : null, point2_reference: hasTwo ? Number(b.point2_reference) : null,
      offset_before: s.o, scale_before: s.sc, offset_after: offsetAfter, scale_after: scaleAfter, notes: b.notes || null, performed_by: req.user.id
    }]);
    await logAudit(req.user.id, 'sensor_calibrate', 'sensor', s.id, { offset_after: offsetAfter, scale_after: scaleAfter, points: hasTwo ? 2 : 1 }, req);
    res.status(201).json({ offset: offsetAfter, scale: scaleAfter, note: 'Applies to readings received from now on. Earlier readings are not changed.' });
  } catch (e) { next(e); }
};

exports.calibrations = async (req, res, next) => {
  try {
    const sc = orgSql(req);
    const [rows] = await db.query(
      `SELECT c.*, u.username FROM sensor_calibrations c JOIN sensors se ON se.id = c.sensor_id JOIN iot_devices d ON d.id = se.device_id JOIN sites s ON s.id = d.site_id
         LEFT JOIN users u ON u.id = c.performed_by WHERE c.sensor_id = ?${sc.sql} ORDER BY c.id DESC LIMIT 50`, [req.params.id, ...sc.params]);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.automation = async (req, res, next) => {
  try {
    const [u] = await allowedUnits(req, [Number(req.params.id)]);
    if (!u) return notFound(res, 'Growing unit');
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 60);
    const [sensor] = await db.query("SELECT id FROM sensors WHERE growing_unit_id = ? AND sensor_type = 'soil_moisture' AND status = 'active' ORDER BY id LIMIT 1", [u.id]);
    if (!sensor[0]) return res.json({ unit: u, events: [], summary: null, note: 'This unit has no active soil moisture sensor.' });
    const [events] = await db.query(
      `SELECT e.id, e.started_at, e.ended_at, e.trigger_source, a.name AS actuator FROM actuator_events e JOIN actuators a ON a.id = e.actuator_id
        WHERE a.growing_unit_id = ? AND a.actuator_type = 'irrigation' AND e.state = 'on' AND e.ended_at IS NOT NULL AND e.started_at >= UTC_TIMESTAMP() - INTERVAL ? DAY
        ORDER BY e.id DESC LIMIT 150`, [u.id, days]);
    const out = [];
    for (const e of events) {
      const [[b]] = await db.query('SELECT AVG(value) AS v FROM sensor_readings WHERE sensor_id = ? AND recorded_at BETWEEN ? - INTERVAL 12 MINUTE AND ?', [sensor[0].id, e.started_at, e.started_at]);
      const [[a]] = await db.query('SELECT AVG(value) AS v FROM sensor_readings WHERE sensor_id = ? AND recorded_at BETWEEN ? + INTERVAL 3 MINUTE AND ? + INTERVAL 25 MINUTE', [sensor[0].id, e.ended_at, e.ended_at]);
      if (b.v === null || a.v === null) continue;
      const secs = Math.max(1, Math.round((new Date(e.ended_at) - new Date(e.started_at)) / 1000));
      out.push({ id: e.id, started_at: e.started_at, seconds: secs, trigger: e.trigger_source, actuator: e.actuator, before: Number(b.v), after: Number(a.v), delta: Number(a.v) - Number(b.v) });
    }
    const deltas = out.map((x) => x.delta);
    const perMin = out.map((x) => x.delta / (x.seconds / 60));
    res.json({
      unit: u, days, events: out,
      summary: out.length ? { n: out.length, mean_delta: ST.mean(deltas), sd_delta: ST.sd(deltas), mean_seconds: ST.mean(out.map((x) => x.seconds)), gain_per_minute: ST.mean(perMin) } : null,
      note: 'Soil moisture before (12 min) and after (3 to 25 min) each irrigation run. A response that varies a lot between runs can mean uneven wetting, a blocked line or a drifting sensor.'
    });
  } catch (e) { next(e); }
};

exports.dictionary = (req, res) => {
  const lines = [
    '# Greenhouse research data dictionary', '',
    '## Time', 'All daily and hourly values use Nepal local time (UTC+05:45). Raw readings are stored in UTC.', '',
    '## Method notes',
    '- Hourly rows: count, mean, min, max and population standard deviation of raw (calibrated) readings.',
    '- Daily per-greenhouse means are sample-count weighted across hourly rollups. Data coverage is the received sample count divided by the expected count (DEVICE_UPLOAD_SECONDS, default 30 seconds); it is not a measure of accuracy.',
    '- Calibration offset and scale are applied when a reading arrives. Changing a calibration does not alter earlier readings.',
    '- Time in range uses the optimum range of the active crop (or the generic crop when none is active). These ranges are reference defaults, not validated local recommendations.',
    '- Rows with data coverage below 70 % should normally be excluded from analysis.',
    '- Exported unit and sensor identifiers of farmer-owned greenhouses are pseudonymous. Only units whose farmer gave research consent and is verified are included.', '',
    '## Metrics', '| Key | Name | Unit | Definition |', '|---|---|---|---|'
  ];
  Object.entries(METRICS).forEach(([k, v]) => lines.push(`| ${k} | ${v.en} | ${v.unit} | ${v.def} |`));
  lines.push('', '## Limitations', '- Analog EC and low-cost soil sensors are indicative; validate against reference instruments.', '- Lux-to-PAR conversion uses an approximate sunlight factor and scales partial hours by sample coverage; it is not a substitute for a quantum PAR sensor.', '- Hourly means smooth short peaks of VPD and temperature.', '- Google Weather API values are transient context and are not retained in long-term exports.');
  res.set({ 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="research_data_dictionary.md"' });
  res.send(lines.join('\n'));
};

exports.exportData = async (req, res, next) => {
  try {
    const dataset = req.params.dataset;
    const purpose = String(req.query.purpose || '').trim();
    if (purpose.length < 10 || purpose.length > 255) return res.status(400).json({ message: 'Enter the purpose of this export (10-255 characters)' });
    if (!process.env.EXPORT_SECRET) return res.status(500).json({ message: 'Export is not configured (EXPORT_SECRET is missing in .env)' });
    const rg = range(req, 30, dataset === 'hourly' ? 62 : 730);
    if (rg.error) return res.status(400).json({ message: rg.error });
    const ids = parseIds(req.query.unit_ids, 50);
    const sc = orgSql(req);
    const sim = req.query.include_simulated === '1' ? '' : ' AND gu.is_simulated = 0';
    const [units] = await db.query(
      `SELECT gu.id, gu.code, gu.farm_id FROM growing_units gu JOIN sites s ON s.id = gu.site_id
         LEFT JOIN farms fm ON fm.id = gu.farm_id LEFT JOIN farmers f ON f.id = fm.farmer_id
        WHERE (gu.farm_id IS NULL OR (f.consent_research = 1 AND f.verification_status = 'verified'))${sim}${sc.sql}${ids.length ? ' AND gu.id IN (?)' : ''}`,
      [...sc.params, ...(ids.length ? [ids] : [])]);
    if (!units.length) return res.status(400).json({ message: 'No eligible greenhouse units. Farmer-owned units need verified farmers with research consent.' });
    const ref = Object.fromEntries(units.map((u) => [u.id, u.farm_id ? S.pseudo('U', u.id) : u.code]));
    const uids = units.map((u) => u.id);
    let rows, columns;
    if (dataset === 'daily') {
      const [raw] = await db.query(
        `SELECT d.growing_unit_id AS uid, d.day, d.dap, c.name_en AS crop, ${KEYS.map((k) => `d.${k}`).join(', ')}
           FROM unit_daily d LEFT JOIN crops c ON c.id = d.crop_id WHERE d.growing_unit_id IN (?) AND d.day BETWEEN ? AND ? ORDER BY d.growing_unit_id, d.day`, [uids, rg.from, rg.to]);
      columns = ['unit_ref', 'day', 'crop', 'days_after_planting', ...KEYS];
      rows = raw.map((r) => ({ unit_ref: ref[r.uid], day: r.day, crop: r.crop, days_after_planting: r.dap, ...Object.fromEntries(KEYS.map((k) => [k, r[k]])) }));
    } else {
      const [raw] = await db.query(
        `SELECT s.id AS sid, s.growing_unit_id AS uid, s.sensor_type, s.unit AS measure_unit, DATE_FORMAT(h.hour_local, '%Y-%m-%d %H:%i') AS hour_local, h.n, h.v_avg, h.v_min, h.v_max, h.v_std
           FROM sensor_hourly h JOIN sensors s ON s.id = h.sensor_id WHERE s.growing_unit_id IN (?) AND h.hour_local >= ? AND h.hour_local < ? ORDER BY s.growing_unit_id, s.id, h.hour_local`,
        [uids, `${rg.from} 00:00:00`, `${addDays(rg.to, 1)} 00:00:00`]);
      columns = ['unit_ref', 'sensor_ref', 'sensor_type', 'measure_unit', 'hour_local', 'n', 'v_avg', 'v_min', 'v_max', 'v_std'];
      rows = raw.map((r) => ({ unit_ref: ref[r.uid], sensor_ref: S.pseudo('S', r.sid), sensor_type: r.sensor_type, measure_unit: r.measure_unit, hour_local: r.hour_local, n: r.n,
        v_avg: Math.round(r.v_avg * 1000) / 1000, v_min: r.v_min, v_max: r.v_max, v_std: Math.round(r.v_std * 1000) / 1000 }));
    }
    await db.query('INSERT INTO data_exports (user_id, dataset, privacy_level, filters, row_count, purpose) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, `research_${dataset}`, 'anonymized', JSON.stringify({ from: rg.from, to: rg.to, units: uids.length }), rows.length, purpose]);
    await logAudit(req.user.id, 'research_export', 'dataset', dataset, { rows: rows.length, units: uids.length, purpose }, req);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="research_${dataset}_${rg.from}_${rg.to}.csv"`, 'Cache-Control': 'no-store' });
    res.send(S.toCsv(rows, columns));
  } catch (e) { next(e); }
};

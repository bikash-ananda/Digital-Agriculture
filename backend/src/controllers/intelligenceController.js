const path = require('path');
const db = require('../config/db');
const crypto = require('crypto');
const { logAudit } = require('../utils/audit');
const { analyzeUnit } = require('../services/analysisService');

const ROOT = path.resolve(__dirname, '..', '..', 'uploads');
const isSuper = (req) => req.user.roles.includes('super_admin');
const orgSql = (req, alias = 's') =>
  isSuper(req) ? { sql: '', params: [] } : { sql: ` AND ${alias}.organization_id = ?`, params: [req.user.organization_id] };
const clean = (v) => (v === '' || v === undefined ? null : v);
const pad = (n, w) => String(n).padStart(w, '0');
const tmp = () => `T-${crypto.randomBytes(8).toString('hex')}`;

async function unitOf(req, id) {
  const sc = orgSql(req);
  const [rows] = await db.query(`SELECT gu.* FROM growing_units gu JOIN sites s ON s.id = gu.site_id WHERE gu.id = ?${sc.sql}`, [id, ...sc.params]);
  return rows[0];
}
async function cycleOf(req, id) {
  const sc = orgSql(req);
  const [rows] = await db.query(
    `SELECT cc.* FROM crop_cycles cc JOIN growing_units gu ON gu.id = cc.growing_unit_id JOIN sites s ON s.id = gu.site_id WHERE cc.id = ?${sc.sql}`, [id, ...sc.params]);
  return rows[0];
}
async function ruleOf(req, id) {
  const sc = orgSql(req);
  const [rows] = await db.query(
    `SELECT r.* FROM automation_rules r JOIN growing_units gu ON gu.id = r.growing_unit_id JOIN sites s ON s.id = gu.site_id WHERE r.id = ?${sc.sql}`, [id, ...sc.params]);
  return rows[0];
}
async function cameraOf(req, id) {
  const sc = orgSql(req);
  const [rows] = await db.query(
    `SELECT c.* FROM cameras c JOIN iot_devices d ON d.id = c.device_id JOIN sites s ON s.id = d.site_id WHERE c.id = ?${sc.sql}`, [id, ...sc.params]);
  return rows[0];
}
const notFound = (res, what) => res.status(404).json({ message: `${what} not found` });

exports.analysis = async (req, res, next) => {
  try {
    const unit = await unitOf(req, req.params.id);
    if (!unit) return notFound(res, 'Growing unit');
    res.json(await analyzeUnit(unit.id));
  } catch (e) { next(e); }
};

exports.analysisHistory = async (req, res, next) => {
  try {
    const unit = await unitOf(req, req.params.id);
    if (!unit) return notFound(res, 'Growing unit');
    const hours = Math.min(Math.max(parseInt(req.query.hours, 10) || 24, 1), 720);
    const [rows] = await db.query(
      'SELECT computed_at, health_score, vpd, dew_point, dli FROM analysis_snapshots WHERE growing_unit_id = ? AND computed_at >= (NOW() - INTERVAL ? HOUR) ORDER BY computed_at', [unit.id, hours]);
    res.json({ hours, points: rows });
  } catch (e) { next(e); }
};

exports.recommendations = async (req, res, next) => {
  try {
    const unit = await unitOf(req, req.params.id);
    if (!unit) return notFound(res, 'Growing unit');
    const [rows] = await db.query("SELECT * FROM recommendations WHERE growing_unit_id = ? AND status = 'open' ORDER BY FIELD(severity,'critical','warning','info'), id DESC", [unit.id]);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.dismissRecommendation = async (req, res, next) => {
  try {
    const sc = orgSql(req);
    const [rows] = await db.query(
      `SELECT r.id FROM recommendations r JOIN growing_units gu ON gu.id = r.growing_unit_id JOIN sites s ON s.id = gu.site_id WHERE r.id = ?${sc.sql}`, [req.params.id, ...sc.params]);
    if (!rows[0]) return notFound(res, 'Recommendation');
    await db.query("UPDATE recommendations SET status = 'dismissed' WHERE id = ?", [rows[0].id]);
    res.json({ message: 'Dismissed' });
  } catch (e) { next(e); }
};

exports.listCycles = async (req, res, next) => {
  try {
    const unit = await unitOf(req, req.params.id);
    if (!unit) return notFound(res, 'Growing unit');
    const [rows] = await db.query(
      `SELECT cc.*, DATEDIFF(CURDATE(), cc.planted_on) AS days_since, c.name_ne AS crop_ne, c.name_en AS crop_en
         FROM crop_cycles cc JOIN crops c ON c.id = cc.crop_id WHERE cc.growing_unit_id = ? ORDER BY cc.id DESC`, [unit.id]);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.createCycle = async (req, res, next) => {
  try {
    const unit = await unitOf(req, req.params.id);
    if (!unit) return notFound(res, 'Growing unit');
    const [act] = await db.query("SELECT id FROM crop_cycles WHERE growing_unit_id = ? AND status = 'active'", [unit.id]);
    if (act.length) return res.status(409).json({ message: 'This unit already has an active crop cycle. Close it first.' });
    const b = req.body;
    const [r] = await db.query('INSERT INTO crop_cycles SET ?', [{
      growing_unit_id: unit.id, crop_id: b.crop_id, batch_code: tmp(), variety: clean(b.variety), planted_on: b.planted_on,
      plant_count: clean(b.plant_count), expected_harvest_on: clean(b.expected_harvest_on), notes: clean(b.notes), created_by: req.user.id
    }]);
    const code = `BATCH-${pad(r.insertId, 5)}`;
    await db.query('UPDATE crop_cycles SET batch_code = ? WHERE id = ?', [code, r.insertId]);
    await logAudit(req.user.id, 'crop_cycle_create', 'crop_cycle', r.insertId, { unit: unit.id, crop_id: b.crop_id, code }, req);
    res.status(201).json({ id: r.insertId, batch_code: code });
  } catch (e) {
    if (e.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ message: 'Unknown crop' });
    next(e);
  }
};

exports.updateCycle = async (req, res, next) => {
  try {
    const cycle = await cycleOf(req, req.params.id);
    if (!cycle) return notFound(res, 'Crop cycle');
    const changes = {};
    ['variety', 'plant_count', 'expected_harvest_on', 'notes', 'stage_override', 'status'].forEach((k) => { if (req.body[k] !== undefined) changes[k] = clean(req.body[k]); });
    if (changes.status && changes.status !== 'active') changes.closed_at = new Date();
    if (!Object.keys(changes).length) return res.status(400).json({ message: 'No changes supplied' });
    await db.query('UPDATE crop_cycles SET ? WHERE id = ?', [changes, cycle.id]);
    await logAudit(req.user.id, 'crop_cycle_update', 'crop_cycle', cycle.id, { fields: Object.keys(changes) }, req);
    res.json({ message: 'Crop cycle updated' });
  } catch (e) { next(e); }
};

exports.listObservations = async (req, res, next) => {
  try {
    const cycle = await cycleOf(req, req.params.id);
    if (!cycle) return notFound(res, 'Crop cycle');
    const [rows] = await db.query(
      `SELECT o.*, u.full_name_en AS observer FROM manual_observations o LEFT JOIN users u ON u.id = o.observed_by
        WHERE o.cycle_id = ? ORDER BY o.observed_at DESC, o.id DESC LIMIT 200`, [cycle.id]);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.addObservation = async (req, res, next) => {
  try {
    const cycle = await cycleOf(req, req.params.id);
    if (!cycle) return notFound(res, 'Crop cycle');
    const b = req.body;
    const data = {};
    ['obs_type', 'plant_height_cm', 'leaf_count', 'ph_value', 'ec_value', 'yield_kg', 'pest_disease', 'severity', 'fertilizer', 'notes'].forEach((k) => {
      if (clean(b[k]) !== null) data[k] = b[k];
    });
    if (!Object.keys(data).filter((k) => k !== 'obs_type').length) return res.status(400).json({ message: 'Enter at least one observation value' });
    if (b.observed_at) data.observed_at = new Date(b.observed_at);
    const [r] = await db.query('INSERT INTO manual_observations SET ?', [{ ...data, cycle_id: cycle.id, observed_by: req.user.id }]);
    await logAudit(req.user.id, 'observation_create', 'crop_cycle', cycle.id, { observation_id: r.insertId }, req);
    res.status(201).json({ id: r.insertId });
  } catch (e) { next(e); }
};

exports.listCropTasks = async (req, res, next) => {
  try {
    const cycle = await cycleOf(req, req.params.id);
    if (!cycle) return notFound(res, 'Crop cycle');
    const [rows] = await db.query(
      `SELECT t.*, u.full_name_en AS creator
         FROM crop_tasks t LEFT JOIN users u ON u.id = t.created_by
        WHERE t.cycle_id = ?
        ORDER BY FIELD(t.status,'open','skipped','done'), t.due_on IS NULL, t.due_on, t.id`, [cycle.id]);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.createCropTask = async (req, res, next) => {
  try {
    const cycle = await cycleOf(req, req.params.id);
    if (!cycle) return notFound(res, 'Crop cycle');
    const [result] = await db.query('INSERT INTO crop_tasks SET ?', [{
      cycle_id: cycle.id, title: req.body.title.trim(), notes: clean(req.body.notes),
      due_on: clean(req.body.due_on), priority: req.body.priority || 'normal', created_by: req.user.id
    }]);
    await logAudit(req.user.id, 'crop_task_create', 'crop_task', result.insertId, { cycle_id: cycle.id }, req);
    res.status(201).json({ id: result.insertId });
  } catch (e) { next(e); }
};

exports.updateCropTask = async (req, res, next) => {
  try {
    const sc = orgSql(req);
    const [rows] = await db.query(
      `SELECT t.id, t.cycle_id, t.status
         FROM crop_tasks t JOIN crop_cycles cc ON cc.id = t.cycle_id
         JOIN growing_units gu ON gu.id = cc.growing_unit_id JOIN sites s ON s.id = gu.site_id
        WHERE t.id = ?${sc.sql}`, [req.params.id, ...sc.params]);
    const task = rows[0];
    if (!task) return notFound(res, 'Crop task');
    const changes = {};
    if (req.body.title !== undefined) changes.title = req.body.title.trim();
    if (req.body.notes !== undefined) changes.notes = clean(req.body.notes);
    if (req.body.due_on !== undefined) changes.due_on = clean(req.body.due_on);
    if (req.body.priority !== undefined) changes.priority = req.body.priority;
    if (req.body.status !== undefined) {
      changes.status = req.body.status;
      changes.completed_at = req.body.status === 'done' ? new Date() : null;
      changes.completed_by = req.body.status === 'done' ? req.user.id : null;
    }
    if (!Object.keys(changes).length) return res.status(400).json({ message: 'No changes supplied' });
    await db.query('UPDATE crop_tasks SET ? WHERE id = ?', [changes, task.id]);
    await logAudit(req.user.id, 'crop_task_update', 'crop_task', task.id, { fields: Object.keys(changes) }, req);
    res.json({ message: 'Crop task updated' });
  } catch (e) { next(e); }
};

async function validateRule(unit, b) {
  const [[a]] = await db.query('SELECT id, growing_unit_id, max_runtime_seconds FROM actuators WHERE id = ?', [b.actuator_id]);
  const [[s]] = await db.query('SELECT id, growing_unit_id FROM sensors WHERE id = ?', [b.sensor_id]);
  if (!a || a.growing_unit_id !== unit.id) return 'Actuator does not belong to this unit';
  if (!s || s.growing_unit_id !== unit.id) return 'Sensor does not belong to this unit';
  const start = Number(b.start_threshold), stop = Number(b.stop_threshold);
  const lowSide = b.comparison === 'lt' || b.comparison === 'lte';
  if (lowSide && !(stop > start)) return 'For a "below" rule, the stop threshold must be higher than the start threshold';
  if (!lowSide && !(stop < start)) return 'For an "above" rule, the stop threshold must be lower than the start threshold';
  if (Number(b.max_runtime_seconds) > a.max_runtime_seconds) return `Max runtime cannot exceed the actuator limit (${a.max_runtime_seconds}s)`;
  return null;
}

exports.listRules = async (req, res, next) => {
  try {
    const unit = await unitOf(req, req.params.id);
    if (!unit) return notFound(res, 'Growing unit');
    const [rows] = await db.query(
      `SELECT r.*, a.name AS actuator_name, a.control_mode, s.name AS sensor_name, s.sensor_type
         FROM automation_rules r JOIN actuators a ON a.id = r.actuator_id JOIN sensors s ON s.id = r.sensor_id
        WHERE r.growing_unit_id = ? ORDER BY r.id`, [unit.id]);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.createRule = async (req, res, next) => {
  try {
    const unit = await unitOf(req, req.params.id);
    if (!unit) return notFound(res, 'Growing unit');
    const b = { max_runtime_seconds: 900, min_interval_seconds: 1800, ...req.body };
    const problem = await validateRule(unit, b);
    if (problem) return res.status(400).json({ message: problem });
    const [r] = await db.query('INSERT INTO automation_rules SET ?', [{
      growing_unit_id: unit.id, actuator_id: b.actuator_id, sensor_id: b.sensor_id, name: b.name, comparison: b.comparison,
      start_threshold: b.start_threshold, stop_threshold: b.stop_threshold, max_runtime_seconds: b.max_runtime_seconds,
      min_interval_seconds: b.min_interval_seconds, schedule_from: clean(b.schedule_from), schedule_to: clean(b.schedule_to),
      is_enabled: b.is_enabled ? 1 : 0, created_by: req.user.id
    }]);
    const [[a]] = await db.query('SELECT control_mode FROM actuators WHERE id = ?', [b.actuator_id]);
    await logAudit(req.user.id, 'automation_rule_create', 'automation_rule', r.insertId, { name: b.name, enabled: !!b.is_enabled }, req);
    res.status(201).json({ id: r.insertId, actuator_mode: a.control_mode,
      note: a.control_mode === 'auto' ? null : 'Rule saved. It only runs while the actuator is in AUTO mode.' });
  } catch (e) { next(e); }
};

exports.updateRule = async (req, res, next) => {
  try {
    const rule = await ruleOf(req, req.params.id);
    if (!rule) return notFound(res, 'Rule');
    const [[unit]] = await db.query('SELECT * FROM growing_units WHERE id = ?', [rule.growing_unit_id]);
    const merged = { ...rule, ...req.body };
    const problem = await validateRule(unit, merged);
    if (problem) return res.status(400).json({ message: problem });
    const changes = {};
    ['name', 'comparison', 'start_threshold', 'stop_threshold', 'max_runtime_seconds', 'min_interval_seconds', 'schedule_from', 'schedule_to'].forEach((k) => {
      if (req.body[k] !== undefined) changes[k] = clean(req.body[k]);
    });
    if (req.body.is_enabled !== undefined) changes.is_enabled = req.body.is_enabled ? 1 : 0;
    if (!Object.keys(changes).length) return res.status(400).json({ message: 'No changes supplied' });
    await db.query('UPDATE automation_rules SET ? WHERE id = ?', [changes, rule.id]);
    await logAudit(req.user.id, 'automation_rule_update', 'automation_rule', rule.id, changes, req);
    res.json({ message: 'Rule updated' });
  } catch (e) { next(e); }
};

exports.deleteRule = async (req, res, next) => {
  try {
    const rule = await ruleOf(req, req.params.id);
    if (!rule) return notFound(res, 'Rule');
    await db.query('DELETE FROM automation_rules WHERE id = ?', [rule.id]);
    await logAudit(req.user.id, 'automation_rule_delete', 'automation_rule', rule.id, { name: rule.name }, req);
    res.json({ message: 'Rule deleted' });
  } catch (e) { next(e); }
};

exports.ruleSuggestions = async (req, res, next) => {
  try {
    const unit = await unitOf(req, req.params.id);
    if (!unit) return notFound(res, 'Growing unit');
    const a = await analyzeUnit(unit.id);
    const tg = Object.fromEntries(a.parameters.filter((p) => p.target).map((p) => [p.key, p.target]));
    const [acts] = await db.query("SELECT id, name, actuator_type, max_runtime_seconds FROM actuators WHERE growing_unit_id = ? AND status = 'active'", [unit.id]);
    const [sens] = await db.query("SELECT id, sensor_type FROM sensors WHERE growing_unit_id = ? AND status = 'active' ORDER BY id", [unit.id]);
    const MAP = { irrigation: ['soil_moisture', 'lt'], pump: ['soil_moisture', 'lt'], misting: ['humidity', 'lt'], fan: ['temperature', 'gt'], vent: ['temperature', 'gt'], heater: ['temperature', 'lt'] };
    const r1 = (x) => Math.round(x * 10) / 10;
    const out = [];
    for (const act of acts) {
      const m = MAP[act.actuator_type];
      if (!m) continue;
      const [type, cmp] = m;
      const sensor = sens.find((s) => s.sensor_type === type);
      const t = tg[type];
      if (!sensor || !t) continue;
      const start = cmp === 'lt' ? t.opt_min : t.opt_max;
      const stop = cmp === 'lt' ? t.opt_min + (t.opt_max - t.opt_min) * 0.5 : t.opt_max - (t.opt_max - t.opt_min) * 0.25;
      out.push({ actuator_id: act.id, actuator_name: act.name, sensor_id: sensor.id, sensor_type: type,
        name: `${act.name}: ${type} ${cmp === 'lt' ? 'below' : 'above'} ${r1(start)}`, comparison: cmp,
        start_threshold: r1(start), stop_threshold: r1(stop), max_runtime_seconds: Math.min(act.max_runtime_seconds, 600), min_interval_seconds: 1800 });
    }
    res.json(out);
  } catch (e) { next(e); }
};

exports.createCamera = async (req, res, next) => {
  try {
    const sc = orgSql(req);
    const [rows] = await db.query(`SELECT d.id, d.growing_unit_id FROM iot_devices d JOIN sites s ON s.id = d.site_id WHERE d.id = ?${sc.sql}`, [req.params.id, ...sc.params]);
    if (!rows[0]) return notFound(res, 'Device');
    const b = req.body;
    const [r] = await db.query('INSERT INTO cameras SET ?', [{
      device_id: rows[0].id, growing_unit_id: rows[0].growing_unit_id, name: b.name, camera_type: b.camera_type || 'esp32cam', stream_url: clean(b.stream_url)
    }]);
    await logAudit(req.user.id, 'camera_create', 'camera', r.insertId, { device_id: rows[0].id }, req);
    res.status(201).json({ id: r.insertId });
  } catch (e) { next(e); }
};

exports.listCameras = async (req, res, next) => {
  try {
    const unit = await unitOf(req, req.params.id);
    if (!unit) return notFound(res, 'Growing unit');
    const [rows] = await db.query(
      `SELECT c.id, c.name, c.camera_type, c.stream_url, c.status, c.last_snapshot_at,
              (SELECT COUNT(*) FROM camera_snapshots x WHERE x.camera_id = c.id) AS snapshot_count
         FROM cameras c WHERE c.growing_unit_id = ? ORDER BY c.id`, [unit.id]);
    res.json(rows);
  } catch (e) { next(e); }
};

function sendImage(res, relPath) {
  res.set('Cache-Control', 'no-store');
  res.type('image/jpeg');
  res.sendFile(relPath, { root: ROOT }, (err) => { if (err && !res.headersSent) res.status(404).json({ message: 'Image file missing' }); });
}

exports.latestImage = async (req, res, next) => {
  try {
    const cam = await cameraOf(req, req.params.id);
    if (!cam) return notFound(res, 'Camera');
    const [rows] = await db.query('SELECT file_path FROM camera_snapshots WHERE camera_id = ? ORDER BY id DESC LIMIT 1', [cam.id]);
    if (!rows[0]) return res.status(404).json({ message: 'No snapshots yet' });
    sendImage(res, rows[0].file_path);
  } catch (e) { next(e); }
};

exports.listSnapshots = async (req, res, next) => {
  try {
    const cam = await cameraOf(req, req.params.id);
    if (!cam) return notFound(res, 'Camera');
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 100);
    const [rows] = await db.query('SELECT id, size_bytes, captured_at FROM camera_snapshots WHERE camera_id = ? ORDER BY id DESC LIMIT ?', [cam.id, limit]);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.snapshotImage = async (req, res, next) => {
  try {
    const sc = orgSql(req);
    const [rows] = await db.query(
      `SELECT cs.file_path FROM camera_snapshots cs JOIN cameras c ON c.id = cs.camera_id JOIN iot_devices d ON d.id = c.device_id JOIN sites s ON s.id = d.site_id
        WHERE cs.id = ?${sc.sql}`, [req.params.id, ...sc.params]);
    if (!rows[0]) return notFound(res, 'Snapshot');
    sendImage(res, rows[0].file_path);
  } catch (e) { next(e); }
};

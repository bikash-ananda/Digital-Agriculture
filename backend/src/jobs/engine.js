const db = require('../config/db');
const { analyzeUnit } = require('../services/analysisService');
const { logAudit } = require('../utils/audit');

const running = { auto: false, analysis: false };
const OFFLINE_SECONDS = 300;

async function queueCommand(actuatorId, command, duration, meta) {
  await db.query("UPDATE actuator_commands SET status = 'cancelled' WHERE actuator_id = ? AND status = 'pending'", [actuatorId]);
  const [r] = await db.query(
    `INSERT INTO actuator_commands (actuator_id, command, source, requested_by, duration_seconds, status, expires_at)
     VALUES (?, ?, 'auto', NULL, ?, 'pending', NOW() + INTERVAL 5 MINUTE)`, [actuatorId, command, duration]);
  await logAudit(null, 'automation_command', 'actuator', actuatorId, { command, duration, ...meta }, null);
  return r.insertId;
}

async function openAlert({ deviceId = null, sensorId = null, unitId = null, severity, message }) {
  const [ex] = await db.query(
    `SELECT id FROM alerts WHERE status IN ('open','acknowledged') AND message = ?
        AND COALESCE(growing_unit_id, 0) = ? AND COALESCE(device_id, 0) = ? LIMIT 1`, [message, unitId || 0, deviceId || 0]);
  if (ex.length) return;
  await db.query('INSERT INTO alerts (device_id, sensor_id, growing_unit_id, severity, message) VALUES (?, ?, ?, ?, ?)', [deviceId, sensorId, unitId, severity, message]);
}
const resolveAlerts = (where, params) =>
  db.query(`UPDATE alerts SET status = 'resolved', resolved_at = NOW() WHERE status IN ('open','acknowledged') AND ${where}`, params);

function inWindow(from, to) {
  if (!from || !to) return true;
  const n = new Date();
  const cur = (n.getUTCHours() * 3600 + n.getUTCMinutes() * 60 + n.getUTCSeconds() + 20700) % 86400; // Nepal time (UTC+05:45)
  const sec = (t) => { const [h, m, s] = String(t).split(':').map(Number); return h * 3600 + m * 60 + (s || 0); };
  const a = sec(from), b = sec(to);
  return a <= b ? cur >= a && cur <= b : cur >= a || cur <= b;
}

async function checkDevices() {
  const [devs] = await db.query(
    `SELECT id, device_code, growing_unit_id, TIMESTAMPDIFF(SECOND, last_seen_at, NOW()) AS age
       FROM iot_devices WHERE last_seen_at IS NOT NULL AND status <> 'disabled'`);
  for (const d of devs) {
    const msg = `Device offline: ${d.device_code}`;
    if (d.age > OFFLINE_SECONDS) await openAlert({ deviceId: d.id, unitId: d.growing_unit_id, severity: 'critical', message: msg });
    else await resolveAlerts('device_id = ? AND message = ?', [d.id, msg]);
  }
}

async function watchdog() {
  const [rows] = await db.query(
    `SELECT a.id, a.name, a.device_id, a.growing_unit_id
       FROM actuators a JOIN actuator_events e ON e.actuator_id = a.id AND e.state = 'on' AND e.ended_at IS NULL
      WHERE a.current_state = 'on' AND TIMESTAMPDIFF(SECOND, e.started_at, NOW()) > a.max_runtime_seconds + 60`);
  for (const a of rows) {
    const [[p]] = await db.query("SELECT COUNT(*) AS n FROM actuator_commands WHERE actuator_id = ? AND status IN ('pending','sent')", [a.id]);
    if (p.n) continue;
    await queueCommand(a.id, 'off', null, { reason: 'watchdog: max runtime exceeded' });
    await openAlert({ deviceId: a.device_id, unitId: a.growing_unit_id, severity: 'critical', message: `Max runtime exceeded: ${a.name} (forced OFF)` });
  }
}

async function runAutomation() {
  const [rules] = await db.query(
    `SELECT r.id, r.name, r.actuator_id, r.comparison, r.start_threshold, r.stop_threshold, r.max_runtime_seconds,
            r.min_interval_seconds, r.schedule_from, r.schedule_to,
            a.control_mode, a.current_state, a.status AS act_status, a.max_runtime_seconds AS act_max,
            s.sensor_value AS \`last_value\`, TIMESTAMPDIFF(SECOND, s.last_sensor_reading_at, NOW()) AS sensor_age,
            TIMESTAMPDIFF(SECOND, d.last_seen_at, NOW()) AS seen_age
       FROM automation_rules r
       JOIN actuators a ON a.id = r.actuator_id
       JOIN sensors s ON s.id = r.sensor_id
       JOIN iot_devices d ON d.id = a.device_id
      WHERE r.is_enabled = 1 ORDER BY r.id`);
  const handled = new Set();
  for (const r of rules) {
    try {
      if (handled.has(r.actuator_id) || r.act_status !== 'active' || r.control_mode !== 'auto') continue;
      handled.add(r.actuator_id);
      const [[p]] = await db.query("SELECT COUNT(*) AS n FROM actuator_commands WHERE actuator_id = ? AND status IN ('pending','sent')", [r.actuator_id]);
      if (p.n) continue;

      const isOn = r.current_state === 'on';
      const fresh = r.last_value !== null && r.sensor_age !== null && r.sensor_age <= OFFLINE_SECONDS;
      const online = r.seen_age !== null && r.seen_age <= OFFLINE_SECONDS;
      if (!fresh || !online) {
        if (isOn) await queueCommand(r.actuator_id, 'off', null, { rule: r.id, reason: 'fail-safe: stale sensor or offline device' });
        continue;
      }

      const v = Number(r.last_value), start = Number(r.start_threshold), stop = Number(r.stop_threshold);
      const lowSide = r.comparison === 'lt' || r.comparison === 'lte';
      const startCond = r.comparison === 'lt' ? v < start : r.comparison === 'lte' ? v <= start : r.comparison === 'gt' ? v > start : v >= start;
      const stopCond = lowSide ? v >= stop : v <= stop;
      const windowOk = inWindow(r.schedule_from, r.schedule_to);

      if (!isOn) {
        if (!startCond || !windowOk) continue;
        const [[g]] = await db.query('SELECT TIMESTAMPDIFF(SECOND, MAX(ended_at), NOW()) AS since FROM actuator_events WHERE actuator_id = ?', [r.actuator_id]);
        if (g.since !== null && g.since < r.min_interval_seconds) continue;
        const duration = Math.min(r.max_runtime_seconds, r.act_max);
        await queueCommand(r.actuator_id, 'on', duration, { rule: r.id, name: r.name, value: v });
        await db.query('UPDATE automation_rules SET last_started_at = NOW() WHERE id = ?', [r.id]);
      } else {
        const [ev] = await db.query('SELECT trigger_source FROM actuator_events WHERE actuator_id = ? AND ended_at IS NULL ORDER BY id DESC LIMIT 1', [r.actuator_id]);
        if (ev[0] && ev[0].trigger_source === 'manual') continue; // never override a manual run
        if (stopCond || !windowOk) await queueCommand(r.actuator_id, 'off', null, { rule: r.id, name: r.name, value: v });
      }
    } catch (e) { console.error(`[engine] rule ${r.id}:`, e.message); }
  }
}

async function runAnalysis() {
  const [units] = await db.query('SELECT DISTINCT growing_unit_id AS id FROM iot_devices WHERE growing_unit_id IS NOT NULL AND status <> \'disabled\'');
  for (const u of units) {
    try {
      const a = await analyzeUnit(u.id);
      await db.query('INSERT INTO analysis_snapshots (growing_unit_id, health_score, vpd, dew_point, dli) VALUES (?, ?, ?, ?, ?)',
        [u.id, a.health ? a.health.score : null, a.derived.vpd, a.derived.dew_point, a.derived.dli]);

      const codes = a.recommendations.map((r) => r.code);
      const [open] = await db.query("SELECT code FROM recommendations WHERE growing_unit_id = ? AND status IN ('open','dismissed')", [u.id]);
      const have = new Set(open.map((o) => o.code));
      for (const r of a.recommendations) if (!have.has(r.code))
        await db.query('INSERT INTO recommendations (growing_unit_id, code, category, severity, message_ne, message_en) VALUES (?, ?, ?, ?, ?, ?)',
          [u.id, r.code, r.category, r.severity, r.message_ne, r.message_en]);
      if (codes.length) await db.query("UPDATE recommendations SET status = 'resolved', resolved_at = NOW() WHERE growing_unit_id = ? AND status IN ('open','dismissed') AND code NOT IN (?)", [u.id, codes]);
      else await db.query("UPDATE recommendations SET status = 'resolved', resolved_at = NOW() WHERE growing_unit_id = ? AND status IN ('open','dismissed')", [u.id]);

      const critical = a.parameters.filter((p) => p.status.startsWith('critical')).map((p) => `Critical: ${p.label_en} ${p.status.endsWith('low') ? 'too low' : 'too high'}`);
      for (const msg of critical) await openAlert({ unitId: u.id, severity: 'critical', message: msg });
      if (critical.length) await resolveAlerts("growing_unit_id = ? AND message LIKE 'Critical:%' AND message NOT IN (?)", [u.id, critical]);
      else await resolveAlerts("growing_unit_id = ? AND message LIKE 'Critical:%'", [u.id]);
    } catch (e) { console.error(`[engine] analysis unit ${u.id}:`, e.message); }
  }
}

function start() {
  if (process.env.ENGINE_ENABLED === 'false') return console.log('Automation engine disabled (ENGINE_ENABLED=false)');
  const guard = (key, fn) => async () => {
    if (running[key]) return;
    running[key] = true;
    try { await fn(); } catch (e) { console.error(`[engine:${key}]`, e.message); } finally { running[key] = false; }
  };
  const auto = guard('auto', async () => { await checkDevices(); await watchdog(); await runAutomation(); });
  const analysis = guard('analysis', runAnalysis);
  setInterval(auto, 30 * 1000);
  setInterval(analysis, 10 * 60 * 1000);
  setTimeout(auto, 5000);
  setTimeout(analysis, 20000);
  console.log('Automation & analysis engine started');
}

module.exports = { start };

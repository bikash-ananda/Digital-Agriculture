const db = require('../config/db');

const { getWeather } = require('../services/weatherService');
const isSuper = (req) => req.user.roles.includes('super_admin');
const orgSql = (req) => (isSuper(req) ? { sql: '', params: [] } : { sql: ' AND s.organization_id = ?', params: [req.user.organization_id] });
const LIVE = `CASE WHEN d.status = 'disabled' THEN 'disabled' WHEN d.last_seen_at IS NULL THEN 'registered' WHEN d.last_seen_at < (NOW() - INTERVAL 5 MINUTE) THEN 'offline' ELSE 'online' END`;
let simCol = null;
async function simSql() {
  if (simCol === null) { const [c] = await db.query("SHOW COLUMNS FROM growing_units LIKE 'is_simulated'"); simCol = c.length > 0; }
  return simCol ? 'gu.is_simulated' : '0';
}
async function unitOf(req, id) {
  const sc = orgSql(req);
  const [r] = await db.query(`SELECT gu.id, gu.code, gu.name_en, gu.name_ne, gu.unit_type, ${await simSql()} AS is_simulated, s.name_en AS site_en, s.name_ne AS site_ne FROM growing_units gu JOIN sites s ON s.id = gu.site_id WHERE gu.id = ?${sc.sql}`, [id, ...sc.params]);
  return r[0];
}
const nowLocalMin = () => Math.floor(((Date.now() / 1000 + 20700) % 86400) / 60);
function inWindow(from, to) {
  if (!from || !to) return true;
  const mm = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
  const a = mm(from), b = mm(to), n = nowLocalMin();
  return a <= b ? n >= a && n <= b : n >= a || n <= b;
}

exports.units = async (req, res, next) => {
  try {
    const sc = orgSql(req);
    const [units] = await db.query(`SELECT gu.id, gu.code, gu.name_en, gu.name_ne, gu.unit_type, ${await simSql()} AS is_simulated, s.name_en AS site_en, s.name_ne AS site_ne FROM growing_units gu JOIN sites s ON s.id = gu.site_id WHERE 1 = 1${sc.sql} ORDER BY gu.id`, sc.params);
    if (!units.length) return res.json([]);
    const ids = units.map((u) => u.id);
    const [sens] = await db.query("SELECT growing_unit_id AS uid, sensor_type, sensor_value AS `last_value`, TIMESTAMPDIFF(SECOND, last_sensor_reading_at, NOW()) AS age FROM sensors WHERE growing_unit_id IN (?) AND status = 'active'", [ids]);
    const [devs] = await db.query(`SELECT d.growing_unit_id AS uid, ${LIVE} AS live FROM iot_devices d WHERE d.growing_unit_id IN (?)`, [ids]);
    const [al] = await db.query("SELECT growing_unit_id AS uid, COUNT(*) AS n FROM alerts WHERE growing_unit_id IN (?) AND status = 'open' GROUP BY growing_unit_id", [ids]);
    res.json(units.map((u) => {
      const live = devs.filter((d) => d.uid === u.id).map((d) => d.live);
      const vals = {};
      sens.filter((s) => s.uid === u.id && s.last_value !== null && s.age !== null && s.age < 600).forEach((s) => { vals[s.sensor_type] = s.last_value; });
      const a = al.find((x) => x.uid === u.id);
      return { ...u, is_simulated: !!u.is_simulated, status: live.includes('online') ? 'online' : live.includes('offline') ? 'offline' : live[0] || 'registered', values: vals, open_alerts: a ? Number(a.n) : 0 };
    }));
  } catch (e) { next(e); }
};

exports.overview = async (req, res, next) => {
  try {
    const unit = await unitOf(req, req.params.id);
    if (!unit) return res.status(404).json({ message: 'Growing unit not found' });
    const [devices] = await db.query(
      `SELECT d.id, d.device_code, d.firmware_version, d.last_seen_at, TIMESTAMPDIFF(SECOND, d.last_seen_at, NOW()) AS age_s, ${LIVE} AS live,
              od.ops_id, od.last_telemetry_at, od.config_mirror, TIMESTAMPDIFF(SECOND, od.last_telemetry_at, NOW()) AS ops_age_s
         FROM iot_devices d LEFT JOIN ops_devices od ON od.device_id = d.id WHERE d.growing_unit_id = ? ORDER BY d.id`, [unit.id]).catch(async () => {
      const [r] = await db.query(`SELECT d.id, d.device_code, d.firmware_version, d.last_seen_at, TIMESTAMPDIFF(SECOND, d.last_seen_at, NOW()) AS age_s, ${LIVE} AS live FROM iot_devices d WHERE d.growing_unit_id = ?`, [unit.id]);
      return [r];
    });
    let minOff = 30;
    devices.forEach((d) => {
      try { const c = typeof d.config_mirror === 'string' ? JSON.parse(d.config_mirror) : d.config_mirror; if (c && Number(c.min_off_s) >= 0) minOff = Number(c.min_off_s); } catch (e) { /* ignore */ }
      delete d.config_mirror;
    });
    const [sensors] = await db.query("SELECT id, sensor_type, name, unit, status, sensor_value AS `last_value`, TIMESTAMPDIFF(SECOND, last_sensor_reading_at, NOW()) AS age_s FROM sensors WHERE growing_unit_id = ? AND status <> 'disabled' ORDER BY id", [unit.id]);
    const [spark] = await db.query(
      `SELECT s.sensor_type AS type, FLOOR(UNIX_TIMESTAMP(r.recorded_at) / 300) * 300 AS ts, AVG(r.value) AS v FROM sensor_readings r JOIN sensors s ON s.id = r.sensor_id
        WHERE s.growing_unit_id = ? AND s.status <> 'disabled' AND r.recorded_at >= NOW() - INTERVAL 6 HOUR GROUP BY type, ts ORDER BY ts`, [unit.id]);
    const groups = {};
    sensors.forEach((s) => { (groups[s.sensor_type] = groups[s.sensor_type] || []).push(s); });
    const tiles = Object.entries(groups).map(([type, list]) => {
      const fresh = list.filter((s) => s.last_value !== null && s.age_s !== null && s.age_s <= 180);
      const age = Math.min(...list.map((s) => (s.age_s === null ? 1e9 : s.age_s)));
      return { type, name: list[0].name, unit: list[0].unit, value: fresh.length ? fresh.reduce((a, s) => a + s.last_value, 0) / fresh.length : (list[0].last_value ?? null), age_s: age >= 1e9 ? null : age, stale: age > 180,
        spark: spark.filter((x) => x.type === type).map((x) => ({ ts: Number(x.ts), v: Number(x.v) })) };
    });
    const [acts] = await db.query(
      `SELECT a.id, a.actuator_type, a.name, a.control_mode, a.current_state, a.last_state_at, a.max_runtime_seconds, a.status,
              (SELECT TIMESTAMPDIFF(SECOND, MAX(e.ended_at), NOW()) FROM actuator_events e WHERE e.actuator_id = a.id AND e.ended_at IS NOT NULL) AS since_off_s,
              (SELECT c.duration_seconds FROM actuator_commands c WHERE c.actuator_id = a.id AND c.command = 'on' AND c.status = 'acknowledged' ORDER BY c.id DESC LIMIT 1) AS last_dur,
              (SELECT TIMESTAMPDIFF(SECOND, c.acknowledged_at, NOW()) FROM actuator_commands c WHERE c.actuator_id = a.id AND c.command = 'on' AND c.status = 'acknowledged' ORDER BY c.id DESC LIMIT 1) AS since_on_s
         FROM actuators a WHERE a.growing_unit_id = ? ORDER BY a.id`, [unit.id]);
    const actuators = acts.map((a) => ({
      id: a.id, type: a.actuator_type, name: a.name, mode: a.control_mode, state: a.current_state, status: a.status, max_runtime_seconds: a.max_runtime_seconds, last_state_at: a.last_state_at,
      cooldown_left_s: a.current_state !== 'on' && a.since_off_s !== null ? Math.max(0, minOff - a.since_off_s) : 0,
      ends_in_s: a.current_state === 'on' && a.last_dur && a.since_on_s !== null ? Math.max(0, a.last_dur - a.since_on_s) : null, total_s: a.last_dur
    }));
    let commands = [];
    if (acts.length) {
      [commands] = await db.query(
        `SELECT c.id, c.actuator_id, a.name AS actuator, c.command, c.duration_seconds, c.source, c.status, c.error_message, c.requested_at, c.acknowledged_at, u.username
           FROM actuator_commands c JOIN actuators a ON a.id = c.actuator_id LEFT JOIN users u ON u.id = c.requested_by WHERE a.growing_unit_id = ? ORDER BY c.id DESC LIMIT 12`, [unit.id]);
    }
    const [alerts] = await db.query("SELECT id, severity, message, triggered_at FROM alerts WHERE growing_unit_id = ? AND status = 'open' ORDER BY id DESC LIMIT 5", [unit.id]);
    res.json({ unit: { ...unit, is_simulated: !!unit.is_simulated }, devices, tiles, actuators, commands, alerts, min_off_s: minOff, server_time: new Date().toISOString() });
  } catch (e) { next(e); }
};

exports.weather = async (req, res, next) => {
  try {
    const unit = await unitOf(req, req.params.id);
    if (!unit) return res.status(404).json({ message: 'Growing unit not found' });
    const sc = orgSql(req);
    const [[site]] = await db.query(
      `SELECT s.latitude, s.longitude FROM growing_units gu JOIN sites s ON s.id = gu.site_id WHERE gu.id = ?${sc.sql}`,
      [unit.id, ...sc.params]);
    let data;
    try {
      data = await getWeather(site && site.latitude, site && site.longitude, req.query.lang === 'ne' ? 'ne' : 'en');
    } catch (e) {
      console.error('[weather provider]', e.message);
      return res.status(502).json({ configured: Boolean(process.env.GOOGLE_WEATHER_API_KEY), available: false, reason: 'provider_unavailable' });
    }
    res.set('Cache-Control', 'no-store');
    res.json(data);
  } catch (e) { next(e); }
};

exports.series = async (req, res, next) => {
  try {
    const unit = await unitOf(req, req.params.id);
    if (!unit) return res.status(404).json({ message: 'Growing unit not found' });
    const hours = Math.min(Math.max(parseInt(req.query.hours, 10) || 24, 1), 720);
    const types = String(req.query.types || 'temperature').split(',').map((x) => x.trim()).filter((x) => /^[a-z_0-9]{2,30}$/.test(x)).slice(0, 4);
    if (!types.length) return res.status(400).json({ message: 'Choose at least one sensor type' });
    const bucket = Math.max(15, Math.ceil((hours * 3600) / 300 / 15) * 15);
    const [rows] = await db.query(
      `SELECT s.sensor_type AS type, FLOOR(UNIX_TIMESTAMP(r.recorded_at) / ?) * ? AS ts, AVG(r.value) AS v, MIN(r.value) AS lo, MAX(r.value) AS hi
         FROM sensor_readings r JOIN sensors s ON s.id = r.sensor_id WHERE s.growing_unit_id = ? AND s.status <> 'disabled' AND s.sensor_type IN (?) AND r.recorded_at >= NOW() - INTERVAL ? SECOND
        GROUP BY type, ts ORDER BY ts`, [bucket, bucket, unit.id, types, hours * 3600]);
    const [ev] = await db.query(
      `SELECT a.actuator_type AS type, UNIX_TIMESTAMP(e.started_at) AS s, UNIX_TIMESTAMP(COALESCE(e.ended_at, NOW())) AS e FROM actuator_events e JOIN actuators a ON a.id = e.actuator_id
        WHERE a.growing_unit_id = ? AND e.state = 'on' AND COALESCE(e.ended_at, NOW()) >= NOW() - INTERVAL ? SECOND ORDER BY e.started_at`, [unit.id, hours * 3600]);
    const series = {};
    rows.forEach((r) => { (series[r.type] = series[r.type] || []).push({ ts: Number(r.ts), v: Number(r.v), lo: Number(r.lo), hi: Number(r.hi) }); });
    res.json({ hours, bucket, series, events: ev.map((e) => ({ type: e.type, s: Number(e.s), e: Number(e.e) })) });
  } catch (e) { next(e); }
};

exports.automationStatus = async (req, res, next) => {
  try {
    const unit = await unitOf(req, req.params.id);
    if (!unit) return res.status(404).json({ message: 'Growing unit not found' });
    const [rules] = await db.query(
      `SELECT r.*, a.name AS actuator_name, a.actuator_type, a.control_mode, a.current_state, a.status AS act_status, s.name AS sensor_name, s.sensor_type, s.sensor_value AS \`last_value\`, s.unit AS sensor_unit,
              TIMESTAMPDIFF(SECOND, s.last_sensor_reading_at, NOW()) AS sensor_age, TIMESTAMPDIFF(SECOND, d.last_seen_at, NOW()) AS seen_age,
              (SELECT TIMESTAMPDIFF(SECOND, MAX(e.ended_at), NOW()) FROM actuator_events e WHERE e.actuator_id = a.id AND e.ended_at IS NOT NULL) AS since_off,
              (SELECT COUNT(*) FROM actuator_commands c WHERE c.actuator_id = a.id AND c.status IN ('pending','sent')) AS pending
         FROM automation_rules r JOIN actuators a ON a.id = r.actuator_id JOIN sensors s ON s.id = r.sensor_id JOIN iot_devices d ON d.id = a.device_id WHERE r.growing_unit_id = ? ORDER BY r.id`, [unit.id]);
    res.json(rules.map((r) => {
      const v = r.last_value === null ? null : Number(r.last_value);
      const low = r.comparison === 'lt' || r.comparison === 'lte';
      const startCond = v !== null && (r.comparison === 'lt' ? v < r.start_threshold : r.comparison === 'lte' ? v <= r.start_threshold : r.comparison === 'gt' ? v > r.start_threshold : v >= r.start_threshold);
      let state; let ne; let en;
      const set = (s, a, b) => { state = s; ne = a; en = b; };
      if (!r.is_enabled) set('disabled', 'निष्क्रिय छ', 'Rule is switched off');
      else if (r.control_mode !== 'auto') set('blocked', `${r.actuator_name} म्यानुअल मोडमा छ — स्वचालित मोड चाहिन्छ`, `${r.actuator_name} is in manual mode — switch it to automatic`);
      else if (r.act_status !== 'active') set('blocked', 'एक्चुएटर सक्रिय छैन', 'The actuator is not active');
      else if (r.sensor_age === null || r.sensor_age > 300) set('blocked', 'सेन्सरको तथ्याङ्क ५ मिनेटभन्दा पुरानो छ', 'Sensor data is older than 5 minutes');
      else if (r.seen_age === null || r.seen_age > 300) set('blocked', 'यन्त्र अफलाइन छ', 'The device is offline');
      else if (Number(r.pending) > 0) set('waiting', 'अर्को आदेश प्रक्रियामा छ', 'Another command is in progress');
      else if (r.current_state === 'on') set('running', `चलिरहेको छ; ${r.stop_threshold}${r.sensor_unit || ''} पुगेपछि रोकिन्छ`, `Running; stops at ${r.stop_threshold}${r.sensor_unit || ''}`);
      else if (!startCond) set('idle', `हाल ${v === null ? '—' : v.toFixed(1)}${r.sensor_unit || ''}; सुरु हुने सीमा ${r.start_threshold}`, `Now ${v === null ? '—' : v.toFixed(1)}${r.sensor_unit || ''}; starts ${low ? 'below' : 'above'} ${r.start_threshold}`);
      else if (!inWindow(r.schedule_from, r.schedule_to)) set('waiting', 'अनुमति प्राप्त समय सीमा बाहिर (नेपाल समय)', 'Outside the allowed time window (Nepal time)');
      else if (r.since_off !== null && r.since_off < r.min_interval_seconds) set('waiting', `आराम गर्दैछ: ${Math.ceil((r.min_interval_seconds - r.since_off) / 60)} मिनेट बाँकी`, `Resting: ${Math.ceil((r.min_interval_seconds - r.since_off) / 60)} min left`);
      else set('will_start', 'सर्त पूरा भयो — ३० सेकेन्डभित्र सुरु हुन्छ', 'Conditions met — starts within 30 seconds');
      return { id: r.id, name: r.name, is_enabled: !!r.is_enabled, comparison: r.comparison, start_threshold: r.start_threshold, stop_threshold: r.stop_threshold, max_runtime_seconds: r.max_runtime_seconds, min_interval_seconds: r.min_interval_seconds,
        schedule_from: r.schedule_from, schedule_to: r.schedule_to, actuator_id: r.actuator_id, actuator_name: r.actuator_name, actuator_type: r.actuator_type, sensor_id: r.sensor_id, sensor_name: r.sensor_name, sensor_type: r.sensor_type, sensor_unit: r.sensor_unit, value: v, state, why: { ne, en } };
    }));
  } catch (e) { next(e); }
};

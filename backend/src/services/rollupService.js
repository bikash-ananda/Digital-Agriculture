const db = require('../config/db');

const TZ = '+05:45';
const LOCAL_MS = (5 * 60 + 45) * 60000;
const LUX_TO_PPFD = 0.0185;

const localDate = (offsetDays = 0) => new Date(Date.now() + LOCAL_MS + offsetDays * 86400000).toISOString().slice(0, 10);
const localHour = () => new Date(Date.now() + LOCAL_MS).getUTCHours();
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const utcStr = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const svp = (t) => 0.6108 * Math.exp((17.27 * t) / (t + 237.3));
const dewPoint = (t, rh) => { const a = 17.27, b = 237.3; const al = (a * t) / (b + t) + Math.log(Math.max(rh, 1) / 100); return (b * al) / (a - al); };
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const rd = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

async function rollupHourly(hoursBack = 3) {
  await db.query(
    `INSERT INTO sensor_hourly (sensor_id, hour_local, n, v_avg, v_min, v_max, v_std)
     SELECT sensor_id, DATE_FORMAT(CONVERT_TZ(recorded_at, '+00:00', '${TZ}'), '%Y-%m-%d %H:00:00') AS h,
            COUNT(*), AVG(value), MIN(value), MAX(value), COALESCE(STDDEV_POP(value), 0)
       FROM sensor_readings
      WHERE recorded_at >= CONVERT_TZ(DATE_FORMAT(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '${TZ}') - INTERVAL ? HOUR, '%Y-%m-%d %H:00:00'), '${TZ}', '+00:00')
      GROUP BY sensor_id, h
     ON DUPLICATE KEY UPDATE n = VALUES(n), v_avg = VALUES(v_avg), v_min = VALUES(v_min), v_max = VALUES(v_max), v_std = VALUES(v_std)`, [hoursBack]);
}

async function rollupSensorDaily(fromDay, toDay) {
  await db.query(
    `INSERT INTO sensor_daily (sensor_id, day, n, hours_covered, v_avg, v_min, v_max, v_std)
     SELECT sensor_id, DATE(hour_local), SUM(n), COUNT(*), SUM(v_avg * n) / SUM(n), MIN(v_min), MAX(v_max),
            SQRT(GREATEST(0, SUM(n * (v_std * v_std + v_avg * v_avg)) / SUM(n) - POW(SUM(v_avg * n) / SUM(n), 2)))
       FROM sensor_hourly WHERE hour_local >= ? AND hour_local < ? GROUP BY sensor_id, DATE(hour_local)
     ON DUPLICATE KEY UPDATE n = VALUES(n), hours_covered = VALUES(hours_covered), v_avg = VALUES(v_avg), v_min = VALUES(v_min), v_max = VALUES(v_max), v_std = VALUES(v_std)`,
    [`${fromDay} 00:00:00`, `${addDays(toDay, 1)} 00:00:00`]);
}

async function unitTargets(cropId) {
  const [g] = await db.query("SELECT id FROM crops WHERE code = 'GENERIC'");
  const generic = g[0] ? g[0].id : 0;
  const [rows] = await db.query("SELECT crop_id, parameter, opt_min, opt_max FROM crop_stage_targets WHERE crop_id IN (?, ?) AND stage_code = 'all'", [cropId || 0, generic]);
  const out = {};
  rows.filter((x) => x.crop_id === generic).forEach((x) => { out[x.parameter] = x; });
  rows.filter((x) => x.crop_id === cropId).forEach((x) => { out[x.parameter] = x; });
  return out;
}

async function rollupUnitDay(unit, day) {
  const [sensors] = await db.query("SELECT id, sensor_type FROM sensors WHERE growing_unit_id = ? AND status <> 'disabled'", [unit.id]);
  if (!sensors.length) return false;
  const typeOf = Object.fromEntries(sensors.map((s) => [s.id, s.sensor_type]));
  const [hrs] = await db.query(
    `SELECT sensor_id, DATE_FORMAT(hour_local, '%H') AS hh, n, v_avg, v_min, v_max FROM sensor_hourly
      WHERE sensor_id IN (?) AND hour_local >= ? AND hour_local < ?`, [sensors.map((s) => s.id), `${day} 00:00:00`, `${addDays(day, 1)} 00:00:00`]);
  if (!hrs.length) return false;

  const acc = {};
  hrs.forEach((h) => { const k = `${typeOf[h.sensor_id]}|${h.hh}`; (acc[k] = acc[k] || []).push(h); });
  const T = {};
  Object.entries(acc).forEach(([k, list]) => {
    const [type, hh] = k.split('|');
    const w = list.reduce((a, x) => a + x.n, 0);
    (T[type] = T[type] || {})[hh] = { hh, avg: list.reduce((a, x) => a + x.v_avg * x.n, 0) / w, min: Math.min(...list.map((x) => x.v_min)), max: Math.max(...list.map((x) => x.v_max)) };
  });
  const series = (t) => Object.values(T[t] || {}).sort((a, b) => a.hh.localeCompare(b.hh));
  const temp = series('temperature'), rh = series('humidity'), sm = series('soil_moisture'), st = series('soil_temperature');
  const ec = series('ec'), wl = series('water_level'), lux = series('light');
  const mean = (a) => avg(a.map((x) => x.avg));
  const lo = (a) => (a.length ? Math.min(...a.map((x) => x.min)) : null);
  const hi = (a) => (a.length ? Math.max(...a.map((x) => x.max)) : null);

  const [cy] = await db.query(
    `SELECT cc.id, cc.crop_id, c.base_temp_c, DATEDIFF(?, cc.planted_on) AS dap FROM crop_cycles cc JOIN crops c ON c.id = cc.crop_id
      WHERE cc.growing_unit_id = ? AND cc.planted_on <= ? AND (cc.closed_at IS NULL OR DATE(cc.closed_at) >= ?) ORDER BY cc.id DESC LIMIT 1`, [day, unit.id, day, day]);
  const cycle = cy[0] || null;
  const tg = await unitTargets(cycle ? cycle.crop_id : null);
  const base = cycle ? Number(cycle.base_temp_c) : 10;

  const rhMap = Object.fromEntries(rh.map((x) => [x.hh, x.avg]));
  const vpdS = temp.filter((x) => rhMap[x.hh] !== undefined).map((x) => ({
    hh: x.hh, v: svp(x.avg) * (1 - Math.min(Math.max(rhMap[x.hh], 0), 100) / 100), dp: dewPoint(x.avg, rhMap[x.hh])
  }));
  const tir = (ser, target, pick = (x) => x.avg) => (!target || !ser.length ? null : (100 * ser.filter((x) => pick(x) >= target.opt_min && pick(x) <= target.opt_max).length) / ser.length);

  const [types] = await db.query('SELECT DISTINCT actuator_type FROM actuators WHERE growing_unit_id = ?', [unit.id]);
  const haveAct = new Set(types.map((x) => x.actuator_type));
  const startMs = Date.parse(`${day}T00:00:00Z`) - LOCAL_MS;
  const [act] = await db.query(
    `SELECT a.actuator_type AS type, COUNT(*) AS events,
            SUM(TIMESTAMPDIFF(SECOND, GREATEST(e.started_at, ?), LEAST(COALESCE(e.ended_at, UTC_TIMESTAMP()), ?))) AS secs
       FROM actuator_events e JOIN actuators a ON a.id = e.actuator_id
      WHERE a.growing_unit_id = ? AND e.state = 'on' AND e.started_at < ? AND COALESCE(e.ended_at, UTC_TIMESTAMP()) > ? GROUP BY a.actuator_type`,
    [utcStr(startMs), utcStr(startMs + 86400000), unit.id, utcStr(startMs + 86400000), utcStr(startMs)]);
  const A = Object.fromEntries(act.map((x) => [x.type, x]));
  const mins = (t) => (haveAct.has(t) ? rd(Number((A[t] && A[t].secs) || 0) / 60, 1) : null);

  const expected = day === localDate(0) ? localHour() + 1 : 24;
  const perSensor = {};
  hrs.forEach((h) => { perSensor[h.sensor_id] = (perSensor[h.sensor_id] || 0) + 1; });
  const coverage = avg(sensors.map((s) => Math.min(100, (100 * (perSensor[s.id] || 0)) / expected)));

  const row = {
    growing_unit_id: unit.id, day, cycle_id: cycle ? cycle.id : null, crop_id: cycle ? cycle.crop_id : null, dap: cycle ? cycle.dap : null,
    temp_avg: rd(mean(temp)), temp_min: rd(lo(temp)), temp_max: rd(hi(temp)), rh_avg: rd(mean(rh)),
    vpd_avg: rd(avg(vpdS.map((x) => x.v)), 3), vpd_max: vpdS.length ? rd(Math.max(...vpdS.map((x) => x.v)), 3) : null,
    dew_point_min: vpdS.length ? rd(Math.min(...vpdS.map((x) => x.dp))) : null,
    dli: lux.length ? rd(lux.reduce((a, x) => a + (x.avg * LUX_TO_PPFD * 3600) / 1e6, 0), 2) : null,
    gdd: temp.length ? rd(Math.max(0, (hi(temp) + lo(temp)) / 2 - base)) : null,
    soil_moisture_avg: rd(mean(sm)), soil_moisture_min: rd(lo(sm)), soil_moisture_max: rd(hi(sm)), soil_temp_avg: rd(mean(st)), ec_avg: rd(mean(ec), 3), water_level_min: rd(lo(wl)),
    irrigation_min: mins('irrigation'), misting_min: mins('misting'), fan_min: mins('fan'),
    irrigation_events: haveAct.has('irrigation') ? Number((A.irrigation && A.irrigation.events) || 0) : null,
    tir_temp: rd(tir(temp, tg.temperature), 1), tir_rh: rd(tir(rh, tg.humidity), 1), tir_soil_moisture: rd(tir(sm, tg.soil_moisture), 1), tir_vpd: rd(tir(vpdS, tg.vpd, (x) => x.v), 1),
    h_temp_above: tg.temperature && temp.length ? temp.filter((x) => x.avg > tg.temperature.opt_max).length : null,
    h_temp_below: tg.temperature && temp.length ? temp.filter((x) => x.avg < tg.temperature.opt_min).length : null,
    data_coverage: rd(coverage, 1)
  };
  const { growing_unit_id: _u, day: _d, ...rest } = row;
  await db.query('INSERT INTO unit_daily SET ? ON DUPLICATE KEY UPDATE ?', [row, rest]);
  return true;
}

async function rollupUnitRange(fromDay, toDay) {
  const [units] = await db.query('SELECT id FROM growing_units');
  for (let d = fromDay; d <= toDay; d = addDays(d, 1)) for (const u of units) await rollupUnitDay(u, d);
}

async function backfill(days) {
  const to = localDate(0);
  const from = addDays(to, -(days - 1));
  await rollupHourly(days * 24 + 26);
  await rollupSensorDaily(from, to);
  await rollupUnitRange(from, to);
  return { from, to };
}

function start() {
  if (process.env.ROLLUPS_ENABLED === 'false') return;
  let busy = false; let runs = 0;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      runs += 1; const deep = runs % 6 === 1; await rollupHourly(deep ? 72 : 3);
      const today = localDate(0);
      const yesterday = localDate(deep ? -3 : -1);
      await rollupSensorDaily(yesterday, today);
      await rollupUnitRange(yesterday, today);
    } catch (e) { console.error('[rollups]', e.message); } finally { busy = false; }
  };
  setInterval(run, 10 * 60 * 1000);
  setTimeout(run, 45000);
  console.log('Research rollup job started');
}

module.exports = { rollupHourly, rollupSensorDaily, rollupUnitDay, rollupUnitRange, backfill, start, localDate, addDays };

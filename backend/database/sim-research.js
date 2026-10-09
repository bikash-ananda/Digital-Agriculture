const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DAYS = Math.min(Math.max(parseInt(process.argv[2], 10) || 28, 7), 90);
const REMOVE = process.argv.includes('--remove');
const LOCAL_MS = (5 * 60 + 45) * 60000;
const STEP = 600000;
const CFG = { 'SIM-GH-A': { name: 'Sim greenhouse A (control)', dev: 'SIM-DEV-A', start: 35, stop: 46, fan: 33, batch: 'SIM-BATCH-A', seed: 11 },
  'SIM-GH-B': { name: 'Sim greenhouse B (treatment)', dev: 'SIM-DEV-B', start: 45, stop: 56, fan: 30, batch: 'SIM-BATCH-B', seed: 29 } };
const SENSORS = [['temperature', 'Air Temperature', '°C', -10, 80], ['humidity', 'Relative Humidity', '%', 0, 100], ['soil_moisture', 'Soil Moisture', '%', 0, 100],
  ['soil_temperature', 'Soil Temperature', '°C', -10, 60], ['ec', 'Electrical Conductivity', 'mS/cm', 0, 20], ['light', 'Light Intensity', 'lux', 0, 120000], ['water_level', 'Water Tank Level', '%', 0, 100]];

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => { let u = 0; let v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const fmt = (ms) => new Date(ms).toISOString().slice(0, 23).replace('T', ' ');
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const q = (db, sql, p) => db.query(sql, p).then((r) => r[0]);

async function remove(db) {
  const units = await q(db, "SELECT id FROM growing_units WHERE is_simulated = 1");
  if (!units.length) return console.log('No simulated data found.');
  const uid = units.map((u) => u.id);
  const sensors = (await q(db, 'SELECT id FROM sensors WHERE growing_unit_id IN (?)', [uid])).map((x) => x.id);
  const acts = (await q(db, 'SELECT id FROM actuators WHERE growing_unit_id IN (?)', [uid])).map((x) => x.id);
  const devs = (await q(db, 'SELECT id FROM iot_devices WHERE growing_unit_id IN (?)', [uid])).map((x) => x.id);
  await db.query('DELETE FROM experiment_units WHERE growing_unit_id IN (?)', [uid]);
  await db.query('DELETE FROM alerts WHERE growing_unit_id IN (?)', [uid]);
  if (sensors.length) { await db.query('DELETE FROM sensor_readings WHERE sensor_id IN (?)', [sensors]); await db.query('DELETE FROM sensors WHERE id IN (?)', [sensors]); }
  if (acts.length) { await db.query('DELETE FROM actuator_events WHERE actuator_id IN (?)', [acts]); await db.query('DELETE FROM actuator_commands WHERE actuator_id IN (?)', [acts]); await db.query('DELETE FROM actuators WHERE id IN (?)', [acts]); }
  await db.query('DELETE FROM crop_cycles WHERE growing_unit_id IN (?)', [uid]);
  if (devs.length) await db.query('DELETE FROM iot_devices WHERE id IN (?)', [devs]);
  await db.query('DELETE FROM growing_units WHERE id IN (?)', [uid]);
  await db.query("DELETE FROM experiments WHERE id NOT IN (SELECT experiment_id FROM experiment_units) AND code LIKE 'EXP-%' AND title LIKE 'SIM%'");
  await db.query("DELETE FROM sites WHERE code = 'SIM-LAB' AND id NOT IN (SELECT site_id FROM growing_units)");
  console.log(`Removed simulated data for ${uid.length} units.`);
}

async function ensureLab(db) {
  const org = await q(db, "SELECT id FROM organizations WHERE code = 'ADO-KASKI'");
  if (!org[0]) throw new Error('Base seed missing (organization ADO-KASKI)');
  let site = await q(db, "SELECT id FROM sites WHERE code = 'SIM-LAB'");
  if (!site[0]) {
    const [r] = await db.query('INSERT INTO sites SET ?', [{ organization_id: org[0].id, code: 'SIM-LAB', name_ne: 'सिमुलेसन प्रयोगशाला (कृत्रिम तथ्याङ्क)', name_en: 'Simulation lab (synthetic data)', site_type: 'research' }]);
    site = [{ id: r.insertId }];
  }
  const tomato = await q(db, "SELECT id FROM crops WHERE code = 'TOMATO'");
  const out = {};
  const planted = new Date(Date.now() + LOCAL_MS - (DAYS + 20) * 86400000).toISOString().slice(0, 10);
  for (const [code, c] of Object.entries(CFG)) {
    let u = await q(db, 'SELECT id FROM growing_units WHERE code = ?', [code]);
    if (!u[0]) { const [r] = await db.query('INSERT INTO growing_units SET ?', [{ site_id: site[0].id, unit_type: 'greenhouse', code, name_en: c.name, name_ne: c.name, is_simulated: 1 }]); u = [{ id: r.insertId }]; }
    let d = await q(db, 'SELECT id FROM iot_devices WHERE device_code = ?', [c.dev]);
    if (!d[0]) { const [r] = await db.query('INSERT INTO iot_devices SET ?', [{ uuid: crypto.randomUUID(), device_code: c.dev, site_id: site[0].id, growing_unit_id: u[0].id, status: 'disabled' }]); d = [{ id: r.insertId }]; }
    const sens = {};
    for (const [type, name, unit, min, max] of SENSORS) {
      let s = await q(db, 'SELECT id FROM sensors WHERE device_id = ? AND sensor_type = ?', [d[0].id, type]);
      if (!s[0]) { const [r] = await db.query('INSERT INTO sensors SET ?', [{ device_id: d[0].id, growing_unit_id: u[0].id, sensor_type: type, name, unit, min_valid: min, max_valid: max }]); s = [{ id: r.insertId }]; }
      sens[type] = s[0].id;
    }
    const acts = {};
    for (const type of ['irrigation', 'fan']) {
      let a = await q(db, 'SELECT id FROM actuators WHERE device_id = ? AND actuator_type = ?', [d[0].id, type]);
      if (!a[0]) { const [r] = await db.query('INSERT INTO actuators SET ?', [{ device_id: d[0].id, growing_unit_id: u[0].id, actuator_type: type, name: type === 'fan' ? 'Ventilation Fan' : 'Irrigation', max_runtime_seconds: 1800 }]); a = [{ id: r.insertId }]; }
      acts[type] = a[0].id;
    }
    const cy = await q(db, 'SELECT id FROM crop_cycles WHERE batch_code = ?', [c.batch]);
    if (!cy[0] && tomato[0]) await db.query('INSERT INTO crop_cycles SET ?', [{ growing_unit_id: u[0].id, crop_id: tomato[0].id, batch_code: c.batch, variety: 'Simulated', planted_on: planted, plant_count: 100, status: 'active', notes: 'SYNTHETIC DATA' }]);
    out[code] = { id: u[0].id, sens, acts };
  }
  return out;
}

async function simulate(db, lab) {
  const midnight = Math.floor((Date.now() + LOCAL_MS) / 86400000) * 86400000 - LOCAL_MS;
  const start = midnight - DAYS * 86400000;
  const wr = rng(1000);
  const weather = Array.from({ length: DAYS }, () => ({ dT: gauss(wr) * 2, cloud: 0.45 + 0.55 * wr() }));
  for (const [code, c] of Object.entries(CFG)) {
    const unit = lab[code];
    await db.query('DELETE FROM sensor_readings WHERE sensor_id IN (?)', [Object.values(unit.sens)]);
    await db.query('DELETE FROM actuator_events WHERE actuator_id IN (?)', [Object.values(unit.acts)]);
    const r = rng(c.seed);
    let sm = 50, st = 20, ec = 1.6, wl = 90, cooldown = 0, fanOn = false, fanStart = 0;
    const rows = [];
    const events = [];
    for (let ms = start; ms < midnight; ms += STEP) {
      const h = ((ms + LOCAL_MS) % 86400000) / 3600000;
      const w = weather[Math.floor((ms - start) / 86400000)];
      const tOut = 17 + w.dT + 7 * Math.sin((2 * Math.PI * (h - 9)) / 24);
      const sun = Math.max(0, Math.sin((Math.PI * (h - 6)) / 12));
      let tIn = tOut + 7 * sun * w.cloud;
      const wantFan = tIn > c.fan;
      if (wantFan) tIn -= 3.5;
      if (wantFan && !fanOn) { fanOn = true; fanStart = ms; }
      if (!wantFan && fanOn) { fanOn = false; events.push([unit.acts.fan, 'device', fanStart, ms]); }
      const rh = clamp(88 - 2.4 * (tIn - 15) + gauss(r) * 1.5, 35, 98);
      const lux = Math.max(0, 62000 * sun * w.cloud * (0.9 + 0.2 * r()));
      sm -= Math.max(0, 0.045 * (1 + 2.2 * sun * w.cloud + 0.04 * (tIn - 20)));
      if (sm < c.start && ms >= cooldown) {
        sm = c.stop + gauss(r) * 0.8; cooldown = ms + 90 * 60000; wl -= 0.6;
        events.push([unit.acts.irrigation, 'auto', ms, ms + 8 * 60000]);
      }
      if (wl < 20) wl = 95;
      st += 0.04 * (tIn - st);
      ec = clamp(ec + gauss(r) * 0.004 + 0.0004, 0.5, 4);
      const t = fmt(ms);
      const put = (type, v) => rows.push([unit.sens[type], Math.round(v * 1000) / 1000, t]);
      put('temperature', tIn + gauss(r) * 0.15); put('humidity', rh); put('soil_moisture', clamp(sm + gauss(r) * 0.3, 0, 100));
      put('soil_temperature', st + gauss(r) * 0.1); put('ec', ec); put('light', lux); put('water_level', clamp(wl, 0, 100));
    }
    for (let i = 0; i < rows.length; i += 2000) await db.query('INSERT INTO sensor_readings (sensor_id, value, recorded_at) VALUES ?', [rows.slice(i, i + 2000)]);
    for (const [aid, src, s, e] of events) await db.query('INSERT INTO actuator_events (actuator_id, state, trigger_source, started_at, ended_at, duration_seconds) VALUES (?, ?, ?, ?, ?, ?)', [aid, 'on', src, fmt(s).slice(0, 19), fmt(e).slice(0, 19), Math.round((e - s) / 1000)]);
    console.log(`${code}: ${rows.length} readings, ${events.length} actuator events`);
  }
}

(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, timezone: 'Z' });
  await db.query("SET time_zone = '+00:00'");
  if (REMOVE) { await remove(db); await db.end(); return; }
  const lab = await ensureLab(db);
  await simulate(db, lab);
  await db.end();
  const { backfill } = require('../src/services/rollupService');
  const res = await backfill(DAYS + 1);
  console.log(`Rollups computed for ${res.from} to ${res.to}. Done.`);
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });

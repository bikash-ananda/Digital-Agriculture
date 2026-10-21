const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Duplicate table / column / key / constraint: the change is already there.
const PRESENT = new Set([1050, 1060, 1061, 1068, 1091, 1826, 3822]);

(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: 'utf8mb4' });
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
  const [rows] = await db.query('SELECT name FROM schema_migrations');
  const done = new Set(rows.map((r) => r.name));
  const dir = path.join(__dirname, 'migrations');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    if (done.has(f)) { console.log('skip   ', f); continue; }
    console.log('apply  ', f);
    const sql = fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, '');
    const stmts = sql.split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter((s) => s.replace(/--.*$/gm, '').trim());
    let applied = 0;
    let present = 0;
    for (const s of stmts) {
      try { await db.query(s); applied++; } catch (e) {
        if (PRESENT.has(e.errno)) { present++; console.log(`   already present (${e.code}): ${s.replace(/\s+/g, ' ').slice(0, 80)}`); } else {
          console.error(`   FAILED in ${f}: ${e.message}\n   ${s.slice(0, 240)}`);
          process.exit(1);
        }
      }
    }
    await db.query('INSERT INTO schema_migrations (name) VALUES (?)', [f]);
    console.log(`   ${applied} statement(s) applied, ${present} already present`);
  }

  const col = async (table, name) => (await db.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [name]))[0][0];
  const problems = [];
  const need = [['sensors', 'channel_key'], ['actuators', 'relay_channel'], ['crops', 'base_temp_c'], ['growing_units', 'is_simulated'], ['iot_devices', 'farm_id'], ['iot_devices', 'ownership'], ['farmers', 'verification_status'], ['farms', 'soil_type'], ['device_wifi_commands', 'command_type']];
  for (const [t, c] of need) if (!(await col(t, c))) problems.push(`${t}.${c} is missing`);
  const st = await col('sensors', 'sensor_type');
  if (st && !String(st.Type).includes('soil_temperature')) problems.push("sensors.sensor_type does not allow 'soil_temperature'");
  const tbl = ['ops_devices', 'ops_health', 'ops_commands', 'firmware_images', 'ai_digests', 'sensor_hourly', 'unit_daily', 'crop_cycles', 'crop_stage_targets', 'crop_production'];
  for (const t of tbl) if (!(await db.query('SHOW TABLES LIKE ?', [t]))[0].length) problems.push(`table ${t} is missing`);
  console.log(problems.length ? `\nSCHEMA PROBLEMS:\n - ${problems.join('\n - ')}` : '\nSCHEMA OK');
  await db.end();
  process.exit(problems.length ? 2 : 0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });

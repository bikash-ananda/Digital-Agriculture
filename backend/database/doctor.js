const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const [t] = await db.query('SELECT table_name AS n FROM information_schema.tables WHERE table_schema = ?', [process.env.DB_NAME]);
  const have = new Set(t.map((x) => x.n));
  const need = ['users', 'roles', 'permissions', 'role_permissions', 'organizations', 'sites', 'growing_units', 'iot_devices', 'sensors', 'sensor_readings', 'actuators', 'actuator_events', 'actuator_commands', 'alerts', 'automation_rules'];
  const opt = ['crop_stage_targets', 'crop_cycles', 'ops_devices', 'ai_digests', 'sensor_hourly'];
  const [tz] = await db.query('SELECT @@session.time_zone AS tz, NOW() AS now_db, UTC_TIMESTAMP() AS utc');
  const [m] = await db.query('SELECT name FROM schema_migrations ORDER BY name').catch(() => [[]]);
  let express = 'unknown';
  try { express = require('express/package.json').version; } catch (e) { /* ignore */ }
  console.log('node', process.version, '| express', express);
  console.log('migrations      :', m.map((x) => x.name).join(', ') || '(none recorded)');
  console.log('MISSING required:', need.filter((x) => !have.has(x)).join(', ') || 'none');
  console.log('optional present:', opt.map((x) => `${x}=${have.has(x)}`).join(' '));
  console.log('db clock        :', JSON.stringify(tz[0]));
  console.log('engine file     :', fs.existsSync(path.join(__dirname, '..', 'src', 'jobs', 'engine.js')));
  await db.end();
})().catch((e) => { console.error('DOCTOR FAILED:', e.message); process.exit(1); });

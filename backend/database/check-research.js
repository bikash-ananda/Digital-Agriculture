const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const [t] = await db.query('SELECT table_name AS n FROM information_schema.tables WHERE table_schema = ?', [process.env.DB_NAME]);
  const have = new Set(t.map((x) => x.n));
  const need = ['sensor_readings', 'actuator_events', 'actuator_commands', 'crop_cycles', 'crop_stage_targets', 'analysis_snapshots', 'cameras', 'farmers', 'crop_production'];
  const [c] = await db.query("SHOW COLUMNS FROM crops LIKE 'base_temp_c'");
  const [m] = await db.query('SELECT name FROM schema_migrations ORDER BY name');
  const files = ['src/jobs/engine.js', 'src/services/analysisService.js', 'src/routes/deviceRoutes.js', 'src/controllers/deviceExtraController.js', 'src/routes/dataCenterRoutes.js'].filter((f) => !fs.existsSync(path.join(__dirname, '..', f)));
  console.log('migrations      :', m.map((x) => x.name).join(', '));
  console.log('missing tables  :', need.filter((x) => !have.has(x)).join(', ') || 'none');
  console.log('crops.base_temp_c present:', c.length === 1);
  console.log('missing files   :', files.join(', ') || 'none');
  await db.end();
})().catch((e) => { console.error('CHECK FAILED:', e.message); process.exit(1); });

const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const [m] = await db.query('SELECT name FROM schema_migrations ORDER BY name');
  console.log('migrations applied :', m.map(x => x.name).join(', '));
  const [t] = await db.query("SELECT table_name AS n FROM information_schema.tables WHERE table_schema = ? AND table_name IN ('crop_cycles','crop_stages','crop_stage_targets','manual_observations','recommendations','analysis_snapshots','cameras','camera_snapshots')", [process.env.DB_NAME]);
  console.log('new tables present :', t.map(x => x.n).join(', ') || '(none)');
  const [c] = await db.query('SELECT code FROM crops ORDER BY code');
  console.log('crops              :', c.map(x => x.code).join(', ') || '(none)');
  await db.end();
})().catch(e => { console.error('CHECK FAILED:', e.message); process.exit(1); });

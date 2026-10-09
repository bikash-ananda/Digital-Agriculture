const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const [m] = await db.query('SELECT name FROM schema_migrations ORDER BY name');
  console.log('migrations :', m.map((x) => x.name).join(', '));
  const [c] = await db.query("SHOW COLUMNS FROM farmers LIKE 'verification_status'");
  console.log('step 19 farmer columns present:', c.length === 1);
  const [t] = await db.query("SHOW TABLES LIKE 'crop_production'");
  console.log('crop_production table present :', t.length === 1);
  await db.end();
})().catch((e) => { console.error('CHECK FAILED:', e.message); process.exit(1); });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

(async () => {
  const dbName = process.env.DB_NAME;
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    multipleStatements: true, charset: 'utf8mb4'
  });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${dbName}\``);
  await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  const [rows] = await conn.query('SELECT name FROM schema_migrations');
  const done = new Set(rows.map(r => r.name));
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (done.has(f)) { console.log('skip   ', f); continue; }
    console.log('apply  ', f);
    await conn.query(fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, ''));
    await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [f]);
  }
  const [t] = await conn.query('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?', [dbName]);
  console.log(`Done. Tables in ${dbName}: ${t[0].n}`);
  await conn.end();
})().catch(e => { console.error('MIGRATION FAILED:', e.message); process.exit(1); });


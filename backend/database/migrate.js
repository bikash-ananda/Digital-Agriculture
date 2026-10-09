const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const IGNORED_ERROR_CODES = new Set([
  'ER_TABLE_EXISTS_ERROR',
  'ER_DUP_FIELDNAME',
  'ER_DUP_ENTRY',
  'ER_DUP_KEYNAME',
  'ER_DUP_CONSTRAINT_NAME',
  'ER_NONEXISTENT_TABLE'
]);

function splitSqlStatements(sql) {
  return sql
    .replace(/^\uFEFF/, '')
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function runMigrationFile(conn, file, sql) {
  const statements = splitSqlStatements(sql);
  for (const statement of statements) {
    try {
      await conn.query(statement);
    } catch (err) {
      if (err && err.code && IGNORED_ERROR_CODES.has(err.code)) {
        console.log(`warn   ${file}: ${err.code} -> ignored`);
        continue;
      }
      throw new Error(`${file}: ${err.message}`);
    }
  }
}

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
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    await runMigrationFile(conn, f, sql);
    await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [f]);
  }
  const [t] = await conn.query('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?', [dbName]);
  console.log(`Done. Tables in ${dbName}: ${t[0].n}`);
  await conn.end();
})().catch(e => { console.error('MIGRATION FAILED:', e.message); process.exit(1); });


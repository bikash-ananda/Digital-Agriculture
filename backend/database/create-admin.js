const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const [username, password, fullName] = process.argv.slice(2);
if (!username || !password || !fullName || password.length < 10) {
  console.error('Usage: node database/create-admin.js <username> <password (min 10 chars)> "<Full Name>"');
  process.exit(1);
}

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: 'utf8mb4'
  });
  const [[org]] = await db.query("SELECT id FROM organizations WHERE code = 'ADO-KASKI'");
  const [[role]] = await db.query("SELECT id FROM roles WHERE code = 'super_admin'");
  if (!org || !role) { console.error('Run npm run db:seed first.'); process.exit(1); }

  const hash = await bcrypt.hash(password, 12);
  const [r] = await db.query(
    `INSERT INTO users (uuid, organization_id, username, password_hash, full_name_en, status, must_change_password)
     VALUES (?, ?, ?, ?, ?, 'active', 0)`,
    [crypto.randomUUID(), org.id, username, hash, fullName]);
  await db.query('INSERT INTO user_roles (user_id, role_id, organization_id) VALUES (?, ?, NULL)', [r.insertId, role.id]);
  console.log(`Super Administrator created: ${username} (id ${r.insertId})`);
  await db.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

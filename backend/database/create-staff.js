const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ACCOUNTS = [
  { email: 'bikashengineering100@gmail.com', role: 'super_admin',         name: 'Bikash Engineering' },
  { email: 'sudip.khatiwada@gmail.com',      role: 'office_admin',        name: 'Sudip Khatiwada' },
  { email: 'bikashbk3317@gmail.com',         role: 'agriculture_officer', name: 'Bikash BK' },
  { email: 'rkaryal96@gmail.com',            role: 'agriculture_officer', name: 'R K Aryal' },
];

const genPassword = () => crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x') + 'aA1!';

(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: 'utf8mb4' });
  try {
    const [[org]] = await db.query("SELECT id FROM organizations WHERE code = 'ADO-KASKI'");
    if (!org) throw new Error('Run migrations and db:seed first.');
    for (const a of ACCOUNTS) {
      const [[role]] = await db.query('SELECT id FROM roles WHERE code = ?', [a.role]);
      if (!role) { console.log('SKIP (role missing):', a.role); continue; }
      const [[existing]] = await db.query('SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1', [a.email, a.email]);
      let id, pwd = null;
      if (existing) {
        id = existing.id;
        await db.query(`UPDATE users SET status='active', email_verified_at=COALESCE(email_verified_at,UTC_TIMESTAMP()), phone_verified_at=COALESCE(phone_verified_at,UTC_TIMESTAMP()),
          approved_at=COALESCE(approved_at,UTC_TIMESTAMP()), failed_login_attempts=0, locked_until=NULL WHERE id=?`, [id]);
      } else {
        pwd = genPassword();
        const hash = await bcrypt.hash(pwd, 12);
        const [r] = await db.query(`INSERT INTO users (uuid, organization_id, username, email, password_hash, full_name_en, status,
          must_change_password, email_verified_at, phone_verified_at, approved_at) VALUES (?,?,?,?,?,?, 'active', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
          [crypto.randomUUID(), org.id, a.email, a.email, hash, a.name]);
        id = r.insertId;
      }
      const [[has]] = await db.query('SELECT id FROM user_roles WHERE user_id=? AND role_id=? LIMIT 1', [id, role.id]);
      if (!has) await db.query('INSERT INTO user_roles (user_id, role_id, organization_id) VALUES (?,?,NULL)', [id, role.id]);
      console.log(`${existing ? 'UPDATED' : 'CREATED'}  ${a.role.padEnd(20)} ${a.email}${pwd ? '   temp password: ' + pwd : '   (password unchanged)'}`);
    }
  } finally { await db.end(); }
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });


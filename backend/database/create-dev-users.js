const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (process.env.NODE_ENV === 'production') { console.error('Refusing to run in production.'); process.exit(1); }

const USERS = [
  ['admin',      'super_admin',            'Dev@Admin2026!',   'Dev Super Admin'],
  ['office',     'office_admin',           'Dev@Office2026!',  'Dev Office Admin'],
  ['officer',    'agriculture_officer',    'Dev@Officer2026!', 'Dev Agriculture Officer'],
  ['technician', 'agriculture_technician', 'Dev@Tech2026!',    'Dev Technician'],
  ['iot',        'iot_operator',           'Dev@Iot2026!',     'Dev IoT Operator'],
  ['content',    'content_manager',        'Dev@Content2026!', 'Dev Content Manager'],
  ['farmer1',    'farmer',                 'Dev@Farmer2026!',  'Dev Test Farmer'],
  ['learner',    'learner',                'Dev@Learner2026!', 'Dev Learner']
];

(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: 'utf8mb4' });
  try {
    const [[org]] = await db.query("SELECT id FROM organizations WHERE code = 'ADO-KASKI'");
    if (!org) throw new Error('Run npm run db:seed first.');
    for (const [username, roleCode, pw, name] of USERS) {
      const [[role]] = await db.query('SELECT id FROM roles WHERE code = ?', [roleCode]);
      if (!role) { console.log('skip (role missing):', roleCode); continue; }
      const email = `${username}@kaskikotagro.local`;
      const hash = await bcrypt.hash(pw, 12);
      const [m] = await db.query('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1', [username, email]);
      let id;
      if (m.length) {
        id = m[0].id;
        await db.query("UPDATE users SET organization_id=?, username=?, email=?, password_hash=?, full_name_en=?, status='active', failed_login_attempts=0, locked_until=NULL, must_change_password=0 WHERE id=?", [org.id, username, email, hash, name, id]);
      } else {
        const [r] = await db.query("INSERT INTO users (uuid, organization_id, username, email, password_hash, full_name_en, status, must_change_password) VALUES (?,?,?,?,?,?,'active',0)", [crypto.randomUUID(), org.id, username, email, hash, name]);
        id = r.insertId;
      }
      const [ex] = await db.query('SELECT id FROM user_roles WHERE user_id=? AND role_id=? AND organization_id IS NULL LIMIT 1', [id, role.id]);
      if (!ex.length) await db.query('INSERT INTO user_roles (user_id, role_id, organization_id) VALUES (?,?,NULL)', [id, role.id]);
      console.log('ok', username, '->', roleCode);
    }
  } finally { await db.end(); }
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

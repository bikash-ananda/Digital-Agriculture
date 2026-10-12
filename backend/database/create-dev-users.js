const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (process.env.NODE_ENV !== 'development') {
  console.error('Refusing to run unless NODE_ENV=development.');
  process.exit(1);
}

// Development-only role accounts; the super-admin is provisioned separately from SUPER_ADMIN_EMAIL.
const USERS = [
  ['office',     'office_admin',           'Dev@Office2026!',  'Dev Office Admin',        '+9779800000002'],
  ['officer',    'agriculture_officer',    'Dev@Officer2026!', 'Dev Agriculture Officer', '+9779800000003'],
  ['technician', 'agriculture_technician', 'Dev@Tech2026!',    'Dev Technician',          '+9779800000004'],
  ['iot',        'iot_operator',           'Dev@Iot2026!',     'Dev IoT Operator',        '+9779800000005'],
  ['content',    'content_manager',        'Dev@Content2026!', 'Dev Content Manager',     '+9779800000006'],
  ['farmer1',    'farmer',                 'Dev@Farmer2026!',  'Dev Test Farmer',         '+9779800000007'],
  ['learner',    'learner',                'Dev@Learner2026!', 'Dev Learner',             '+9779800000008']
];

(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: 'utf8mb4' });
  try {
    const [[org]] = await db.query("SELECT id FROM organizations WHERE code = 'ADO-KASKI'");
    if (!org) throw new Error('Run npm run db:seed first.');
    for (const [localId, roleCode, password, name, phone] of USERS) {
      const roleEmail = `${localId}@kaskikotagro.local`;
      const [[role]] = await db.query('SELECT id FROM roles WHERE code = ?', [roleCode]);
      if (!role) { console.log('skip (role missing):', roleCode); continue; }
      const hash = await bcrypt.hash(password, 12);
      const [[match]] = await db.query('SELECT id FROM users WHERE email = ? LIMIT 1', [roleEmail]);
      let id;
      if (match) {
        id = match.id;
        await db.query(
          `UPDATE users SET organization_id = ?, username = ?, email = ?, phone = ?, password_hash = ?, full_name_en = ?,
            status = 'active', email_verified_at = UTC_TIMESTAMP(), phone_verified_at = UTC_TIMESTAMP(),
            approved_at = COALESCE(approved_at, UTC_TIMESTAMP()), failed_login_attempts = 0, locked_until = NULL,
            must_change_password = 0, token_version = token_version + 1 WHERE id = ?`,
          [org.id, roleEmail, roleEmail, phone, hash, name, id]);
      } else {
        const [result] = await db.query(
          `INSERT INTO users (uuid, organization_id, username, email, phone, password_hash, full_name_en,
                              status, must_change_password, email_verified_at, phone_verified_at, approved_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
          [crypto.randomUUID(), org.id, roleEmail, roleEmail, phone, hash, name]);
        id = result.insertId;
      }
      await db.query('INSERT IGNORE INTO user_roles (user_id, role_id, organization_id) VALUES (?, ?, NULL)', [id, role.id]);
      console.log('ok', roleEmail, '->', roleCode);
    }
  } finally { await db.end(); }
})().catch(error => { console.error('FAILED:', error.message); process.exit(1); });
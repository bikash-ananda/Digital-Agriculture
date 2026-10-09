const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const [email, passwordArg, fullName] = process.argv.slice(2);
const validEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 150;
if (!validEmail || !passwordArg || !fullName) {
  console.error('Usage: node database/create-admin.js <email> <password (min 10 chars)|--password-stdin> "<Full Name>"');
  process.exit(1);
}

function readPassword() {
  if (passwordArg !== '--password-stdin') return Promise.resolve(passwordArg);
  process.stdout.write('Password (read from stdin): ');
  return new Promise((resolve) => {
    let input = '';
    const hiddenTerminal = Boolean(process.stdin.isTTY && process.stdin.setRawMode);
    if (hiddenTerminal) process.stdin.setRawMode(true);
    const finish = (value) => {
      if (hiddenTerminal) {
        process.stdin.setRawMode(false);
        process.stdout.write('\n');
      }
      process.stdin.pause();
      resolve(value);
    };
    const onData = (chunk) => {
      input += chunk;
      const newline = input.search(/[\r\n]/);
      if (newline !== -1) {
        process.stdin.off('data', onData);
        finish(input.slice(0, newline));
      }
    };
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
    process.stdin.once('end', () => finish(input.replace(/[\r\n]+$/, '')));
  });
}

(async () => {
  const password = await readPassword();
  if (!password || password.length < 10) throw new Error('Password must be at least 10 characters.');

  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: 'utf8mb4'
  });

  try {
    const [[org]] = await db.query("SELECT id FROM organizations WHERE code = 'ADO-KASKI'");
    const [[role]] = await db.query("SELECT id FROM roles WHERE code = 'super_admin'");
    if (!org || !role) throw new Error('Run npm run db:seed first.');

    const [matches] = await db.query(
      'SELECT id FROM users WHERE username = ? OR email = ? ORDER BY id LIMIT 2',
      [email, email]
    );
    if (matches.length > 1) throw new Error('The email and username belong to different accounts.');

    const hash = await bcrypt.hash(password, 12);
    await db.beginTransaction();
    let userId;
    if (matches.length) {
      userId = matches[0].id;
      await db.query(
        `UPDATE users SET organization_id = ?, username = ?, email = ?, password_hash = ?, full_name_en = ?,
         status = 'active', failed_login_attempts = 0, locked_until = NULL, must_change_password = 0 WHERE id = ?`,
        [org.id, email, email, hash, fullName, userId]
      );
    } else {
      const [result] = await db.query(
        `INSERT INTO users (uuid, organization_id, username, email, password_hash, full_name_en, status, must_change_password)
         VALUES (?, ?, ?, ?, ?, ?, 'active', 0)`,
        [crypto.randomUUID(), org.id, email, email, hash, fullName]
      );
      userId = result.insertId;
    }
    const [[existingRole]] = await db.query(
      'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ? AND organization_id IS NULL LIMIT 1',
      [userId, role.id]
    );
    if (!existingRole) {
      await db.query(
        'INSERT INTO user_roles (user_id, role_id, organization_id) VALUES (?, ?, NULL)',
        [userId, role.id]
      );
    }
    await db.commit();
    console.log(`Super Administrator ${matches.length ? 'updated' : 'created'}: ${email}`);
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

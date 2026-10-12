// Bootstrap or update the first super administrator from the trusted local server console.
// Email/phone ownership is confirmed by the operator during this one-time setup.
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { checkPassword } = require('../src/utils/passwordPolicy');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
const flag = (name) => args.includes(`--${name}`);
const email = String(opt('email') || process.env.SUPER_ADMIN_EMAIL || 'bikashengineering100@gmail.com').trim().toLowerCase();
const phone = String(opt('phone') || process.env.SUPER_ADMIN_PHONE || '').trim();
const name = String(opt('name') || process.env.SUPER_ADMIN_NAME || 'System Administrator').trim();
const username = email;
const update = flag('update');
const ifMissing = flag('if-missing');

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = false;
    rl._writeToOutput = (value) => { if (rl.stdoutMuted && value !== question) rl.output.write('*'); else rl.output.write(value); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
    rl.stdoutMuted = true;
  });
}

(async () => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+[1-9]\d{7,14}$/.test(phone) || name.length < 2) {
    console.error('Set SUPER_ADMIN_EMAIL, SUPER_ADMIN_PHONE and SUPER_ADMIN_NAME in backend/.env, or pass --email, --phone and --name.');
    process.exit(1);
  }
  const password = process.env.SA_PASSWORD || (await ask('Initial password (hidden): '));
  const problems = checkPassword(password, { username, email });
  if (problems.length) { console.error(`That password is not accepted:\n - ${problems.join('\n - ')}`); process.exit(1); }

  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: 'utf8mb4' });
  try {
    const [[org]] = await db.query("SELECT id FROM organizations WHERE code = 'ADO-KASKI'");
    const [[role]] = await db.query("SELECT id FROM roles WHERE code = 'super_admin'");
    if (!org || !role) throw new Error('Run database migrations and the base seed first.');

    const hash = await bcrypt.hash(password, 12);
    const [[byEmail]] = await db.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    const [[byName]] = await db.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    if (byName && (!byEmail || byName.id !== byEmail.id)) throw new Error('That email login ID already belongs to another account.');

    let id;
    if (byEmail) {
      if (ifMissing) { console.log('Super-admin already exists; leaving its password unchanged.'); return; }
      if (!update) throw new Error(`An account with ${email} already exists. Add --update to reset it.`);
      id = byEmail.id;
      await db.query(
        `UPDATE users SET username = ?, phone = ?, password_hash = ?, full_name_en = ?, position_title = 'System Administrator',
          status = 'active', must_change_password = 1, email_verified_at = UTC_TIMESTAMP(), phone_verified_at = UTC_TIMESTAMP(),
          approved_at = COALESCE(approved_at, UTC_TIMESTAMP()), failed_login_attempts = 0, locked_until = NULL,
          password_changed_at = UTC_TIMESTAMP(), token_version = token_version + 1 WHERE id = ?`,
        [username, phone, hash, name, id]);
      console.log(`Updated super-admin account (id ${id}).`);
    } else {
      const [result] = await db.query(
        `INSERT INTO users (uuid, organization_id, username, email, phone, password_hash, full_name_en,
                            position_title, status, must_change_password, email_verified_at, phone_verified_at, approved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'System Administrator', 'active', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        [crypto.randomUUID(), org.id, username, email, phone, hash, name]);
      id = result.insertId;
      console.log(`Created super-admin account (id ${id}).`);
    }
    await db.query('INSERT IGNORE INTO user_roles (user_id, role_id, organization_id) VALUES (?, ?, NULL)', [id, role.id]);
    console.log(`Super-admin login ID: ${email}\nThe initial password must be changed at first sign-in.`);
    console.log('This trusted bootstrap step marks the supplied email and mobile as verified. Confirm ownership before running it.');
  } finally { await db.end(); }
})().catch((error) => { console.error('SUPER-ADMIN BOOTSTRAP FAILED:', error.message); process.exitCode = 1; });
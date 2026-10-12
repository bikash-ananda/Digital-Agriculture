const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const mailer = require('../services/mailer');
const sms = require('../services/sms');
const { checkPassword } = require('../utils/passwordPolicy');
const { logAudit } = require('../utils/audit');

const EMAIL_OTP_MINUTES = 10;
const WHATSAPP_OTP_MINUTES = 1;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_HOUR = 6;
const CODE_SECRET = () => process.env.OTP_SECRET || process.env.JWT_SECRET;
const ALLOWED_ROLES = new Set(['office_admin', 'agriculture_officer', 'agriculture_technician', 'iot_operator', 'content_manager', 'farmer', 'learner', 'super_admin']);
const GENERIC_RESET_MESSAGE = 'If an active account uses that email, a password reset code has been sent.';

function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function normalizePhone(value) {
  let phone = String(value || '').trim().replace(/[\s().-]/g, '');
  if (phone.startsWith('00977')) phone = `+${phone.slice(2)}`;
  if (/^9[78]\d{8}$/.test(phone)) phone = `+977${phone}`;
  if (/^0[9][78]\d{8}$/.test(phone)) phone = `+977${phone.slice(1)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null;
  return phone;
}
function hashCode(userId, purpose, channel, code) {
  return crypto.createHmac('sha256', CODE_SECRET()).update(`${userId}:${purpose}:${channel}:${code}`).digest('hex');
}
function codeMatches(stored, expected) {
  if (!stored || !expected || !/^\d{6}$/.test(String(expected))) return false;
  const a = Buffer.from(stored, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function newCode() { return String(crypto.randomInt(0, 1000000)).padStart(6, '0'); }

async function issueCodes(conn, userId, purpose, channels) {
  const [[recent]] = await conn.query(
    'SELECT COUNT(*) AS n FROM account_otps WHERE user_id = ? AND purpose = ? AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR)',
    [userId, purpose]);
  if (Number(recent.n) >= OTP_MAX_PER_HOUR) return { limited: true, codes: [] };

  const codes = [];
  for (const channel of channels) {
    const minutes = channel === 'phone' ? WHATSAPP_OTP_MINUTES : EMAIL_OTP_MINUTES;
    const code = newCode();
    await conn.query(
      'UPDATE account_otps SET consumed_at = UTC_TIMESTAMP() WHERE user_id = ? AND purpose = ? AND delivery_channel = ? AND consumed_at IS NULL',
      [userId, purpose, channel]);
    await conn.query(
      'INSERT INTO account_otps (user_id, purpose, delivery_channel, code_hash, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))',
      [userId, purpose, channel, hashCode(userId, purpose, channel, code), minutes]);
    codes.push({ channel, code, minutes });
  }
  return { limited: false, codes };
}

async function deliverCodes(user, purpose, codes) {
  const delivered = await Promise.all(codes.map(async ({ channel, code, minutes }) => {
    const result = channel === 'email'
      ? await mailer.sendOtp({ to: user.email, code, purpose, minutes })
      : await sms.sendOtp({ to: user.phone, code, purpose, minutes });
    return [channel, result.mode || (result.sent ? 'sent' : 'failed')];
  }));
  return Object.fromEntries(delivered);
}

function duplicateEmail(res) { return res.status(409).json({ message: 'An account already uses this email. Sign in or use password recovery.' }); }

async function createPendingAccount({ email, phone, fullName, password, roleCode, forceChange }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const normalized = normalizeEmail(email);
    const mobile = normalizePhone(phone);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw Object.assign(new Error('Enter a valid email address'), { status: 400 });
    if (!mobile) throw Object.assign(new Error('Enter a valid mobile number with country code'), { status: 400 });
    const problems = checkPassword(String(password || ''), { username: normalized, email: normalized });
    if (problems.length) throw Object.assign(new Error('Password does not meet the requirements'), { status: 400, errors: problems });

    const [[existing]] = await conn.query('SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1 FOR UPDATE', [normalized, normalized]);
    if (existing) throw Object.assign(new Error('An account already uses this email'), { code: 'ER_DUP_ENTRY' });
    const [[role]] = await conn.query('SELECT id FROM roles WHERE code = ? LIMIT 1', [roleCode]);
    if (!role) throw Object.assign(new Error('Account roles are not initialized. Run the base database seed first.'), { status: 503 });
    const [[org]] = await conn.query("SELECT id FROM organizations WHERE code = 'ADO-KASKI' LIMIT 1");
    const passwordHash = await bcrypt.hash(password, 12);
    const [insert] = await conn.query(
      `INSERT INTO users (uuid, organization_id, username, email, phone, password_hash, full_name_en,
                          status, must_change_password, email_verified_at, phone_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL, NULL)`,
      [crypto.randomUUID(), org?.id || null, normalized, normalized, mobile, passwordHash, fullName, forceChange ? 1 : 0]);
    await conn.query('INSERT INTO user_roles (user_id, role_id, organization_id) VALUES (?, ?, NULL)', [insert.insertId, role.id]);
    const issued = await issueCodes(conn, insert.insertId, 'registration', ['email', 'phone']);
    await conn.commit();
    return { user: { id: insert.insertId, email: normalized, phone: mobile, fullName }, codes: issued.codes, limited: issued.limited };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally { conn.release(); }
}

exports.register = async (req, res, next) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    if (fullName.length < 2 || fullName.length > 150) return res.status(400).json({ message: 'Enter your full name' });
    const created = await createPendingAccount({
      email: req.body.email, phone: req.body.phone, fullName, password: req.body.password,
      roleCode: 'farmer', forceChange: false
    });
    const delivery = created.limited ? {} : await deliverCodes(created.user, 'registration', created.codes);
    await logAudit(created.user.id, 'account_registered', 'user', created.user.id, null, req);
    return res.status(201).json({
      email: created.user.email,
      message: 'Enter the email and WhatsApp codes. The WhatsApp code expires in 1 minute; the email code expires in 10 minutes. An administrator must approve your account after both are verified.',
      delivery
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return duplicateEmail(res);
    if (err.status) return res.status(err.status).json({ message: err.message, ...(err.errors ? { errors: err.errors.map(message => ({ message })) } : {}) });
    next(err);
  }
};

exports.verifyRegistration = async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  const submitted = { email: String(req.body.emailCode || '').trim(), phone: String(req.body.phoneCode || '').trim() };
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[user]] = await conn.query(
      'SELECT id, email_verified_at, phone_verified_at, status FROM users WHERE email = ? LIMIT 1 FOR UPDATE', [email]);
    if (!user) { await conn.commit(); return res.status(400).json({ message: 'The codes are invalid or expired. Request new codes.' }); }
    const required = [];
    if (!user.email_verified_at) required.push('email');
    if (!user.phone_verified_at) required.push('phone');
    if (!required.length) { await conn.commit(); return res.json({ verified: true, approved: user.status === 'active', message: 'Your contact details are already verified. An administrator must approve the account.' }); }

    const records = {};
    for (const channel of required) {
      const [[otp]] = await conn.query(
        `SELECT id, code_hash, attempts FROM account_otps
          WHERE user_id = ? AND purpose = 'registration' AND delivery_channel = ?
            AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP()
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [user.id, channel]);
      records[channel] = otp;
    }
    const invalid = required.filter(channel => !records[channel] || Number(records[channel].attempts) >= OTP_MAX_ATTEMPTS || !codeMatches(records[channel].code_hash, submitted[channel]));
    if (invalid.length) {
      for (const channel of invalid) if (records[channel]) {
        const exhausted = Number(records[channel].attempts) + 1 >= OTP_MAX_ATTEMPTS;
        await conn.query('UPDATE account_otps SET attempts = attempts + 1, consumed_at = IF(?, UTC_TIMESTAMP(), consumed_at) WHERE id = ?', [exhausted, records[channel].id]);
      }
      await conn.commit();
      return res.status(400).json({ message: 'The codes are invalid or expired. Check each code or request new ones.' });
    }
    for (const channel of required) await conn.query('UPDATE account_otps SET consumed_at = UTC_TIMESTAMP() WHERE id = ?', [records[channel].id]);
    await conn.query(
      `UPDATE users SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()),
                        phone_verified_at = COALESCE(phone_verified_at, UTC_TIMESTAMP()) WHERE id = ?`, [user.id]);
    await conn.commit();
    await logAudit(user.id, 'account_contacts_verified', 'user', user.id, null, req);
    return res.json({ verified: true, approved: false, message: 'Email and mobile verified. Your account is waiting for administrator approval.' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally { conn.release(); }
};

exports.resendRegistration = async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  try {
    const [[user]] = await db.query('SELECT id, email, phone, email_verified_at, phone_verified_at FROM users WHERE email = ? LIMIT 1', [email]);
    if (!user || (user.email_verified_at && user.phone_verified_at)) {
      return res.json({ message: 'If that account needs verification, new codes will be sent.' });
    }
    const channels = [];
    if (!user.email_verified_at) channels.push('email');
    if (!user.phone_verified_at) channels.push('phone');
    const conn = await db.getConnection();
    let issued;
    try {
      await conn.beginTransaction();
      issued = await issueCodes(conn, user.id, 'registration', channels);
      await conn.commit();
    } catch (err) { await conn.rollback(); throw err; }
    finally { conn.release(); }
    if (issued.limited) return res.status(429).json({ message: 'Too many code requests. Wait before requesting another code.' });
    const delivery = await deliverCodes(user, 'registration', issued.codes);
    return res.json({ message: 'New verification codes have been sent.', delivery });
  } catch (err) { next(err); }
};

exports.forgotPassword = async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  try {
    const [[user]] = await db.query(
      `SELECT id, email, phone, full_name_en FROM users
        WHERE email = ? AND status = 'active' AND email_verified_at IS NOT NULL AND phone_verified_at IS NOT NULL LIMIT 1`, [email]);
    if (user) {
      const conn = await db.getConnection();
      let issued;
      try {
        await conn.beginTransaction();
        issued = await issueCodes(conn, user.id, 'password_reset', ['email']);
        await conn.commit();
      } catch (err) { await conn.rollback(); throw err; }
      finally { conn.release(); }
      if (!issued.limited) await deliverCodes(user, 'password_reset', issued.codes);
    }
    return res.json({ message: GENERIC_RESET_MESSAGE });
  } catch (err) { next(err); }
};

exports.resetPassword = async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').trim();
  const password = String(req.body.password || '');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[user]] = await conn.query('SELECT id, email, username, status FROM users WHERE email = ? LIMIT 1 FOR UPDATE', [email]);
    if (!user || user.status !== 'active') { await conn.commit(); return res.status(400).json({ message: 'The code is invalid or expired. Request a new one.' }); }
    const problems = checkPassword(password, user);
    if (problems.length) { await conn.commit(); return res.status(400).json({ message: 'Password does not meet the requirements', errors: problems.map(message => ({ message })) }); }
    const [[otp]] = await conn.query(
      `SELECT id, code_hash, attempts FROM account_otps
        WHERE user_id = ? AND purpose = 'password_reset' AND delivery_channel = 'email'
          AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP()
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [user.id]);
    if (!otp || Number(otp.attempts) >= OTP_MAX_ATTEMPTS || !codeMatches(otp.code_hash, code)) {
      if (otp) {
        const exhausted = Number(otp.attempts) + 1 >= OTP_MAX_ATTEMPTS;
        await conn.query('UPDATE account_otps SET attempts = attempts + 1, consumed_at = IF(?, UTC_TIMESTAMP(), consumed_at) WHERE id = ?', [exhausted, otp.id]);
      }
      await conn.commit();
      return res.status(400).json({ message: 'The code is invalid or expired. Request a new one.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await conn.query('UPDATE account_otps SET consumed_at = UTC_TIMESTAMP() WHERE id = ?', [otp.id]);
    await conn.query('UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = UTC_TIMESTAMP(), token_version = token_version + 1 WHERE id = ?', [passwordHash, user.id]);
    await conn.commit();
    const [profile] = await db.query('SELECT full_name_en FROM users WHERE id = ?', [user.id]);
    await mailer.send(mailer.passwordChangedEmail({ name: profile[0]?.full_name_en || user.email })).catch(() => {});
    await logAudit(user.id, 'password_reset', 'user', user.id, null, req);
    return res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally { conn.release(); }
};

exports.adminUsers = async (req, res, next) => {
  try {
    const requested = String(req.query.status || 'pending');
    const status = ['pending', 'active', 'inactive', 'all'].includes(requested) ? requested : 'pending';
    const [rows] = await db.query(
      `SELECT u.id, u.full_name_en AS fullName, u.email, u.phone, u.status,
              u.email_verified_at IS NOT NULL AS emailVerified,
              u.phone_verified_at IS NOT NULL AS phoneVerified,
              u.must_change_password AS mustChangePassword, u.created_at AS createdAt,
              GROUP_CONCAT(DISTINCT r.code ORDER BY r.code SEPARATOR ',') AS roles
         FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
        WHERE (? = 'all' OR u.status = ?)
        GROUP BY u.id ORDER BY u.created_at DESC LIMIT 250`, [status, status]);
    res.json({ users: rows.map(user => ({ ...user, emailVerified: !!user.emailVerified, phoneVerified: !!user.phoneVerified, mustChangePassword: !!user.mustChangePassword, roles: user.roles ? user.roles.split(',') : [] })) });
  } catch (err) { next(err); }
};

exports.createUser = async (req, res, next) => {
  if (!req.user.roles.includes('super_admin')) return res.status(403).json({ message: 'Only a super administrator can create accounts.' });
  const fullName = String(req.body.fullName || '').trim();
  const roleCode = String(req.body.roleCode || '');
  if (fullName.length < 2 || fullName.length > 150) return res.status(400).json({ message: 'Enter the user’s full name.' });
  if (!ALLOWED_ROLES.has(roleCode)) return res.status(400).json({ message: 'Choose a valid role.' });
  try {
    const created = await createPendingAccount({
      email: req.body.email, phone: req.body.phone, fullName, password: req.body.password,
      roleCode, forceChange: true
    });
    const delivery = created.limited ? {} : await deliverCodes(created.user, 'registration', created.codes);
    await logAudit(req.user.id, 'account_created', 'user', created.user.id, { roleCode }, req);
    return res.status(201).json({ email: created.user.email, message: 'Account created. The user must verify email and mobile before an administrator can approve it.', delivery });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return duplicateEmail(res);
    if (err.status) return res.status(err.status).json({ message: err.message, ...(err.errors ? { errors: err.errors.map(message => ({ message })) } : {}) });
    next(err);
  }
};

exports.approveUser = async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid account.' });
  if (!req.user.roles.some(role => ['super_admin', 'office_admin'].includes(role))) return res.status(403).json({ message: 'Only an administrator can approve accounts.' });
  try {
    const [result] = await db.query(
      `UPDATE users SET status = 'active', approved_at = UTC_TIMESTAMP(), approved_by = ?
        WHERE id = ? AND status = 'pending' AND email_verified_at IS NOT NULL AND phone_verified_at IS NOT NULL`,
      [req.user.id, id]);
    if (!result.affectedRows) {
      const [[user]] = await db.query('SELECT status, email_verified_at, phone_verified_at FROM users WHERE id = ?', [id]);
      if (!user) return res.status(404).json({ message: 'Account not found.' });
      if (!user.email_verified_at || !user.phone_verified_at) return res.status(409).json({ message: 'Both email and mobile must be verified before approval.' });
      return res.status(409).json({ message: 'This account is no longer awaiting approval.' });
    }
    await logAudit(req.user.id, 'account_approved', 'user', id, null, req);
    res.json({ message: 'Account approved. The user can now sign in.' });
  } catch (err) { next(err); }
};

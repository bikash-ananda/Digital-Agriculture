const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { loadAccess } = require('../services/accessService');
const { logAudit } = require('../utils/audit');
const mailer = require('../services/mailer');
const { checkPassword } = require('../utils/passwordPolicy');

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 8 * 60 * 60 * 1000
});

function setSessionCookie(user, res) {
  const version = Number(user.token_version || 0);
  const token = jwt.sign({ sub: user.id, ver: version }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });
  res.cookie('da_token', token, cookieOptions());
}

exports.login = async (req, res, next) => {
  try {
    const email = String(req.body.email || req.body.username || '').trim().toLowerCase();
    const password = req.body.password;
    const [rows] = await db.query(
      `SELECT id, uuid, username, email, phone, full_name_en, full_name_ne, position_title,
              organization_id, password_hash, status, failed_login_attempts, locked_until,
              must_change_password, email_verified_at, phone_verified_at, token_version
         FROM users WHERE email = ? LIMIT 1`, [email]);
    const user = rows[0];
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    const invalid = () => res.status(401).json({ message: 'Invalid email or password' });

    if (!user || !ok) {
      if (user && (!user.locked_until || new Date(user.locked_until) <= new Date())) {
        const attempts = Number(user.failed_login_attempts || 0) + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await db.query('UPDATE users SET failed_login_attempts = 0, locked_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE) WHERE id = ?', [LOCK_MINUTES, user.id]);
          await logAudit(user.id, 'account_locked', 'user', user.id, null, req);
        } else {
          await db.query('UPDATE users SET failed_login_attempts = ? WHERE id = ?', [attempts, user.id]);
        }
        await logAudit(user.id, 'login_failed', 'user', user.id, null, req);
      } else if (!user) {
        await logAudit(null, 'login_failed', 'user', null, null, req);
      }
      return invalid();
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.max(1, Math.ceil((new Date(user.locked_until) - Date.now()) / 60000));
      return res.status(423).json({ message: `Account temporarily locked. Try again in ${remaining} minute${remaining === 1 ? '' : 's'}.` });
    }
    if (user.status === 'pending') {
      const verified = user.email_verified_at && user.phone_verified_at;
      return res.status(403).json({ message: verified
        ? 'Your contact details are verified. An administrator must approve your account before you can sign in.'
        : 'Verify your email and mobile number before signing in.' });
    }
    if (user.status !== 'active') {
      await logAudit(user.id, 'login_blocked', 'user', user.id, { status: user.status }, req);
      return res.status(403).json({ message: 'This account is not active. Contact an administrator.' });
    }
    if (!user.email_verified_at || !user.phone_verified_at) {
      return res.status(403).json({ message: 'Verify your email and mobile number before signing in.' });
    }

    await db.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP() WHERE id = ?', [user.id]);
    setSessionCookie(user, res);
    await logAudit(user.id, 'login_success', 'user', user.id, null, req);
    const access = await loadAccess(user.id);
    res.json({ user: {
      id: user.id, username: user.username, email: user.email, phone: user.phone,
      fullNameEn: user.full_name_en, fullNameNe: user.full_name_ne,
      mustChangePassword: !!user.must_change_password,
      emailVerified: !!user.email_verified_at, phoneVerified: !!user.phone_verified_at,
      ...access
    } });
  } catch (err) { next(err); }
};

exports.logout = async (req, res, next) => {
  try {
    await db.query('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [req.user.id]);
    res.clearCookie('da_token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    res.json({ message: 'Logged out' });
  } catch (err) { next(err); }
};

exports.me = (req, res) => {
  const u = req.user;
  res.json({ user: {
    id: u.id, username: u.username, email: u.email, phone: u.phone,
    fullNameEn: u.full_name_en, fullNameNe: u.full_name_ne,
    position: u.position_title, organizationId: u.organization_id,
    mustChangePassword: !!u.must_change_password,
    emailVerified: !!u.email_verified_at, phoneVerified: !!u.phone_verified_at,
    roles: u.roles, permissions: u.permissions
  } });
};

exports.changePassword = async (req, res, next) => {
  try {
    const current = String(req.body.current_password || '');
    const nextPassword = String(req.body.new_password || '');
    const [rows] = await db.query('SELECT password_hash, email, username, token_version FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(current, user.password_hash))) return res.status(400).json({ message: 'Current password is incorrect' });
    const problems = checkPassword(nextPassword, user);
    if (problems.length) return res.status(400).json({ message: 'Password does not meet the requirements', errors: problems.map(message => ({ message })) });
    const hash = await bcrypt.hash(nextPassword, 12);
    await db.query('UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = UTC_TIMESTAMP(), token_version = token_version + 1 WHERE id = ?', [hash, req.user.id]);
    setSessionCookie({ id: req.user.id, token_version: Number(user.token_version) + 1 }, res);
    const [profile] = await db.query('SELECT full_name_en FROM users WHERE id = ?', [req.user.id]);
    await mailer.send(mailer.passwordChangedEmail({ name: profile[0]?.full_name_en || user.email })).catch(() => {});
    await logAudit(req.user.id, 'password_changed', 'user', req.user.id, null, req);
    res.json({ message: 'Password changed successfully' });
  } catch (err) { next(err); }
};
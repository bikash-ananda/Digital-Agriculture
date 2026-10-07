const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { loadAccess } = require('../services/accessService');
const { logAudit } = require('../utils/audit');

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 8 * 60 * 60 * 1000
});

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
    const user = rows[0];
    const invalid = () => res.status(401).json({ message: 'Invalid username or password' });

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      await logAudit(null, 'login_failed', 'user', null, { username }, req);
      return invalid();
    }
    if (user.status === 'inactive' || user.status === 'pending') {
      await logAudit(user.id, 'login_blocked', 'user', user.id, { status: user.status }, req);
      return res.status(403).json({ message: 'Account is not active. Contact the office administrator.' });
    }
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ message: `Account temporarily locked. Try again after ${LOCK_MINUTES} minutes.` });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      const attempts = user.failed_login_attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await db.query('UPDATE users SET failed_login_attempts = 0, locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?', [LOCK_MINUTES, user.id]);
        await logAudit(user.id, 'account_locked', 'user', user.id, null, req);
      } else {
        await db.query('UPDATE users SET failed_login_attempts = ? WHERE id = ?', [attempts, user.id]);
      }
      await logAudit(user.id, 'login_failed', 'user', user.id, null, req);
      return invalid();
    }

    await db.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?', [user.id]);
    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    res.cookie('da_token', token, cookieOptions());
    await logAudit(user.id, 'login_success', 'user', user.id, null, req);

    const access = await loadAccess(user.id);
    res.json({
      user: {
        id: user.id, username: user.username, fullNameEn: user.full_name_en, fullNameNe: user.full_name_ne,
        mustChangePassword: !!user.must_change_password, ...access
      }
    });
  } catch (err) { next(err); }
};

exports.logout = async (req, res) => {
  res.clearCookie('da_token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  res.json({ message: 'Logged out' });
};

exports.me = (req, res) => {
  const u = req.user;
  res.json({
    user: {
      id: u.id, username: u.username, email: u.email, fullNameEn: u.full_name_en, fullNameNe: u.full_name_ne,
      position: u.position_title, organizationId: u.organization_id, roles: u.roles, permissions: u.permissions
    }
  });
};

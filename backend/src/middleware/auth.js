const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { loadAccess } = require('../services/accessService');

async function authenticate(req, res, next) {
  try {
    const token = req.cookies && req.cookies.da_token;
    if (!token) return res.status(401).json({ message: 'Authentication required' });

    let payload;
    try { payload = jwt.verify(token, process.env.JWT_SECRET); }
    catch { return res.status(401).json({ message: 'Session expired or invalid' }); }

    const [rows] = await db.query(
      `SELECT id, uuid, username, email, phone, full_name_ne, full_name_en, position_title,
              organization_id, status, token_version, must_change_password,
              email_verified_at, phone_verified_at
         FROM users WHERE id = ? LIMIT 1`, [payload.sub]);
    const user = rows[0];
    if (!user || user.status !== 'active') return res.status(401).json({ message: 'Account not active' });
    if (Number(payload.ver) !== Number(user.token_version)) return res.status(401).json({ message: 'Session revoked' });
    if (user.must_change_password) {
      const path = req.originalUrl.split('?')[0];
      const allowed = ['/api/auth/me', '/api/auth/logout', '/api/auth/change-password'].includes(path);
      if (!allowed) return res.status(403).json({ message: 'Change your temporary password before continuing', code: 'PASSWORD_CHANGE_REQUIRED' });
    }

    const access = await loadAccess(user.id);
    req.user = { ...user, roles: access.roles, permissions: access.permissions };
    next();
  } catch (err) { next(err); }
}

const authorize = (...codes) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  const ok = codes.every(c => req.user.permissions.includes(c));
  if (!ok) return res.status(403).json({ message: 'You do not have permission to perform this action' });
  next();
};

module.exports = { authenticate, authorize };
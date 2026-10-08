const crypto = require('crypto');
const db = require('../config/db');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

module.exports = async (req, res, next) => {
  try {
    const code = req.get('x-device-code');
    const key = req.get('x-device-key');
    if (!code || !key) return res.status(401).json({ message: 'Device credentials required' });

    const [rows] = await db.query(
      'SELECT id, device_code, site_id, growing_unit_id, api_key_hash, status FROM iot_devices WHERE device_code = ? LIMIT 1', [code]);
    const d = rows[0];

    const given = Buffer.from(sha256(key), 'hex');
    const stored = Buffer.from(d && d.api_key_hash ? d.api_key_hash : '0'.repeat(64), 'hex');
    const ok = !!(d && d.api_key_hash) && stored.length === given.length && crypto.timingSafeEqual(stored, given);

    if (!ok) return res.status(401).json({ message: 'Invalid device credentials' });
    if (d.status === 'disabled') return res.status(403).json({ message: 'Device is disabled' });

    req.device = { id: d.id, code: d.device_code, site_id: d.site_id, growing_unit_id: d.growing_unit_id };
    next();
  } catch (e) { next(e); }
};

const db = require('../config/db');

async function logAudit(userId, action, entityType, entityId, details, req) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId || null, action, entityType || null, entityId ? String(entityId) : null,
       details ? JSON.stringify(details) : null,
       req ? req.ip : null, req ? (req.get('user-agent') || '').slice(0, 255) : null]);
  } catch (e) {
    console.error('Audit log failed:', e.message);
  }
}

module.exports = { logAudit };

const db = require('../config/db');

async function loadAccess(userId) {
  const [roles] = await db.query(
    `SELECT DISTINCT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?`, [userId]);
  const [perms] = await db.query(
    `SELECT DISTINCT p.code FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = ?`, [userId]);
  return { roles: roles.map(r => r.code), permissions: perms.map(p => p.code) };
}

module.exports = { loadAccess };

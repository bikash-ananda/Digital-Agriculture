const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const GRANTS = {
  super_admin: ['view', 'manage', 'export'], office_admin: ['view', 'manage', 'export'], agriculture_officer: ['view', 'manage', 'export'],
  iot_operator: ['view', 'manage'], agriculture_technician: ['view']
};
(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  for (const a of ['view', 'manage', 'export']) await db.query('INSERT IGNORE INTO permissions (code, module, action) VALUES (?, ?, ?)', [`research.${a}`, 'research', a]);
  const [perms] = await db.query("SELECT id, code FROM permissions WHERE module = 'research'");
  const pid = Object.fromEntries(perms.map((p) => [p.code, p.id]));
  for (const [role, list] of Object.entries(GRANTS)) {
    const [r] = await db.query('SELECT id FROM roles WHERE code = ?', [role]);
    if (!r[0]) continue;
    for (const a of list) await db.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [r[0].id, pid[`research.${a}`]]);
  }
  console.log('research permissions:', perms.length);
  await db.end();
})().catch((e) => { console.error('SEED FAILED:', e.message); process.exit(1); });

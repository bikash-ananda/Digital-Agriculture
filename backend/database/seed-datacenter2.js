const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  await db.query("INSERT IGNORE INTO permissions (code, module, action) VALUES ('datacenter.import', 'datacenter', 'import')");
  const [[p]] = await db.query("SELECT id FROM permissions WHERE code = 'datacenter.import'");
  for (const role of ['super_admin', 'office_admin', 'agriculture_officer']) {
    const [r] = await db.query('SELECT id FROM roles WHERE code = ?', [role]);
    if (r[0]) await db.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [r[0].id, p.id]);
  }
  console.log('datacenter.import granted to super_admin, office_admin, agriculture_officer');
  await db.end();
})().catch((e) => { console.error('SEED FAILED:', e.message); process.exit(1); });

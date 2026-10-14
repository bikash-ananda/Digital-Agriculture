// Links an ops device id (used by the ESP32) to a platform device, and stores only a hash of its token.
// Usage (on the server):  node database/ops-link.js greenhouse-kaski-01 GH-KASKI-01 --env-file /etc/digital-agriculture/production.env --key THE_VARIABLE_NAME
// Local test only:        node database/ops-link.js greenhouse-demo-01 ESP32-01 --token demo-token-123
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const envFile = opt('--env-file');
const envPath = envFile ? path.resolve(envFile) : path.join(__dirname, '..', '.env');
const envLoad = require('dotenv').config({ path: envPath, override: Boolean(envFile) });
if (envFile && envLoad.error) { console.error('Unable to load env file.'); process.exit(1); }
const [opsId, deviceCode] = args;
let token = opt('--token');
if (!token && opt('--env-file') && opt('--key')) {
  const line = fs.readFileSync(opt('--env-file'), 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${opt('--key')}=`));
  if (line) token = line.slice(opt('--key').length + 1).trim().replace(/^["']|["']$/g, '');
}
if (!opsId || !deviceCode || !token) { console.error('Usage: node database/ops-link.js <ops_id> <device_code> (--env-file FILE --key NAME | --token VALUE)'); process.exit(1); }

(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const [d] = await db.query('SELECT id FROM iot_devices WHERE device_code = ?', [deviceCode]);
  if (!d[0]) { console.error(`No platform device with code ${deviceCode}`); process.exit(1); }
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await db.query('INSERT INTO ops_devices (ops_id, device_id, token_hash) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE device_id = VALUES(device_id), token_hash = VALUES(token_hash)', [opsId, d[0].id, hash]);
  console.log(`Linked ops id "${opsId}" to platform device ${deviceCode} (token stored as a hash).`);
  await db.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });

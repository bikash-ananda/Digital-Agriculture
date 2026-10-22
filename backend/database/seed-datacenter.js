const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PERMS = ['view', 'collect', 'verify', 'export', 'export_identified'];
const GRANTS = {
  super_admin: PERMS, office_admin: PERMS,
  agriculture_officer: ['view', 'collect', 'verify', 'export'],
  agriculture_technician: ['view', 'collect'],
  iot_operator: ['view']
};
// Ward totals are taken from Kaski local-government / PMAMP project information; Madi includes Ward 12.
const WARDS = {
  'Pokhara Metropolitan City': 33, 'Annapurna Rural Municipality': 11, 'Machhapuchchhre Rural Municipality': 9,
  'Madi Rural Municipality': 12, 'Rupa Rural Municipality': 7
};
const CROPS = [
  ['TOMATO', 'गोलभेंडा', 'Tomato', 'vegetable'], ['CUCUMBER', 'काँक्रो', 'Cucumber', 'vegetable'], ['CAPSICUM', 'खुर्सानी (भेडे)', 'Capsicum', 'vegetable'],
  ['CAULIFLOWER', 'काउली', 'Cauliflower', 'vegetable'], ['CABBAGE', 'बन्दागोभी', 'Cabbage', 'vegetable'], ['CORIANDER', 'धनिया', 'Coriander', 'spice'],
  ['ORANGE', 'सुन्तला', 'Orange', 'fruit'], ['DRAGON_FRUIT', 'ड्रागन फल', 'Dragon Fruit', 'fruit'], ['PADDY', 'धान', 'Paddy', 'cereal'], ['MAIZE', 'मकै', 'Maize', 'cereal'],
  ['WHEAT', 'गहुँ', 'Wheat', 'cereal'], ['MILLET', 'कोदो', 'Finger millet', 'cereal'], ['BUCKWHEAT', 'फापर', 'Buckwheat', 'cereal'],
  ['POTATO', 'आलु', 'Potato', 'vegetable'], ['CARROT', 'गाजर', 'Carrot', 'vegetable'], ['RADISH', 'मूला', 'Radish', 'vegetable'],
  ['BRINJAL', 'भण्टा', 'Brinjal', 'vegetable'], ['PUMPKIN', 'फर्सी', 'Pumpkin', 'vegetable'], ['FRENCH_BEAN', 'सिमी', 'French bean', 'vegetable'],
  ['CHILLI', 'खुर्सानी', 'Chilli', 'spice'], ['GINGER', 'अदुवा', 'Ginger', 'spice'], ['TURMERIC', 'बेसार', 'Turmeric', 'spice'],
  ['SOYBEAN', 'भटमास', 'Soybean', 'pulse'], ['COFFEE', 'कफी', 'Coffee', 'cash_crop'], ['MUSTARD', 'तोरी', 'Mustard', 'cash_crop'],
  ['BANANA', 'केरा', 'Banana', 'fruit'], ['MANGO', 'आँप', 'Mango', 'fruit'], ['LEMON', 'कागती', 'Acid lime / lemon', 'fruit'], ['MUSHROOM', 'च्याउ', 'Mushroom', 'other']
];

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: 'utf8mb4'
  });
  for (const a of PERMS) await db.query('INSERT IGNORE INTO permissions (code, module, action) VALUES (?, ?, ?)', [`datacenter.${a}`, 'datacenter', a]);
  const [perms] = await db.query("SELECT id, code FROM permissions WHERE module = 'datacenter'");
  const pid = Object.fromEntries(perms.map((p) => [p.code, p.id]));
  for (const [role, list] of Object.entries(GRANTS)) {
    const [r] = await db.query('SELECT id FROM roles WHERE code = ?', [role]);
    if (!r[0]) continue;
    for (const a of list) await db.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [r[0].id, pid[`datacenter.${a}`]]);
  }
  for (const [name, wards] of Object.entries(WARDS)) await db.query('UPDATE local_levels SET total_wards = ? WHERE name_en = ?', [wards, name]);
  for (const [code, ne, en, cat] of CROPS) await db.query('INSERT IGNORE INTO crops (code, name_ne, name_en, category) VALUES (?, ?, ?, ?)', [code, ne, en, cat]);

  const [[p]] = await db.query("SELECT COUNT(*) AS n FROM permissions WHERE module = 'datacenter'");
  const [[w]] = await db.query('SELECT COUNT(*) AS n FROM local_levels WHERE total_wards IS NOT NULL');
  const [[c]] = await db.query('SELECT COUNT(*) AS n FROM crops');
  console.log(`datacenter permissions: ${p.n} | local levels with wards: ${w.n} | crops: ${c.n}`);
  await db.end();
})().catch((e) => { console.error('SEED FAILED:', e.message); process.exit(1); });

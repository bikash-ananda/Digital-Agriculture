const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CRUD = ['view', 'create', 'update', 'delete'];
const MODULES = {
  dashboard: ['view'],
  farmers: CRUD, farms: CRUD, programs: CRUD,
  notices: [...CRUD, 'publish'], learning: [...CRUD, 'publish'], knowledge: [...CRUD, 'publish', 'discuss'],
  documents: CRUD, smart_farming: CRUD, devices: CRUD,
  irrigation_control: ['view', 'control', 'configure'],
  alerts: ['view', 'acknowledge', 'configure'],
  reports: ['view', 'export'],
  users: CRUD, roles: CRUD, audit: ['view'], settings: ['view', 'update']
};

const ROLES = [
  { code: 'super_admin', ne: 'सुपर प्रशासक', en: 'Super Administrator', grants: ['*'] },
  { code: 'office_admin', ne: 'कार्यालय प्रशासक', en: 'Office Administrator', grants: ['*'], deny: ['roles.*', 'settings.update'] },
  { code: 'agriculture_officer', ne: 'कृषि अधिकृत', en: 'Agriculture Officer',
    grants: ['dashboard.view', 'farmers.*', 'farms.*', 'programs.*', 'notices.view', 'notices.create', 'notices.update', 'documents.*', 'knowledge.view', 'knowledge.create', 'knowledge.discuss', 'learning.view', 'smart_farming.view', 'devices.view', 'irrigation_control.view', 'alerts.view', 'alerts.acknowledge', 'reports.*'],
    deny: ['farmers.delete', 'farms.delete', 'programs.delete', 'documents.delete'] },
  { code: 'agriculture_technician', ne: 'कृषि प्राविधिक', en: 'Agriculture Technician',
    grants: ['dashboard.view', 'farmers.view', 'farmers.create', 'farmers.update', 'farms.view', 'farms.create', 'farms.update', 'programs.view', 'notices.view', 'documents.view', 'knowledge.view', 'knowledge.create', 'knowledge.discuss', 'learning.view', 'smart_farming.view', 'devices.view', 'irrigation_control.view', 'irrigation_control.control', 'alerts.view', 'alerts.acknowledge', 'reports.view'] },
  { code: 'iot_operator', ne: 'स्मार्ट फार्मिङ / आइओटी सञ्चालक', en: 'Smart Farming / IoT Operator',
    grants: ['dashboard.view', 'smart_farming.*', 'devices.*', 'irrigation_control.*', 'alerts.*', 'reports.view', 'reports.export', 'farms.view', 'knowledge.view'] },
  { code: 'content_manager', ne: 'सामग्री व्यवस्थापक', en: 'Content Manager',
    grants: ['dashboard.view', 'notices.*', 'documents.*', 'knowledge.*', 'learning.*', 'programs.view'],
    deny: ['notices.delete', 'documents.delete', 'knowledge.delete', 'learning.delete'] },
  { code: 'farmer', ne: 'कृषक', en: 'Farmer',
    grants: ['dashboard.view', 'farms.view', 'programs.view', 'notices.view', 'learning.view', 'knowledge.view', 'smart_farming.view'] },
  { code: 'learner', ne: 'शिक्षार्थी', en: 'Learner',
    grants: ['dashboard.view', 'learning.view', 'knowledge.view', 'notices.view'] }
];

const match = (code, pat) => pat === '*' || pat === code || (pat.endsWith('.*') && code.startsWith(pat.slice(0, -1)));

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, charset: 'utf8mb4'
  });
  const ins = (t, o) => db.query(`INSERT IGNORE INTO ${t} SET ?`, [o]);
  const idBy = async (t, c, v) => { const [[r]] = await db.query(`SELECT id FROM ${t} WHERE ${c} = ?`, [v]); return r.id; };

  // Permissions
  for (const [m, actions] of Object.entries(MODULES))
    for (const a of actions) await ins('permissions', { code: `${m}.${a}`, module: m, action: a });
  const [perms] = await db.query('SELECT id, code FROM permissions');

  // Roles + role_permissions
  for (const r of ROLES) {
    await ins('roles', { code: r.code, name_ne: r.ne, name_en: r.en, is_system: 1 });
    const rid = await idBy('roles', 'code', r.code);
    for (const p of perms) {
      const allowed = r.grants.some(g => match(p.code, g)) && !(r.deny || []).some(d => match(p.code, d));
      if (allowed) await ins('role_permissions', { role_id: rid, permission_id: p.id });
    }
  }

  // Geography
  await ins('provinces', { code: 'P4', name_ne: 'गण्डकी प्रदेश', name_en: 'Gandaki Province' });
  const prov = await idBy('provinces', 'code', 'P4');
  await ins('districts', { province_id: prov, name_ne: 'कास्की', name_en: 'Kaski' });
  const [[dist]] = await db.query('SELECT id FROM districts WHERE province_id = ? AND name_en = ?', [prov, 'Kaski']);
  const locals = [
    ['metropolitan', 'पोखरा महानगरपालिका', 'Pokhara Metropolitan City'],
    ['rural_municipality', 'अन्नपूर्ण गाउँपालिका', 'Annapurna Rural Municipality'],
    ['rural_municipality', 'माछापुच्छ्रे गाउँपालिका', 'Machhapuchchhre Rural Municipality'],
    ['rural_municipality', 'मादी गाउँपालिका', 'Madi Rural Municipality'],
    ['rural_municipality', 'रुपा गाउँपालिका', 'Rupa Rural Municipality']
  ];
  for (const [t, ne, en] of locals) await ins('local_levels', { district_id: dist.id, level_type: t, name_ne: ne, name_en: en });
  const [[pokhara]] = await db.query('SELECT id FROM local_levels WHERE district_id = ? AND name_en = ?', [dist.id, 'Pokhara Metropolitan City']);

  // Organizations
  await ins('organizations', { org_type: 'ministry', code: 'MOLMAC-GANDAKI', name_ne: 'कृषि, भूमि व्यवस्था तथा सहकारी मन्त्रालय, गण्डकी प्रदेश', name_en: 'Ministry of Agriculture, Land Management and Cooperatives, Gandaki Province' });
  const ministry = await idBy('organizations', 'code', 'MOLMAC-GANDAKI');
  await ins('organizations', { parent_id: ministry, org_type: 'agriculture_office', code: 'ADO-KASKI', name_ne: 'कृषि विकास कार्यालय, कास्की', name_en: 'Agriculture Development Office, Kaski', district_id: dist.id, address: 'पोखरा, कास्की', phone: '061-451250', email: 'adokaski@gmail.com' });
  const ado = await idBy('organizations', 'code', 'ADO-KASKI');
  for (const [ne, en] of [['प्रशासन', 'Administration'], ['लेखा', 'Accounts'], ['बाली विकास', 'Crop Development'], ['बागवानी', 'Horticulture'], ['बाली संरक्षण', 'Plant Protection'], ['कृषि प्रसार', 'Agriculture Extension'], ['स्मार्ट फार्मिङ', 'Smart Farming']])
    await ins('departments', { organization_id: ado, name_ne: ne, name_en: en });

  // Pilot site: Birauta
  await ins('sites', { organization_id: ado, code: 'BIRAUTA-01', name_ne: 'बिरौटा प्रदर्शन स्थल', name_en: 'Birauta Demonstration Site', site_type: 'demonstration', local_level_id: pokhara.id, address: 'बिरौटा, पोखरा, कास्की', latitude: 28.192978, longitude: 83.970814 });
  const site = await idBy('sites', 'code', 'BIRAUTA-01');
  await ins('growing_units', { site_id: site, unit_type: 'greenhouse', code: 'GH-01', name_ne: 'ग्रीनहाउस-०१', name_en: 'Greenhouse-01' });
  const unit = await idBy('growing_units', 'code', 'GH-01');
  await ins('iot_devices', { uuid: crypto.randomUUID(), device_code: 'ESP32-01', site_id: site, growing_unit_id: unit, device_type: 'esp32' });
  const dev = await idBy('iot_devices', 'device_code', 'ESP32-01');

  const [[sc]] = await db.query('SELECT COUNT(*) AS n FROM sensors WHERE device_id = ?', [dev]);
  if (sc.n === 0) {
    const sensors = [
      ['temperature', 'Air Temperature', '°C', -10, 80], ['humidity', 'Relative Humidity', '%', 0, 100],
      ['soil_moisture', 'Soil Moisture', '%', 0, 100], ['ec', 'Electrical Conductivity', 'mS/cm', 0, 20],
      ['light', 'Light Intensity', 'lux', 0, 120000], ['water_level', 'Water Tank Level', '%', 0, 100]
    ];
    for (const [type, name, unitName, min, max] of sensors)
      await ins('sensors', { device_id: dev, growing_unit_id: unit, sensor_type: type, name, unit: unitName, min_valid: min, max_valid: max });
  }
  const [[ac]] = await db.query('SELECT COUNT(*) AS n FROM actuators WHERE device_id = ?', [dev]);
  if (ac.n === 0) {
    await ins('actuators', { device_id: dev, growing_unit_id: unit, actuator_type: 'irrigation', name: 'Irrigation Pump/Valve', max_runtime_seconds: 900 });
    await ins('actuators', { device_id: dev, growing_unit_id: unit, actuator_type: 'misting', name: 'Misting System', max_runtime_seconds: 600 });
  }

  // Crops
  const crops = [
    ['TOMATO', 'गोलभेंडा', 'Tomato', 'vegetable'], ['CUCUMBER', 'काँक्रो', 'Cucumber', 'vegetable'],
    ['CAPSICUM', 'खुर्सानी (भेडे)', 'Capsicum', 'vegetable'], ['CAULIFLOWER', 'काउली', 'Cauliflower', 'vegetable'],
    ['CABBAGE', 'बन्दागोभी', 'Cabbage', 'vegetable'], ['CORIANDER', 'धनिया', 'Coriander', 'spice'],
    ['ORANGE', 'सुन्तला', 'Orange', 'fruit'], ['DRAGON_FRUIT', 'ड्रागन फल', 'Dragon Fruit', 'fruit'],
    ['PADDY', 'धान', 'Paddy', 'cereal'], ['MAIZE', 'मकै', 'Maize', 'cereal']
  ];
  for (const [code, ne, en, cat] of crops) await ins('crops', { code, name_ne: ne, name_en: en, category: cat });

  for (const t of ['permissions', 'roles', 'role_permissions', 'local_levels', 'organizations', 'sites', 'growing_units', 'iot_devices', 'sensors', 'actuators', 'crops']) {
    const [[c]] = await db.query(`SELECT COUNT(*) AS n FROM ${t}`);
    console.log(t.padEnd(18), c.n);
  }
  await db.end();
})().catch(e => { console.error('SEED FAILED:', e.message); process.exit(1); });

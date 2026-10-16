const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const NEW_PERMS = [['analysis','view'],['crop_cycles','view'],['crop_cycles','create'],['crop_cycles','update'],
  ['observations','create'],['automation','view'],['automation','configure'],['cameras','view'],['cameras','manage']];
const GRANTS = {
  super_admin: 'ALL', office_admin: 'ALL', agriculture_officer: 'ALL', iot_operator: 'ALL',
  agriculture_technician: ['analysis.view','crop_cycles.view','crop_cycles.create','crop_cycles.update','observations.create','automation.view','cameras.view'],
  farmer: ['analysis.view','crop_cycles.view','cameras.view']
};

const STAGES = [
  ['seedling', 'बिरुवा चरण', 'Seedling', 'जरा र सुरुवाती पात विकास हुने चरण। मध्यम चिस्यान र हल्का तापक्रम आवश्यक।', 'Root and early leaf development. Needs steady moisture and mild temperatures.'],
  ['vegetative', 'वानस्पतिक वृद्धि', 'Vegetative growth', 'पात र हाँगा तीव्र रूपमा बढ्ने चरण। नाइट्रोजन र नियमित सिँचाइ महत्त्वपूर्ण।', 'Rapid leaf and shoot growth. Nitrogen and regular irrigation are important.'],
  ['flowering', 'फूल फुल्ने चरण', 'Flowering', 'फूल फुल्ने चरण। तापक्रम र आर्द्रता सन्तुलित राख्नुहोस्; अत्यधिक तापले फूल झर्न सक्छ।', 'Flowering. Keep temperature and humidity balanced; extreme heat can cause flower drop.'],
  ['fruiting', 'फल लाग्ने चरण', 'Fruiting', 'फल बन्ने र बढ्ने चरण। पोटास, क्यालसियम र नियमित पानी आवश्यक।', 'Fruit set and sizing. Potassium, calcium and consistent water are needed.'],
  ['harvest', 'फल टिप्ने चरण', 'Harvest', 'फल टिप्ने चरण। नियमित टिप्नुहोस् र रोग/कीरा निगरानी गर्नुहोस्।', 'Harvesting. Pick regularly and keep monitoring pests and diseases.']
];

const CROPS = {
  GENERIC: { ne: 'सामान्य ग्रीनहाउस बाली', en: 'General greenhouse crop', cat: 'other', base: 10,
    days: [[0,20],[21,45],[46,65],[66,100],[101,150]],
    ne_d: 'ग्रीनहाउस/टनेलमा उत्पादन गरिने सामान्य बाली। निश्चित बाली छनोट नभएसम्म सामान्य सन्दर्भ मानहरू प्रयोग हुन्छन्।',
    en_d: 'A general greenhouse crop. Generic reference ranges are used until a specific crop is selected.',
    t: { temperature: [10,18,28,35], humidity: [40,55,80,92], soil_moisture: [20,40,70,90], soil_temperature: [10,16,26,32], ec: [0.3,1.0,2.5,4.0], vpd: [0.2,0.6,1.2,2.0], dli: [6,12,25,40] } },
  TOMATO: { ne: 'गोलभेंडा', en: 'Tomato', cat: 'vegetable', base: 10,
    days: [[0,25],[26,45],[46,65],[66,110],[111,180]],
    ne_d: 'गोलभेंडा ग्रीनहाउस/टनेलमा बेमौसमी उत्पादन गर्न उपयुक्त फलफूल-तरकारी बाली हो। स्थिर तापक्रम, नियमित सिँचाइ र राम्रो हावा आवतजावतले उत्पादन र रोग नियन्त्रणमा सहयोग गर्छ।',
    en_d: 'Tomato is a fruiting vegetable well suited to off-season production in greenhouses and tunnels. Stable temperature, regular irrigation and good ventilation support yield and disease control.',
    t: { temperature: [12,20,27,34], humidity: [45,60,80,90], soil_moisture: [25,45,70,90], soil_temperature: [12,18,24,30], ec: [0.5,2.0,3.5,5.0], vpd: [0.3,0.8,1.2,1.8], dli: [10,18,30,45] } },
  CUCUMBER: { ne: 'काँक्रो', en: 'Cucumber', cat: 'vegetable', base: 15,
    days: [[0,14],[15,30],[31,40],[41,60],[61,100]],
    ne_d: 'काँक्रो छिटो बढ्ने न्यानो मौसमे बाली हो। उच्च आर्द्रता र नियमित पानी मन मर्छ, तर पातमा ओसिलोपन हुँदा रोग लाग्न सक्छ।',
    en_d: 'Cucumber is a fast-growing warm-season crop. It likes high humidity and regular water, but wet foliage can invite disease.',
    t: { temperature: [14,22,28,35], humidity: [50,70,85,92], soil_moisture: [30,50,75,90], soil_temperature: [14,20,25,30], ec: [0.5,1.7,2.5,4.0], vpd: [0.3,0.7,1.1,1.6], dli: [8,15,25,40] } },
  CAPSICUM: { ne: 'खुर्सानी (भेडे)', en: 'Capsicum', cat: 'vegetable', base: 10,
    days: [[0,35],[36,60],[61,80],[81,110],[111,200]],
    ne_d: 'भेडे खुर्सानी (क्याप्सिकम) ग्रीनहाउसमा राम्रो उत्पादन दिने बाली हो। अति गर्मी वा चिसोले फूल झर्न सक्छ, त्यसैले तापक्रम स्थिर राख्नुहोस्।',
    en_d: 'Capsicum performs well under protection. Very hot or cold spells can cause flower drop, so keep temperature stable.',
    t: { temperature: [12,20,26,33], humidity: [45,60,80,90], soil_moisture: [25,45,65,85], soil_temperature: [12,18,24,30], ec: [0.5,1.5,2.5,4.0], vpd: [0.3,0.8,1.2,1.8], dli: [8,15,25,40] } }
};

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: 'utf8mb4'
  });

  for (const [m, a] of NEW_PERMS)
    await db.query('INSERT IGNORE INTO permissions (code, module, action) VALUES (?, ?, ?)', [`${m}.${a}`, m, a]);
  const [perms] = await db.query('SELECT id, code FROM permissions');
  const pid = Object.fromEntries(perms.map((p) => [p.code, p.id]));
  const allCodes = NEW_PERMS.map(([m, a]) => `${m}.${a}`);
  for (const [role, grant] of Object.entries(GRANTS)) {
    const [[r]] = await db.query('SELECT id FROM roles WHERE code = ?', [role]);
    if (!r) continue;
    for (const c of (grant === 'ALL' ? allCodes : grant))
      await db.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [r.id, pid[c]]);
  }

  for (const [code, c] of Object.entries(CROPS)) {
    await db.query(
      `INSERT INTO crops (code, name_ne, name_en, category, base_temp_c, description_ne, description_en) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE base_temp_c = VALUES(base_temp_c), description_ne = VALUES(description_ne), description_en = VALUES(description_en)`,
      [code, c.ne, c.en, c.cat, c.base, c.ne_d, c.en_d]);
    const [[row]] = await db.query('SELECT id FROM crops WHERE code = ?', [code]);
    for (let i = 0; i < STAGES.length; i++) {
      const [sc, nne, nen, dne, den] = STAGES[i];
      await db.query(
        `INSERT INTO crop_stages (crop_id, stage_code, sort_order, name_ne, name_en, start_day, end_day, description_ne, description_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE start_day = VALUES(start_day), end_day = VALUES(end_day), description_ne = VALUES(description_ne), description_en = VALUES(description_en)`,
        [row.id, sc, i + 1, nne, nen, c.days[i][0], c.days[i][1], dne, den]);
    }
    for (const [param, v] of Object.entries(c.t)) {
      await db.query(
        `INSERT INTO crop_stage_targets (crop_id, stage_code, parameter, min_value, opt_min, opt_max, max_value) VALUES (?, 'all', ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE min_value = VALUES(min_value), opt_min = VALUES(opt_min), opt_max = VALUES(opt_max), max_value = VALUES(max_value)`,
        [row.id, param, v[0], v[1], v[2], v[3]]);
    }
  }

  // Physical sensors, relays, and cameras are registered only after an operator
  // confirms installed hardware. A database seed must never invent hardware state.

  for (const t of ['crop_stages', 'crop_stage_targets', 'sensors', 'actuators', 'cameras', 'role_permissions']) {
    const [[c]] = await db.query(`SELECT COUNT(*) AS n FROM ${t}`);
    console.log(t.padEnd(20), c.n);
  }
  await db.end();
})().catch((e) => { console.error('SEED FAILED:', e.message); process.exit(1); });

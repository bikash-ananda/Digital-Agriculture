const crypto = require('crypto');

function fiscalYearOf(date = new Date()) {
  const y = date.getFullYear();
  const afterShrawan = date.getMonth() > 6 || (date.getMonth() === 6 && date.getDate() >= 17);
  const bs = afterShrawan ? y + 57 : y + 56;
  return `${bs}/${String(bs + 1).slice(-2)}`;
}

function isValidFiscalYear(s) {
  const m = /^(\d{4})\/(\d{2})$/.exec(String(s));
  if (!m) return false;
  const a = Number(m[1]);
  return a >= 2060 && a <= 2200 && (a + 1) % 100 === Number(m[2]);
}

const COMPLETENESS = `(
  (f.phone IS NOT NULL) * 10 + (f.local_level_id IS NOT NULL) * 10 + (f.ward_no IS NOT NULL) * 5
  + (f.gender IS NOT NULL) * 5 + (f.date_of_birth IS NOT NULL) * 5 + (f.national_farmer_id IS NOT NULL) * 5
  + (f.farmer_category IS NOT NULL) * 5 + (f.household_members IS NOT NULL) * 5
  + EXISTS(SELECT 1 FROM farms x WHERE x.farmer_id = f.id AND x.area_sqm > 0) * 15
  + EXISTS(SELECT 1 FROM farms x WHERE x.farmer_id = f.id AND x.latitude IS NOT NULL) * 5
  + EXISTS(SELECT 1 FROM crop_production cp JOIN farms x ON x.id = cp.farm_id WHERE x.farmer_id = f.id) * 20
  + (f.consent_data_use = 1) * 5 + (f.verification_status = 'verified') * 5
)`;

const ROW_SELECT = `f.id, f.farmer_code, f.full_name_en, f.full_name_ne, f.phone, f.local_level_id, f.ward_no, f.gender,
  f.date_of_birth, f.national_farmer_id, f.farmer_category, f.household_members, f.consent_data_use, f.verification_status,
  ${COMPLETENESS} AS completeness,
  EXISTS(SELECT 1 FROM farms x WHERE x.farmer_id = f.id) AS has_farm,
  EXISTS(SELECT 1 FROM farms x WHERE x.farmer_id = f.id AND x.area_sqm > 0) AS has_area,
  EXISTS(SELECT 1 FROM farms x WHERE x.farmer_id = f.id AND x.latitude IS NOT NULL) AS has_geo,
  EXISTS(SELECT 1 FROM crop_production cp JOIN farms x ON x.id = cp.farm_id WHERE x.farmer_id = f.id) AS has_prod`;

function missingOf(r) {
  const m = [];
  const add = (key, ne, en) => m.push({ key, ne, en });
  if (!r.phone) add('phone', 'फोन', 'Phone');
  if (!r.local_level_id) add('local_level', 'स्थानीय तह', 'Local level');
  if (!r.ward_no) add('ward', 'वडा', 'Ward');
  if (!r.gender) add('gender', 'लिङ्ग', 'Gender');
  if (!r.date_of_birth) add('dob', 'जन्म मिति', 'Date of birth');
  if (!r.national_farmer_id) add('national_id', 'राष्ट्रिय कृषक ID', 'National farmer ID');
  if (!r.farmer_category) add('category', 'कृषक वर्ग', 'Category');
  if (!r.household_members) add('household', 'परिवार संख्या', 'Household size');
  if (!r.has_farm) add('farm', 'फार्म', 'Farm');
  else {
    if (!r.has_area) add('area', 'फार्मको क्षेत्रफल', 'Farm area');
    if (!r.has_geo) add('gps', 'GPS स्थान', 'GPS location');
  }
  if (!r.has_prod) add('production', 'उत्पादन विवरण', 'Production record');
  if (!r.consent_data_use) add('consent', 'सहमति', 'Consent');
  if (r.verification_status !== 'verified') add('verification', 'प्रमाणीकरण', 'Verification');
  return m;
}

function pseudo(prefix, id) {
  return prefix + crypto.createHmac('sha256', process.env.EXPORT_SECRET).update(`${prefix}:${id}`).digest('hex').slice(0, 10);
}

function ageBand(dob) {
  if (!dob) return '';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '';
  const age = Math.floor((Date.now() - d.getTime()) / 31557600000);
  return age < 30 ? '<30' : age < 45 ? '30-44' : age < 60 ? '45-59' : '60+';
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows, columns) {
  const body = rows.map((r) => columns.map((c) => csvCell(r[c])).join(','));
  return '\uFEFF' + [columns.join(','), ...body].join('\r\n');
}

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

module.exports = { fiscalYearOf, isValidFiscalYear, COMPLETENESS, ROW_SELECT, missingOf, pseudo, ageBand, toCsv, median };

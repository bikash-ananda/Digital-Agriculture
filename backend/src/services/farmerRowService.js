const ROPANI = 508.737;
const AANA = ROPANI / 16;
const PAISA = AANA / 4;
const DAM = PAISA / 4;
const BOX = { latMin: 27.95, latMax: 28.7, lonMin: 83.65, lonMax: 84.35 };

const toAscii = (s) => String(s).replace(/[०-९]/g, (d) => '०१२३४५६७८९'.indexOf(d));
const txt = (v) => (v === undefined || v === null ? '' : String(v).trim());
const norm = (s) => toAscii(txt(s)).toLowerCase().replace(/ू/g, 'ु').replace(/ी/g, 'ि').replace(/\s+/g, ' ');
const mk = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [norm(k), v]));
const same = (list) => Object.fromEntries(list.map((x) => [norm(x), x]));

const GENDER = mk({ male: 'male', m: 'male', 'पुरुष': 'male', female: 'female', f: 'female', 'महिला': 'female', other: 'other', 'अन्य': 'other' });
const TYPE = mk({ individual: 'individual', group: 'group', cooperative: 'cooperative', company: 'company', private_farm: 'private_farm', 'व्यक्तिगत': 'individual', 'समूह': 'group', 'सहकारी': 'cooperative', 'कम्पनी': 'company' });
const CATEGORY = mk({ subsistence: 'subsistence', small: 'small', medium: 'medium', large: 'large', 'जीविकोपार्जन': 'subsistence', 'साना': 'small', 'मध्यम': 'medium', 'ठूलो': 'large', 'ठूला': 'large' });
const OCC = same(['agriculture', 'livestock', 'agri_business', 'service', 'foreign_employment', 'business', 'other']);
const OWN = same(['owned', 'leased', 'shared', 'government']);
const IRR = same(['none', 'rainfed', 'drip', 'sprinkler', 'canal', 'other']);

function pickEnum(value, map, label, errors, def = null) {
  if (!value) return def;
  const v = map[norm(value)];
  if (!v) { errors.push(`Unknown ${label} "${value}"`); return def; }
  return v;
}

function matchLevel(text, levels) {
  const q = norm(text);
  if (!q) return null;
  return levels.find((l) => [l.name_en, l.name_ne, l.name_en.split(' ')[0], l.name_ne.split(' ')[0]].some((a) => norm(a) === q)) || null;
}

function prepareRow(raw, levels) {
  const r = {};
  Object.keys(raw || {}).forEach((k) => { r[k] = txt(raw[k]); });
  const errors = [];
  const warnings = [];
  const f = {};

  f.full_name_en = r.full_name_en || null;
  f.full_name_ne = r.full_name_ne || null;
  if (!f.full_name_en && !f.full_name_ne) errors.push('Name is required (full_name_en or full_name_ne)');
  else if (!f.full_name_en) { f.full_name_en = f.full_name_ne; warnings.push('English name missing - the Nepali name was used for both'); }
  if (f.full_name_en && f.full_name_en.length > 150) errors.push('Name is longer than 150 characters');

  f.gender = pickEnum(r.gender, GENDER, 'gender', errors);

  f.date_of_birth = null;
  if (r.date_of_birth) {
    const s = toAscii(r.date_of_birth);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    const d = m ? new Date(`${s}T00:00:00Z`) : null;
    if (!m || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) errors.push('Date of birth must be an AD date like 1985-04-23');
    else {
      const age = (Date.now() - d.getTime()) / 31557600000;
      if (age < 0) errors.push('Date of birth is in the future - dates must be AD, not BS');
      else { if (age < 10 || age > 110) warnings.push('Date of birth gives an unusual age'); f.date_of_birth = s; }
    }
  }

  f.phone = null;
  if (r.phone) {
    let digits = toAscii(r.phone).replace(/[^\d]/g, '');
    if (digits.startsWith('977') && digits.length >= 12) digits = digits.slice(3);
    if (digits.length < 7 || digits.length > 12) errors.push('Phone number must have 7 to 12 digits');
    else {
      f.phone = digits;
      if (!/^9[78]\d{8}$/.test(digits) && !/^0\d{7,10}$/.test(digits)) warnings.push('Phone number format looks unusual for Nepal');
    }
  }

  f.email = null;
  if (r.email) { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email) || r.email.length > 150) errors.push('Invalid email address'); else f.email = r.email; }

  f.local_level_id = null;
  let level = null;
  if (r.local_level_id) level = levels.find((l) => String(l.id) === r.local_level_id) || null;
  else if (r.local_level) level = matchLevel(r.local_level, levels);
  if (r.local_level_id || r.local_level) {
    if (!level) errors.push(`Unknown local level "${r.local_level_id || r.local_level}" (use Pokhara, Annapurna, Machhapuchchhre, Madi or Rupa)`);
    else f.local_level_id = level.id;
  } else warnings.push('Local level is missing');

  f.ward_no = null;
  if (r.ward_no) {
    const w = Number(toAscii(r.ward_no));
    if (!Number.isInteger(w) || w < 1 || w > 35) errors.push('Ward must be a whole number from 1 to 35');
    else { f.ward_no = w; if (level && level.total_wards && w > level.total_wards) warnings.push(`Ward ${w} exceeds the ${level.total_wards} wards recorded for this local level`); }
  }

  f.address = r.address ? r.address.slice(0, 255) : null;
  f.group_name = r.group_name ? r.group_name.slice(0, 150) : null;
  f.farmer_type = pickEnum(r.farmer_type, TYPE, 'farmer_type', errors, 'individual');
  f.farmer_category = pickEnum(r.farmer_category, CATEGORY, 'farmer_category', errors);
  f.main_occupation = pickEnum(r.main_occupation, OCC, 'main_occupation', errors);
  f.national_farmer_id = r.national_farmer_id ? r.national_farmer_id.slice(0, 30) : null;
  if (r.national_farmer_id && r.national_farmer_id.length > 30) errors.push('National farmer ID is longer than 30 characters');

  f.household_members = null;
  if (r.household_members) {
    const h = Number(toAscii(r.household_members));
    if (!Number.isInteger(h) || h < 1 || h > 60) errors.push('Household members must be a whole number from 1 to 60'); else f.household_members = h;
  }

  let farm = null;
  const farmKeys = ['farm_name', 'farm_area_ropani', 'farm_area_aana', 'farm_area_paisa', 'farm_area_dam', 'farm_area_sqm', 'ownership_type', 'irrigation_type', 'latitude', 'longitude'];
  if (farmKeys.some((k) => r[k])) {
    const num = (k, max) => {
      if (!r[k]) return 0;
      const v = Number(toAscii(r[k]));
      if (!Number.isFinite(v) || v < 0 || v > max) { errors.push(`${k} must be a number between 0 and ${max}`); return 0; }
      return v;
    };
    let sqm = null;
    if (r.farm_area_sqm) sqm = num('farm_area_sqm', 1e8);
    else if (r.farm_area_ropani || r.farm_area_aana || r.farm_area_paisa || r.farm_area_dam) {
      sqm = num('farm_area_ropani', 100000) * ROPANI + num('farm_area_aana', 15.999) * AANA + num('farm_area_paisa', 3.999) * PAISA + num('farm_area_dam', 3.999) * DAM;
    }
    if (sqm !== null) {
      sqm = Math.round(sqm * 100) / 100;
      if (sqm === 0) sqm = null;
      else if (sqm > 1e6) warnings.push('Farm area is over 100 hectares - please check the units');
    }
    let lat = null;
    let lon = null;
    if (r.latitude || r.longitude) {
      lat = Number(toAscii(r.latitude));
      lon = Number(toAscii(r.longitude));
      if (!r.latitude || !r.longitude || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) { errors.push('Enter a valid latitude and longitude together'); lat = null; lon = null; }
      else if (lat < BOX.latMin || lat > BOX.latMax || lon < BOX.lonMin || lon > BOX.lonMax) warnings.push('Coordinates fall outside the approximate Kaski district area');
    }
    farm = {
      name: (r.farm_name || 'Main farm').slice(0, 200), area_sqm: sqm,
      ownership_type: pickEnum(r.ownership_type, OWN, 'ownership_type', errors, 'owned'),
      irrigation_type: pickEnum(r.irrigation_type, IRR, 'irrigation_type', errors, 'none'),
      latitude: lat, longitude: lon
    };
  }
  return { errors, warnings, farmer: f, farm };
}

async function findDuplicates(db, orgId, list) {
  const phones = [...new Set(list.map((f) => f.phone).filter(Boolean))];
  const ids = [...new Set(list.map((f) => f.national_farmer_id).filter(Boolean))];
  const names = [...new Set(list.map((f) => f.full_name_en).filter(Boolean))];
  const byPhone = {};
  const byId = {};
  const byName = {};
  if (phones.length) {
    const [rows] = await db.query('SELECT id, farmer_code, full_name_en, full_name_ne, phone FROM farmers WHERE organization_id = ? AND phone IN (?)', [orgId, phones]);
    rows.forEach((x) => { (byPhone[x.phone] = byPhone[x.phone] || []).push(x); });
  }
  if (ids.length) {
    const [rows] = await db.query('SELECT id, farmer_code, national_farmer_id FROM farmers WHERE organization_id = ? AND national_farmer_id IN (?)', [orgId, ids]);
    rows.forEach((x) => { byId[x.national_farmer_id] = x; });
  }
  if (names.length) {
    const [rows] = await db.query('SELECT id, farmer_code, full_name_en, local_level_id, ward_no FROM farmers WHERE organization_id = ? AND full_name_en IN (?)', [orgId, names]);
    rows.forEach((x) => { const k = norm(x.full_name_en); (byName[k] = byName[k] || []).push(x); });
  }
  return list.map((f) => {
    const out = { hard: null, soft: [] };
    if (f.national_farmer_id && byId[f.national_farmer_id]) out.hard = { id: byId[f.national_farmer_id].id, farmer_code: byId[f.national_farmer_id].farmer_code, reason: 'same national farmer ID' };
    (byPhone[f.phone] || []).forEach((x) => {
      const sameName = norm(x.full_name_en) === norm(f.full_name_en) || (f.full_name_ne && x.full_name_ne === f.full_name_ne);
      if (sameName && !out.hard) out.hard = { id: x.id, farmer_code: x.farmer_code, reason: 'same phone and name' };
      else if (!sameName) out.soft.push(`Phone is also used by ${x.farmer_code} (${x.full_name_en})`);
    });
    if (!out.hard) {
      (byName[norm(f.full_name_en)] || []).filter((x) => x.local_level_id === f.local_level_id && x.ward_no === f.ward_no && f.ward_no)
        .forEach((x) => out.soft.push(`Same name and ward as ${x.farmer_code}`));
    }
    return out;
  });
}

module.exports = { prepareRow, findDuplicates, norm, toAscii };

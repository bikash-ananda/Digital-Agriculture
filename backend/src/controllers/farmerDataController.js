const db = require('../config/db');
const crypto = require('crypto');
const { logAudit } = require('../utils/audit');
const S = require('../services/dataCenterService');

const isSuper = (req) => req.user.roles.includes('super_admin');
const clean = (v) => (v === '' || v === undefined ? null : v);
const pick = (src, keys) => { const o = {}; keys.forEach((k) => { if (src[k] !== undefined) o[k] = clean(src[k]); }); return o; };
const bool = (v) => (v === true || v === 'true' || v === 1 || v === '1' ? 1 : 0);
const pad = (n, w) => String(n).padStart(w, '0');
const tmp = () => `T-${crypto.randomBytes(8).toString('hex')}`;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const notFound = (res, what) => res.status(404).json({ message: `${what} not found` });
const BOX = { latMin: 27.95, latMax: 28.7, lonMin: 83.65, lonMax: 84.35 };
const outsideKaski = (lat, lon) => lat < BOX.latMin || lat > BOX.latMax || lon < BOX.lonMin || lon > BOX.lonMax;
const reopen = (id) => db.query("UPDATE farmers SET verification_status = 'submitted', verified_at = NULL, verified_by = NULL WHERE id = ? AND verification_status = 'verified'", [id]);

async function loadFarmer(req, id) {
  let sql = 'SELECT * FROM farmers WHERE id = ?';
  const params = [id];
  if (!isSuper(req)) { sql += ' AND organization_id = ?'; params.push(req.user.organization_id); }
  const [rows] = await db.query(`${sql} LIMIT 1`, params);
  return rows[0];
}

async function loadFarm(req, id) {
  let sql = `SELECT fm.*, f.organization_id AS farmer_org, f.full_name_en AS farmer_name
               FROM farms fm JOIN farmers f ON f.id = fm.farmer_id WHERE fm.id = ?`;
  const params = [id];
  if (!isSuper(req)) { sql += ' AND f.organization_id = ?'; params.push(req.user.organization_id); }
  const [rows] = await db.query(`${sql} LIMIT 1`, params);
  return rows[0];
}

async function wardWarning(localLevelId, ward) {
  if (!localLevelId || !ward) return null;
  const [rows] = await db.query('SELECT total_wards FROM local_levels WHERE id = ?', [localLevelId]);
  const ll = rows[0];
  if (ll && ll.total_wards && Number(ward) > ll.total_wards) return `Ward ${ward} exceeds the ${ll.total_wards} wards recorded for this local level - please check`;
  return null;
}

// ---------- extended profile, consent, verification ----------
const PROFILE_KEYS = ['farmer_type', 'national_farmer_id', 'farmer_category', 'member_count', 'household_members', 'agri_workers',
  'education_level', 'farming_experience_years', 'main_occupation', 'income_band', 'uses_smartphone', 'collection_method'];

exports.updateProfile = async (req, res, next) => {
  try {
    const f = await loadFarmer(req, req.params.id);
    if (!f) return notFound(res, 'Farmer');
    const data = pick(req.body, PROFILE_KEYS);
    ['farmer_type', 'collection_method'].forEach((k) => { if (data[k] === null) delete data[k]; });
    ['farmer_type', 'collection_method'].forEach((k) => { if (data[k] === null) delete data[k]; });
    if (data.uses_smartphone !== undefined && data.uses_smartphone !== null) data.uses_smartphone = bool(data.uses_smartphone);

    const touchesConsent = req.body.consent_data_use !== undefined || req.body.consent_research !== undefined;
    if (touchesConsent) {
      const cd = req.body.consent_data_use !== undefined ? bool(req.body.consent_data_use) : f.consent_data_use;
      const cr = req.body.consent_research !== undefined ? bool(req.body.consent_research) : f.consent_research;
      if (cr && !cd) return res.status(400).json({ message: 'Research consent requires general data-use consent' });
      if (cd !== f.consent_data_use || cr !== f.consent_research) {
        Object.assign(data, { consent_data_use: cd, consent_research: cr, consent_recorded_at: new Date(), consent_recorded_by: req.user.id });
        await logAudit(req.user.id, 'consent_update', 'farmer', f.id, { data_use: cd, research: cr }, req);
      }
    }
    if (!Object.keys(data).length) return res.status(400).json({ message: 'No changes supplied' });
    await db.query('UPDATE farmers SET ? WHERE id = ?', [data, f.id]);
    await reopen(f.id);
    await logAudit(req.user.id, 'farmer_profile_update', 'farmer', f.id, { fields: Object.keys(data) }, req);
    res.json({ message: 'Profile updated' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'This national farmer ID is already registered to another farmer' });
    next(e);
  }
};

exports.setVerification = async (req, res, next) => {
  try {
    const f = await loadFarmer(req, req.params.id);
    if (!f) return notFound(res, 'Farmer');
    const { status } = req.body;
    const note = clean(req.body.note);
    if (['verified', 'rejected', 'draft'].includes(status) && !req.user.permissions.includes('datacenter.verify'))
      return res.status(403).json({ message: 'Only a verifier can set this status' });
    if (status === 'rejected' && !note) return res.status(400).json({ message: 'A note is required when rejecting' });
    const verified = status === 'verified';
    await db.query('UPDATE farmers SET verification_status = ?, verification_note = ?, verified_at = ?, verified_by = ? WHERE id = ?',
      [status, note, verified ? new Date() : null, verified ? req.user.id : null, f.id]);
    await logAudit(req.user.id, `farmer_${status}`, 'farmer', f.id, { note }, req);
    res.json({ message: 'Status updated', status });
  } catch (e) { next(e); }
};

exports.summary = async (req, res, next) => {
  try {
    const f = await loadFarmer(req, req.params.id);
    if (!f) return notFound(res, 'Farmer');
    const [rows] = await db.query(`SELECT ${S.ROW_SELECT} FROM farmers f WHERE f.id = ?`, [f.id]);
    const fy = S.fiscalYearOf();
    const [[p]] = await db.query(
      `SELECT COUNT(*) AS records, COALESCE(SUM(cp.production_kg), 0) AS kg FROM crop_production cp
         JOIN farms fm ON fm.id = cp.farm_id WHERE fm.farmer_id = ? AND cp.fiscal_year = ?`, [f.id, fy]);
    const [[c]] = await db.query(
      `SELECT (SELECT COUNT(*) FROM farms WHERE farmer_id = ?) AS farms,
              (SELECT COUNT(*) FROM iot_devices d JOIN farms fm ON fm.id = d.farm_id WHERE fm.farmer_id = ?) AS devices`, [f.id, f.id]);
    res.json({ completeness: Number(rows[0].completeness), missing: S.missingOf(rows[0]), fiscal_year: fy, production: p, counts: c });
  } catch (e) { next(e); }
};

// ---------- farm details ----------
const FARM_KEYS = ['name', 'area_sqm', 'ownership_type', 'irrigation_type', 'land_use', 'soil_type', 'water_source', 'irrigated_area_sqm',
  'altitude_m', 'terrace_farming', 'road_access', 'distance_to_market_km', 'organic_certified', 'latitude', 'longitude', 'local_level_id', 'ward_no', 'address'];

exports.updateFarm = async (req, res, next) => {
  try {
    const farm = await loadFarm(req, req.params.farmId);
    if (!farm) return notFound(res, 'Farm');
    const d = pick(req.body, FARM_KEYS);
    ['ownership_type', 'irrigation_type', 'land_use'].forEach((k) => { if (d[k] === null) delete d[k]; });
    ['ownership_type', 'irrigation_type', 'land_use'].forEach((k) => { if (d[k] === null) delete d[k]; });
    ['terrace_farming', 'organic_certified'].forEach((k) => { if (d[k] !== undefined && d[k] !== null) d[k] = bool(d[k]); });
    if (d.name === null) return res.status(400).json({ message: 'Farm name cannot be empty' });
    const area = d.area_sqm !== undefined ? d.area_sqm : farm.area_sqm;
    if (d.irrigated_area_sqm && area && Number(d.irrigated_area_sqm) > Number(area) * 1.001)
      return res.status(400).json({ message: 'Irrigated area cannot exceed the farm area' });
    const lat = d.latitude !== undefined ? d.latitude : farm.latitude;
    const lon = d.longitude !== undefined ? d.longitude : farm.longitude;
    if ((lat === null) !== (lon === null)) return res.status(400).json({ message: 'Enter both latitude and longitude' });
    const warnings = [];
    if (lat !== null && outsideKaski(Number(lat), Number(lon))) warnings.push('Coordinates fall outside the approximate Kaski district area - please verify');
    const ww = await wardWarning(d.local_level_id !== undefined ? d.local_level_id : farm.local_level_id, d.ward_no !== undefined ? d.ward_no : farm.ward_no);
    if (ww) warnings.push(ww);
    if (!Object.keys(d).length) return res.status(400).json({ message: 'No changes supplied' });
    await db.query('UPDATE farms SET ? WHERE id = ?', [d, farm.id]);
    await reopen(farm.farmer_id);
    await logAudit(req.user.id, 'farm_details_update', 'farm', farm.id, { fields: Object.keys(d) }, req);
    res.json({ message: 'Farm updated', warnings });
  } catch (e) { next(e); }
};

// ---------- records: production, livestock, inputs, assets ----------
const CONFIG = {
  production: { table: 'crop_production', keys: ['crop_id', 'growing_unit_id', 'fiscal_year', 'season', 'production_system', 'variety', 'seed_source', 'area_sqm', 'plant_count', 'bearing_plants', 'planting_date', 'harvest_start', 'harvest_end', 'production_kg', 'loss_kg', 'loss_cause', 'sold_kg', 'avg_price_npr_per_kg', 'market_channel', 'organic_status', 'status', 'notes'] },
  livestock: { table: 'livestock_holdings', keys: ['animal_type', 'breed', 'head_count', 'pond_area_sqm', 'purpose', 'annual_output_qty', 'output_unit', 'fiscal_year'] },
  inputs: { table: 'farm_inputs', keys: ['crop_id', 'fiscal_year', 'input_type', 'product_name', 'quantity', 'unit', 'cost_npr', 'source', 'applied_on'] },
  assets: { table: 'farm_assets', keys: ['asset_type', 'quantity', 'area_sqm', 'year_installed', 'condition_status', 'support_source', 'notes'] }
};

function fyCheck(d) {
  if (!d.fiscal_year) d.fiscal_year = S.fiscalYearOf();
  return S.isValidFiscalYear(d.fiscal_year) ? null : 'Invalid fiscal year (use the format 2083/84)';
}

const PREP = {
  async production(d, farm) {
    if (!d.fiscal_year) d.fiscal_year = S.fiscalYearOf(new Date(d.harvest_end || d.planting_date || Date.now()));
    const bad = fyCheck(d);
    if (bad) return { error: bad };
    const prod = Number(d.production_kg || 0);
    const used = Number(d.sold_kg || 0) + Number(d.loss_kg || 0);
    if (used > 0 && (d.production_kg === null || d.production_kg === undefined || used > prod * 1.001 + 0.001))
      return { error: 'Enter total production; sold + loss cannot exceed it' };
    if (d.planting_date && d.harvest_end && new Date(d.planting_date) > new Date(d.harvest_end)) return { error: 'Planting date must be before harvest end' };
    if (d.harvest_start && d.harvest_end && new Date(d.harvest_start) > new Date(d.harvest_end)) return { error: 'Harvest start must be before harvest end' };
    if (d.bearing_plants && d.plant_count && Number(d.bearing_plants) > Number(d.plant_count)) return { error: 'Bearing plants cannot exceed total plants' };
    if (d.growing_unit_id) {
      const [u] = await db.query('SELECT id FROM growing_units WHERE id = ? AND farm_id = ?', [d.growing_unit_id, farm.id]);
      if (!u.length) return { error: 'Growing unit does not belong to this farm' };
    }
    const warnings = [];
    if (d.area_sqm && farm.area_sqm && Number(d.area_sqm) > Number(farm.area_sqm) * 1.001) warnings.push('Crop area is larger than the registered farm area - please check');
    return { warnings };
  },
  async livestock(d) {
    const bad = fyCheck(d);
    if (bad) return { error: bad };
    if (d.animal_type !== 'fish_pond') d.pond_area_sqm = null;
    return {};
  },
  async inputs(d) { const bad = fyCheck(d); return bad ? { error: bad } : {}; },
  async assets() { return {}; }
};

const makeAdder = (kind) => async (req, res, next) => {
  try {
    const farm = await loadFarm(req, req.params.farmId);
    if (!farm) return notFound(res, 'Farm');
    const cfg = CONFIG[kind];
    const d = pick(req.body, cfg.keys);
    const out = await PREP[kind](d, farm);
    if (out.error) return res.status(400).json({ message: out.error });
    Object.keys(d).forEach((k) => { if (d[k] === null) delete d[k]; });
    Object.keys(d).forEach((k) => { if (d[k] === null) delete d[k]; });
    const [r] = await db.query(`INSERT INTO ${cfg.table} SET ?`, [{ ...d, farm_id: farm.id, recorded_by: req.user.id }]);
    await logAudit(req.user.id, `${kind}_create`, 'farm', farm.id, { record_id: r.insertId }, req);
    res.status(201).json({ id: r.insertId, warnings: out.warnings || [] });
  } catch (e) { next(e); }
};
exports.addProduction = makeAdder('production');
exports.addLivestock = makeAdder('livestock');
exports.addInputs = makeAdder('inputs');
exports.addAssets = makeAdder('assets');

const LISTS = {
  production: `SELECT cp.*, fm.name AS farm_name, c.name_ne AS crop_ne, c.name_en AS crop_en,
      CASE WHEN cp.area_sqm > 0 AND cp.production_kg IS NOT NULL THEN ROUND(cp.production_kg / (cp.area_sqm / 10000), 0) END AS yield_kg_ha
    FROM crop_production cp JOIN farms fm ON fm.id = cp.farm_id JOIN crops c ON c.id = cp.crop_id
    WHERE fm.farmer_id = ? ORDER BY cp.fiscal_year DESC, cp.id DESC LIMIT 500`,
  livestock: `SELECT lh.*, fm.name AS farm_name FROM livestock_holdings lh JOIN farms fm ON fm.id = lh.farm_id
    WHERE fm.farmer_id = ? ORDER BY lh.fiscal_year DESC, lh.id DESC LIMIT 500`,
  inputs: `SELECT fi.*, fm.name AS farm_name, c.name_ne AS crop_ne, c.name_en AS crop_en FROM farm_inputs fi
    JOIN farms fm ON fm.id = fi.farm_id LEFT JOIN crops c ON c.id = fi.crop_id
    WHERE fm.farmer_id = ? ORDER BY fi.fiscal_year DESC, fi.id DESC LIMIT 500`,
  assets: `SELECT fa.*, fm.name AS farm_name FROM farm_assets fa JOIN farms fm ON fm.id = fa.farm_id
    WHERE fm.farmer_id = ? ORDER BY fa.id DESC LIMIT 500`
};

const makeLister = (kind) => async (req, res, next) => {
  try {
    const f = await loadFarmer(req, req.params.id);
    if (!f) return notFound(res, 'Farmer');
    const [rows] = await db.query(LISTS[kind], [f.id]);
    res.json(rows);
  } catch (e) { next(e); }
};
exports.listProduction = makeLister('production');
exports.listLivestock = makeLister('livestock');
exports.listInputs = makeLister('inputs');
exports.listAssets = makeLister('assets');

exports.removeRecord = async (req, res, next) => {
  try {
    const cfg = CONFIG[req.params.type];
    if (!cfg) return notFound(res, 'Record type');
    const [rows] = await db.query(`SELECT id, farm_id FROM ${cfg.table} WHERE id = ?`, [req.params.rid]);
    if (!rows[0]) return notFound(res, 'Record');
    const farm = await loadFarm(req, rows[0].farm_id);
    if (!farm) return notFound(res, 'Record');
    await db.query(`DELETE FROM ${cfg.table} WHERE id = ?`, [rows[0].id]);
    await logAudit(req.user.id, `${req.params.type}_delete`, 'farm', farm.id, { record_id: rows[0].id }, req);
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
};

// ---------- IoT devices on farmer farms ----------
exports.listDevices = async (req, res, next) => {
  try {
    const f = await loadFarmer(req, req.params.id);
    if (!f) return notFound(res, 'Farmer');
    const [rows] = await db.query(
      `SELECT d.id, d.device_code, d.device_type, d.ownership, d.status, d.last_seen_at, d.installed_at, d.growing_unit_id,
              CASE WHEN d.status = 'disabled' THEN 'disabled' WHEN d.last_seen_at IS NULL THEN 'registered'
                   WHEN d.last_seen_at < (NOW() - INTERVAL 5 MINUTE) THEN 'offline' ELSE 'online' END AS live_status,
              fm.id AS farm_id, fm.name AS farm_name, gu.name_en AS unit_name,
              (SELECT COUNT(*) FROM sensors s WHERE s.device_id = d.id) AS sensor_count,
              (SELECT COUNT(*) FROM actuators a WHERE a.device_id = d.id) AS actuator_count
         FROM iot_devices d JOIN farms fm ON fm.id = d.farm_id LEFT JOIN growing_units gu ON gu.id = d.growing_unit_id
        WHERE fm.farmer_id = ? ORDER BY d.id`, [f.id]);
    res.json(rows);
  } catch (e) { next(e); }
};

const PRESETS = {
  starter: [['temperature', 'Air Temperature', '°C', -10, 80], ['humidity', 'Relative Humidity', '%', 0, 100], ['soil_moisture', 'Soil Moisture', '%', 0, 100]],
  extended: [['temperature', 'Air Temperature', '°C', -10, 80], ['humidity', 'Relative Humidity', '%', 0, 100], ['soil_moisture', 'Soil Moisture', '%', 0, 100],
    ['ec', 'Electrical Conductivity', 'mS/cm', 0, 20], ['light', 'Light Intensity', 'lux', 0, 120000], ['water_level', 'Water Tank Level', '%', 0, 100]]
};

exports.provisionDevice = async (req, res, next) => {
  const farm = await loadFarm(req, req.params.farmId).catch(() => null);
  if (!farm) return notFound(res, 'Farm');
  const b = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    let siteId = farm.site_id;
    if (!siteId) {
      const label = `${farm.farmer_name} - ${farm.name}`.slice(0, 200);
      const [s] = await conn.query('INSERT INTO sites SET ?', [{
        organization_id: farm.farmer_org || req.user.organization_id, code: tmp(), name_en: label, name_ne: label, site_type: 'farm',
        local_level_id: farm.local_level_id, ward_no: farm.ward_no, address: farm.address, latitude: farm.latitude, longitude: farm.longitude
      }]);
      siteId = s.insertId;
      await conn.query('UPDATE sites SET code = ? WHERE id = ?', [`SITE-${pad(siteId, 4)}`, siteId]);
      await conn.query('UPDATE farms SET site_id = ? WHERE id = ?', [siteId, farm.id]);
    }
    let unitId = null;
    if (bool(b.create_unit)) {
      const [u] = await conn.query('INSERT INTO growing_units SET ?', [{
        site_id: siteId, farm_id: farm.id, unit_type: b.unit_type || 'greenhouse', code: tmp(), name_en: b.unit_name || `${farm.name} unit`
      }]);
      unitId = u.insertId;
      await conn.query('UPDATE growing_units SET code = ? WHERE id = ?', [`GU-${pad(unitId, 6)}`, unitId]);
    } else if (b.growing_unit_id) {
      const [u] = await conn.query('SELECT id FROM growing_units WHERE id = ? AND site_id = ?', [b.growing_unit_id, siteId]);
      if (!u.length) { await conn.rollback(); return res.status(400).json({ message: 'Growing unit does not belong to this farm' }); }
      unitId = u[0].id;
    }
    const apiKey = crypto.randomBytes(24).toString('hex');
    const [d] = await conn.query('INSERT INTO iot_devices SET ?', [{
      uuid: crypto.randomUUID(), device_code: b.device_code, site_id: siteId, growing_unit_id: unitId, farm_id: farm.id,
      ownership: b.ownership || 'office', device_type: b.device_type || 'esp32', api_key_hash: sha256(apiKey), installed_at: clean(b.installed_at)
    }]);
    for (const [type, name, unit, min, max] of PRESETS[b.preset] || [])
      await conn.query('INSERT INTO sensors SET ?', [{ device_id: d.insertId, growing_unit_id: unitId, sensor_type: type, name, unit, min_valid: min, max_valid: max }]);
    await conn.commit();
    await logAudit(req.user.id, 'farm_device_provision', 'farm', farm.id, { device_code: b.device_code, ownership: b.ownership || 'office' }, req);
    res.status(201).json({ id: d.insertId, device_code: b.device_code, api_key: apiKey, site_id: siteId, unit_id: unitId });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Device code already exists' });
    next(e);
  } finally { conn.release(); }
};








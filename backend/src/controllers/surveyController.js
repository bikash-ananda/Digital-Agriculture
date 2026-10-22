const db = require('../config/db');
const crypto = require('crypto');
const { logAudit } = require('../utils/audit');
const R = require('../services/farmerRowService');
const S = require('../services/dataCenterService');

const pad = (n, w) => String(n).padStart(w, '0');
const SYSTEM = ['open_field', 'greenhouse', 'tunnel', 'nursery', 'orchard', 'terrace', 'hydroponic', 'other'];
const SEASON = ['spring', 'summer', 'winter', 'perennial', 'year_round'];
const ANIMAL = ['cattle', 'buffalo', 'goat', 'sheep', 'pig', 'poultry_layer', 'poultry_broiler', 'duck', 'fish_pond', 'beehive', 'other'];
const bad = (res, messages, status = 400) => res.status(status).json({ message: 'Please fix the problems below', errors: messages.map((m) => ({ field: 'survey', message: m })) });

exports.submit = async (req, res, next) => {
  let conn;
  try {
    const b = req.body;
    const orgId = req.user.organization_id;
    if (!orgId) return res.status(400).json({ message: 'Your account is not linked to an office' });
    if (!b.consent || b.consent.data_use !== true) return res.status(400).json({ message: 'The farmer’s consent for data use is required to register them' });

    const [existing] = await db.query('SELECT id, farmer_code FROM farmers WHERE survey_uuid = ?', [b.client_uuid]);
    if (existing[0]) return res.json({ id: existing[0].id, farmer_code: existing[0].farmer_code, repeated: true });

    const [levels] = await db.query('SELECT id, name_ne, name_en, total_wards FROM local_levels');
    const fm = b.farm || {};
    const fr = b.farmer || {};
    const p = R.prepareRow({
      ...fr, farm_name: fm.name || 'Main farm', farm_address: fm.address,
      farm_area_sqm: fm.area_sqm, ownership_type: fm.ownership_type, irrigation_type: fm.irrigation_type,
      land_use: fm.land_use, soil_type: fm.soil_type, water_source: fm.water_source,
      irrigated_area_sqm: fm.irrigated_area_sqm, altitude_m: fm.altitude_m,
      terrace_farming: fm.terrace_farming, road_access: fm.road_access,
      distance_to_market_km: fm.distance_to_market_km,
      latitude: fm.latitude, longitude: fm.longitude, gps_accuracy_m: fm.gps_accuracy_m ?? fm.accuracy, location_source: fm.location_source
    }, levels);
    if (!p.farmer.local_level_id) p.errors.push('Local level is required');
    if (!p.farmer.ward_no) p.errors.push('Ward is required');

    const crops = (b.crops || []).filter((c) => c && c.crop_id);
    const livestock = (b.livestock || []).filter((l) => l && l.animal_type);
    if (crops.length) {
      const [found] = await db.query('SELECT id FROM crops WHERE id IN (?)', [crops.map((c) => Number(c.crop_id)).filter(Number.isInteger)]);
      const ok = new Set(found.map((x) => x.id));
      crops.forEach((c, i) => {
        if (!ok.has(Number(c.crop_id))) p.errors.push(`Crop ${i + 1}: unknown crop`);
        if (c.production_system && !SYSTEM.includes(c.production_system)) p.errors.push(`Crop ${i + 1}: invalid production system`);
        if (c.season && !SEASON.includes(c.season)) p.errors.push(`Crop ${i + 1}: invalid season`);
        if (c.area_sqm !== '' && c.area_sqm !== undefined && (!(Number(c.area_sqm) >= 0) || Number(c.area_sqm) > 1e8)) p.errors.push(`Crop ${i + 1}: invalid area`);
        if (c.production_kg !== '' && c.production_kg !== undefined && (!(Number(c.production_kg) >= 0) || Number(c.production_kg) > 1e9)) p.errors.push(`Crop ${i + 1}: invalid production`);
      });
    }
    livestock.forEach((l, i) => {
      if (!ANIMAL.includes(l.animal_type)) p.errors.push(`Livestock ${i + 1}: invalid animal type`);
      if (!Number.isInteger(Number(l.head_count)) || Number(l.head_count) < 0 || Number(l.head_count) > 1e7) p.errors.push(`Livestock ${i + 1}: invalid count`);
    });
    if (p.errors.length) return bad(res, p.errors);

    const [dup] = await R.findDuplicates(db, orgId, [p.farmer]);
    if (dup.hard) return res.status(409).json({ message: `This farmer is already registered as ${dup.hard.farmer_code} (${dup.hard.reason})`, duplicate: dup.hard });
    if (dup.soft.length && !b.confirm_duplicate) return res.status(409).json({ message: 'This may be a duplicate. Confirm only if this is a different person.', needs_confirmation: true, soft: dup.soft });

    const fy = S.fiscalYearOf();
    conn = await db.getConnection();
    await conn.beginTransaction();
    const [fres] = await conn.query('INSERT INTO farmers SET ?', [{
      ...p.farmer, farmer_code: `T-${crypto.randomBytes(8).toString('hex')}`, organization_id: orgId, created_by: req.user.id, collection_method: 'field_survey', verification_status: 'submitted',
      consent_data_use: 1, consent_research: b.consent.research === true ? 1 : 0, consent_recorded_at: new Date(), consent_recorded_by: req.user.id, survey_uuid: b.client_uuid
    }]);
    const code = `FRM-${pad(fres.insertId, 6)}`;
    await conn.query('UPDATE farmers SET farmer_code = ? WHERE id = ?', [code, fres.insertId]);
    const [farm] = await conn.query('INSERT INTO farms SET ?', [{
      ...p.farm, farmer_id: fres.insertId, local_level_id: p.farmer.local_level_id, ward_no: p.farmer.ward_no,
    }]);
    for (const c of crops) {
      await conn.query('INSERT INTO crop_production SET ?', [{
        farm_id: farm.insertId, crop_id: Number(c.crop_id), fiscal_year: fy, season: c.season || 'summer', production_system: c.production_system || 'open_field',
        area_sqm: c.area_sqm === '' || c.area_sqm === undefined ? null : Number(c.area_sqm), production_kg: c.production_kg === '' || c.production_kg === undefined ? null : Number(c.production_kg),
        status: c.production_kg ? 'harvested' : 'growing', recorded_by: req.user.id
      }]);
    }
    for (const l of livestock) {
      await conn.query('INSERT INTO livestock_holdings SET ?', [{ farm_id: farm.insertId, animal_type: l.animal_type, head_count: Number(l.head_count) || 0, fiscal_year: fy, recorded_by: req.user.id }]);
    }
    await conn.commit();
    await logAudit(req.user.id, 'survey_submit', 'farmer', fres.insertId, { code, crops: crops.length, livestock: livestock.length }, req);
    res.status(201).json({ id: fres.insertId, farmer_code: code, farm_id: farm.insertId, warnings: p.warnings });
  } catch (e) {
    if (conn) await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'This survey or national farmer ID was already submitted' });
    next(e);
  } finally { if (conn) conn.release(); }
};

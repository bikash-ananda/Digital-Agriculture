const db = require('../config/db');
const { logAudit } = require('../utils/audit');
const S = require('../services/dataCenterService');

const isSuper = (req) => req.user.roles.includes('super_admin');
const scope = (req, col) => (isSuper(req) ? { sql: '', params: [] } : { sql: ` AND ${col} = ?`, params: [req.user.organization_id] });
const fyOf = (req) => (req.query.fy && S.isValidFiscalYear(req.query.fy) ? req.query.fy : S.fiscalYearOf());
const n = (v) => Number(v || 0);
const YIELD = `COALESCE(SUM(CASE WHEN cp.area_sqm > 0 AND cp.production_kg IS NOT NULL THEN cp.production_kg END), 0) AS yield_kg,
  COALESCE(SUM(CASE WHEN cp.area_sqm > 0 AND cp.production_kg IS NOT NULL THEN cp.area_sqm END), 0) AS yield_area_sqm`;
const FROM_PROD = 'FROM crop_production cp JOIN farms fm ON fm.id = cp.farm_id JOIN farmers f ON f.id = fm.farmer_id';
const yieldHa = (r) => (n(r.yield_area_sqm) > 0 ? Math.round(n(r.yield_kg) / (n(r.yield_area_sqm) / 10000)) : null);

exports.overview = async (req, res, next) => {
  try {
    const fy = fyOf(req);
    const sf = scope(req, 'f.organization_id');
    const ss = scope(req, 's.organization_id');
    const [[t]] = await db.query(
      `SELECT COUNT(*) AS total, SUM(f.status = 'active') AS active, SUM(f.verification_status = 'verified') AS verified,
              SUM(f.consent_research = 1) AS consent_research, SUM(f.consent_data_use = 1) AS consent_data,
              SUM(f.gender = 'female') AS female, SUM(f.gender = 'male') AS male, ROUND(AVG(${S.COMPLETENESS})) AS completeness
         FROM farmers f WHERE 1 = 1${sf.sql}`, sf.params);
    const [byCategory] = await db.query(`SELECT COALESCE(f.farmer_category, 'unclassified') AS k, COUNT(*) AS n FROM farmers f WHERE f.status = 'active'${sf.sql} GROUP BY k ORDER BY n DESC`, sf.params);
    const [byType] = await db.query(`SELECT f.farmer_type AS k, COUNT(*) AS n FROM farmers f WHERE f.status = 'active'${sf.sql} GROUP BY k ORDER BY n DESC`, sf.params);
    const [[fm]] = await db.query(
      `SELECT COUNT(*) AS farms, COALESCE(SUM(fm.area_sqm), 0) AS area_sqm, COALESCE(SUM(fm.latitude IS NOT NULL), 0) AS geo
         FROM farms fm JOIN farmers f ON f.id = fm.farmer_id WHERE 1 = 1${sf.sql}`, sf.params);
    const [[p]] = await db.query(
      `SELECT COUNT(*) AS records, COUNT(DISTINCT cp.crop_id) AS crops, COALESCE(SUM(cp.production_kg), 0) AS kg,
              COALESCE(SUM(cp.area_sqm), 0) AS area_sqm ${FROM_PROD} WHERE cp.fiscal_year = ?${sf.sql}`, [fy, ...sf.params]);
    const [[d]] = await db.query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(d.farm_id IS NOT NULL), 0) AS at_farms, COUNT(DISTINCT d.farm_id) AS farms_covered,
              COALESCE(SUM(d.last_seen_at >= (NOW() - INTERVAL 5 MINUTE)), 0) AS online
         FROM iot_devices d JOIN sites s ON s.id = d.site_id WHERE d.status <> 'disabled'${ss.sql}`, ss.params);
    const [fys] = await db.query(`SELECT DISTINCT cp.fiscal_year ${FROM_PROD} WHERE 1 = 1${sf.sql} ORDER BY cp.fiscal_year DESC`, sf.params);
    res.json({
      fiscal_year: fy, fiscal_years: fys.map((x) => x.fiscal_year),
      farmers: { total: n(t.total), active: n(t.active), verified: n(t.verified), consent_research: n(t.consent_research), consent_data: n(t.consent_data), female: n(t.female), male: n(t.male), completeness: n(t.completeness) },
      by_category: byCategory, by_type: byType,
      farms: { count: n(fm.farms), area_sqm: n(fm.area_sqm), with_gps: n(fm.geo) },
      production: { records: n(p.records), crops: n(p.crops), kg: n(p.kg), area_sqm: n(p.area_sqm) },
      devices: { total: n(d.total), at_farms: n(d.at_farms), farms_covered: n(d.farms_covered), online: n(d.online) }
    });
  } catch (e) { next(e); }
};

exports.localLevels = async (req, res, next) => {
  try {
    const fy = fyOf(req);
    const sf = scope(req, 'f.organization_id');
    const [levels] = await db.query('SELECT id, name_ne, name_en, total_wards FROM local_levels ORDER BY name_en');
    const [fr] = await db.query(`SELECT f.local_level_id AS id, COUNT(*) AS farmers, ROUND(AVG(${S.COMPLETENESS})) AS completeness FROM farmers f WHERE f.status = 'active' AND f.local_level_id IS NOT NULL${sf.sql} GROUP BY f.local_level_id`, sf.params);
    const [fa] = await db.query(`SELECT f.local_level_id AS id, COUNT(fm.id) AS farms, COALESCE(SUM(fm.area_sqm), 0) AS area_sqm FROM farms fm JOIN farmers f ON f.id = fm.farmer_id WHERE f.local_level_id IS NOT NULL${sf.sql} GROUP BY f.local_level_id`, sf.params);
    const [pr] = await db.query(`SELECT f.local_level_id AS id, COALESCE(SUM(cp.production_kg), 0) AS kg ${FROM_PROD} WHERE cp.fiscal_year = ? AND f.local_level_id IS NOT NULL${sf.sql} GROUP BY f.local_level_id`, [fy, ...sf.params]);
    const [dv] = await db.query(`SELECT f.local_level_id AS id, COUNT(*) AS devices FROM iot_devices d JOIN farms fm ON fm.id = d.farm_id JOIN farmers f ON f.id = fm.farmer_id WHERE f.local_level_id IS NOT NULL${sf.sql} GROUP BY f.local_level_id`, sf.params);
    const [[un]] = await db.query(`SELECT COUNT(*) AS n FROM farmers f WHERE f.status = 'active' AND f.local_level_id IS NULL${sf.sql}`, sf.params);
    const m = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
    const A = m(fr), B = m(fa), C = m(pr), D = m(dv);
    res.json({
      fiscal_year: fy, unspecified: n(un.n),
      levels: levels.map((l) => ({
        ...l, farmers: n(A[l.id] && A[l.id].farmers), completeness: n(A[l.id] && A[l.id].completeness), farms: n(B[l.id] && B[l.id].farms),
        area_sqm: n(B[l.id] && B[l.id].area_sqm), production_kg: n(C[l.id] && C[l.id].kg), devices: n(D[l.id] && D[l.id].devices)
      }))
    });
  } catch (e) { next(e); }
};

exports.wards = async (req, res, next) => {
  try {
    const id = parseInt(req.query.local_level_id, 10);
    if (!id) return res.status(400).json({ message: 'local_level_id is required' });
    const sf = scope(req, 'f.organization_id');
    const [[ll]] = await db.query('SELECT id, name_ne, name_en, total_wards FROM local_levels WHERE id = ?', [id]);
    if (!ll) return res.status(404).json({ message: 'Local level not found' });
    const [fr] = await db.query(`SELECT f.ward_no AS ward, COUNT(*) AS farmers FROM farmers f WHERE f.status = 'active' AND f.local_level_id = ? AND f.ward_no IS NOT NULL${sf.sql} GROUP BY f.ward_no`, [id, ...sf.params]);
    const [fa] = await db.query(`SELECT f.ward_no AS ward, COUNT(fm.id) AS farms, COALESCE(SUM(fm.area_sqm), 0) AS area_sqm FROM farms fm JOIN farmers f ON f.id = fm.farmer_id WHERE f.local_level_id = ? AND f.ward_no IS NOT NULL${sf.sql} GROUP BY f.ward_no`, [id, ...sf.params]);
    const A = Object.fromEntries(fr.map((r) => [r.ward, r])), B = Object.fromEntries(fa.map((r) => [r.ward, r]));
    const count = ll.total_wards || Math.max(0, ...fr.map((r) => r.ward));
    const wards = Array.from({ length: count }, (_, i) => ({
      ward: i + 1, farmers: n(A[i + 1] && A[i + 1].farmers), farms: n(B[i + 1] && B[i + 1].farms), area_sqm: n(B[i + 1] && B[i + 1].area_sqm)
    }));
    res.json({ local_level: ll, wards });
  } catch (e) { next(e); }
};

exports.crops = async (req, res, next) => {
  try {
    const fy = fyOf(req);
    const sf = scope(req, 'f.organization_id');
    const [rows] = await db.query(
      `SELECT c.id, c.name_ne, c.name_en, c.category, COUNT(DISTINCT fm.farmer_id) AS farmers, COUNT(*) AS records,
              COALESCE(SUM(cp.area_sqm), 0) AS area_sqm, COALESCE(SUM(cp.production_kg), 0) AS production_kg, ${YIELD},
              COALESCE(SUM(cp.sold_kg), 0) AS sold_kg, COALESCE(SUM(cp.loss_kg), 0) AS loss_kg,
              SUM(cp.avg_price_npr_per_kg * cp.sold_kg) / NULLIF(SUM(CASE WHEN cp.avg_price_npr_per_kg IS NOT NULL THEN cp.sold_kg END), 0) AS avg_price
         ${FROM_PROD} JOIN crops c ON c.id = cp.crop_id
        WHERE cp.fiscal_year = ?${sf.sql} GROUP BY c.id, c.name_ne, c.name_en, c.category ORDER BY production_kg DESC`, [fy, ...sf.params]);
    res.json({
      fiscal_year: fy,
      crops: rows.map((r) => ({
        id: r.id, name_ne: r.name_ne, name_en: r.name_en, category: r.category, farmers: n(r.farmers), records: n(r.records), area_sqm: n(r.area_sqm),
        production_kg: n(r.production_kg), yield_kg_ha: yieldHa(r), sold_pct: n(r.production_kg) ? Math.round((n(r.sold_kg) / n(r.production_kg)) * 100) : null,
        loss_pct: n(r.production_kg) ? Math.round((n(r.loss_kg) / n(r.production_kg)) * 100) : null, avg_price: r.avg_price === null ? null : Math.round(n(r.avg_price) * 10) / 10
      }))
    });
  } catch (e) { next(e); }
};

exports.trends = async (req, res, next) => {
  try {
    const cropId = parseInt(req.query.crop_id, 10);
    if (!cropId) return res.status(400).json({ message: 'crop_id is required' });
    const sf = scope(req, 'f.organization_id');
    const [rows] = await db.query(
      `SELECT cp.fiscal_year, COUNT(DISTINCT fm.farmer_id) AS farmers, COALESCE(SUM(cp.area_sqm), 0) AS area_sqm,
              COALESCE(SUM(cp.production_kg), 0) AS production_kg, ${YIELD}
         ${FROM_PROD} WHERE cp.crop_id = ?${sf.sql} GROUP BY cp.fiscal_year ORDER BY cp.fiscal_year`, [cropId, ...sf.params]);
    res.json(rows.map((r) => ({ fiscal_year: r.fiscal_year, farmers: n(r.farmers), area_sqm: n(r.area_sqm), production_kg: n(r.production_kg), yield_kg_ha: yieldHa(r) })));
  } catch (e) { next(e); }
};

exports.livestock = async (req, res, next) => {
  try {
    const fy = fyOf(req);
    const sf = scope(req, 'f.organization_id');
    const base = 'FROM livestock_holdings lh JOIN farms fm ON fm.id = lh.farm_id JOIN farmers f ON f.id = fm.farmer_id';
    const [rows] = await db.query(
      `SELECT lh.animal_type, COUNT(DISTINCT fm.farmer_id) AS farmers, COALESCE(SUM(lh.head_count), 0) AS heads, COALESCE(SUM(lh.pond_area_sqm), 0) AS pond_area_sqm
         ${base} WHERE lh.fiscal_year = ?${sf.sql} GROUP BY lh.animal_type ORDER BY heads DESC`, [fy, ...sf.params]);
    const [outs] = await db.query(
      `SELECT lh.animal_type, lh.output_unit, COALESCE(SUM(lh.annual_output_qty), 0) AS qty
         ${base} WHERE lh.fiscal_year = ? AND lh.annual_output_qty IS NOT NULL AND lh.output_unit IS NOT NULL${sf.sql} GROUP BY lh.animal_type, lh.output_unit`, [fy, ...sf.params]);
    res.json({ fiscal_year: fy, animals: rows.map((r) => ({ ...r, farmers: n(r.farmers), heads: n(r.heads), pond_area_sqm: n(r.pond_area_sqm) })), outputs: outs.map((o) => ({ ...o, qty: n(o.qty) })) });
  } catch (e) { next(e); }
};

exports.inputs = async (req, res, next) => {
  try {
    const fy = fyOf(req);
    const sf = scope(req, 'f.organization_id');
    const [rows] = await db.query(
      `SELECT fi.input_type, fi.unit, COUNT(DISTINCT fm.farmer_id) AS farmers, COALESCE(SUM(fi.quantity), 0) AS qty, COALESCE(SUM(fi.cost_npr), 0) AS cost
         FROM farm_inputs fi JOIN farms fm ON fm.id = fi.farm_id JOIN farmers f ON f.id = fm.farmer_id
        WHERE fi.fiscal_year = ?${sf.sql} GROUP BY fi.input_type, fi.unit ORDER BY fi.input_type`, [fy, ...sf.params]);
    res.json({ fiscal_year: fy, inputs: rows.map((r) => ({ ...r, farmers: n(r.farmers), qty: n(r.qty), cost: n(r.cost) })) });
  } catch (e) { next(e); }
};

exports.quality = async (req, res, next) => {
  try {
    const sf = scope(req, 'f.organization_id');
    const [dist] = await db.query(
      `SELECT CASE WHEN c < 40 THEN 'low' WHEN c < 70 THEN 'fair' WHEN c < 90 THEN 'good' ELSE 'excellent' END AS band, COUNT(*) AS n
         FROM (SELECT ${S.COMPLETENESS} AS c FROM farmers f WHERE f.status = 'active'${sf.sql}) x GROUP BY band`, sf.params);
    const [[m]] = await db.query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(f.phone IS NULL), 0) AS no_phone, COALESCE(SUM(f.local_level_id IS NULL), 0) AS no_local_level,
              COALESCE(SUM(f.consent_data_use = 0), 0) AS no_consent, COALESCE(SUM(f.verification_status <> 'verified'), 0) AS unverified,
              COALESCE(SUM(f.verification_status = 'submitted'), 0) AS pending_verification,
              COALESCE(SUM(NOT EXISTS(SELECT 1 FROM farms x WHERE x.farmer_id = f.id)), 0) AS no_farm,
              COALESCE(SUM(NOT EXISTS(SELECT 1 FROM crop_production cp JOIN farms x ON x.id = cp.farm_id WHERE x.farmer_id = f.id)), 0) AS no_production
         FROM farmers f WHERE f.status = 'active'${sf.sql}`, sf.params);
    const [[fm]] = await db.query(
      `SELECT COALESCE(SUM(fm.area_sqm IS NULL OR fm.area_sqm = 0), 0) AS no_area, COALESCE(SUM(fm.latitude IS NULL), 0) AS no_gps
         FROM farms fm JOIN farmers f ON f.id = fm.farmer_id WHERE 1 = 1${sf.sql}`, sf.params);
    const [low] = await db.query(`SELECT ${S.ROW_SELECT} FROM farmers f WHERE f.status = 'active'${sf.sql} ORDER BY completeness ASC, f.id DESC LIMIT 20`, sf.params);
    const [prod] = await db.query(
      `SELECT cp.id, cp.fiscal_year, cp.production_system, cp.crop_id, c.name_en, c.name_ne, f.id AS farmer_id, f.farmer_code, fm.name AS farm_name, cp.production_kg, cp.area_sqm
         ${FROM_PROD} JOIN crops c ON c.id = cp.crop_id WHERE cp.area_sqm > 0 AND cp.production_kg > 0${sf.sql} ORDER BY cp.id DESC LIMIT 5000`, sf.params);

    const groups = {};
    prod.forEach((r) => {
      const y = n(r.production_kg) / (n(r.area_sqm) / 10000);
      (groups[`${r.crop_id}|${r.production_system}`] = groups[`${r.crop_id}|${r.production_system}`] || []).push({ ...r, y });
    });
    const outliers = [];
    Object.values(groups).forEach((g) => {
      if (g.length < 8) return;
      const med = S.median(g.map((x) => x.y));
      const mad = S.median(g.map((x) => Math.abs(x.y - med)));
      if (!mad) return;
      g.forEach((x) => {
        const z = (0.6745 * (x.y - med)) / mad;
        if (Math.abs(z) > 3.5) outliers.push({ id: x.id, farmer_id: x.farmer_id, farmer_code: x.farmer_code, farm_name: x.farm_name, crop_ne: x.name_ne, crop_en: x.name_en,
          system: x.production_system, fiscal_year: x.fiscal_year, yield_kg_ha: Math.round(x.y), median_kg_ha: Math.round(med), z: Math.round(z * 10) / 10 });
      });
    });
    outliers.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));

    res.json({
      distribution: dist.map((d) => ({ band: d.band, n: n(d.n) })),
      missing: Object.fromEntries(Object.entries({ ...m, ...fm }).map(([k, v]) => [k, n(v)])),
      lowest: low.map((r) => ({ id: r.id, farmer_code: r.farmer_code, name: r.full_name_ne || r.full_name_en, completeness: n(r.completeness), missing: S.missingOf(r) })),
      outliers: outliers.slice(0, 20)
    });
  } catch (e) { next(e); }
};

exports.exportSummary = async (req, res, next) => {
  try {
    const sf = scope(req, 'f.organization_id');
    const [[t]] = await db.query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(f.consent_research = 1 AND f.verification_status = 'verified'), 0) AS eligible
         FROM farmers f WHERE f.status = 'active'${sf.sql}`, sf.params);
    const [[p]] = await db.query(`SELECT COUNT(*) AS n ${FROM_PROD} WHERE f.consent_research = 1 AND f.verification_status = 'verified'${sf.sql}`, sf.params);
    const su = scope(req, 'u.organization_id');
    const [recent] = await db.query(
      `SELECT e.id, e.dataset, e.privacy_level, e.row_count, e.purpose, e.created_at, u.username
         FROM data_exports e JOIN users u ON u.id = e.user_id WHERE 1 = 1${su.sql} ORDER BY e.id DESC LIMIT 10`, su.params);
    res.json({ farmers_total: n(t.total), farmers_eligible: n(t.eligible), production_records_eligible: n(p.n), recent });
  } catch (e) { next(e); }
};

exports.exportData = async (req, res, next) => {
  try {
    const dataset = req.params.dataset;
    const purpose = String(req.query.purpose || '').trim();
    if (purpose.length < 10 || purpose.length > 255) return res.status(400).json({ message: 'Enter the purpose of this export (10-255 characters)' });
    const sf = scope(req, 'f.organization_id');
    const fy = req.query.fy && S.isValidFiscalYear(req.query.fy) ? req.query.fy : null;
    let rows, columns, level;
    const filters = {};

    if (dataset === 'production') {
      if (!process.env.EXPORT_SECRET) return res.status(500).json({ message: 'Export is not configured (EXPORT_SECRET is missing in .env)' });
      const params = [...sf.params];
      let extra = '';
      if (fy) { extra = ' AND cp.fiscal_year = ?'; params.push(fy); filters.fy = fy; }
      const [raw] = await db.query(
        `SELECT f.id AS farmer_id, fm.id AS farm_id, f.gender, f.date_of_birth, f.farmer_type, f.farmer_category, f.local_level_id, f.ward_no, ll.name_en AS local_level,
                cp.fiscal_year, cp.season, cp.production_system, cp.organic_status, c.name_en AS crop, c.category AS crop_category,
                cp.area_sqm, cp.plant_count, cp.production_kg, cp.sold_kg, cp.loss_kg, cp.loss_cause, cp.avg_price_npr_per_kg, cp.market_channel,
                fm.irrigation_type, fm.soil_type, fm.water_source, fm.altitude_m,
                EXISTS(SELECT 1 FROM iot_devices d WHERE d.farm_id = fm.id) AS device_present
           ${FROM_PROD} JOIN crops c ON c.id = cp.crop_id LEFT JOIN local_levels ll ON ll.id = f.local_level_id
          WHERE f.consent_research = 1 AND f.verification_status = 'verified'${sf.sql}${extra} ORDER BY cp.id`, params);
      if (new Set(raw.map((r) => r.farmer_id)).size < 5)
        return res.status(400).json({ message: 'Not enough eligible records for an anonymized export (at least 5 consented, verified farmers are needed)' });
      const byLevel = {}, byWard = {};
      raw.forEach((r) => {
        (byLevel[r.local_level_id] = byLevel[r.local_level_id] || new Set()).add(r.farmer_id);
        const k = `${r.local_level_id}-${r.ward_no}`;
        (byWard[k] = byWard[k] || new Set()).add(r.farmer_id);
      });
      columns = ['pseudo_farmer_id', 'pseudo_farm_id', 'local_level', 'ward_no', 'gender', 'age_band', 'farmer_type', 'farmer_category', 'fiscal_year', 'season', 'crop', 'crop_category',
        'production_system', 'organic_status', 'area_ha', 'plant_count', 'production_kg', 'yield_kg_per_ha', 'sold_kg', 'loss_kg', 'loss_cause', 'avg_price_npr_per_kg', 'market_channel',
        'irrigation_type', 'soil_type', 'water_source', 'altitude_m_approx', 'device_present'];
      rows = raw.map((r) => {
        const area = Number(r.area_sqm) || 0;
        const prod = r.production_kg === null ? null : Number(r.production_kg);
        const lvlOk = byLevel[r.local_level_id].size >= 5;
        const wardOk = r.ward_no && byWard[`${r.local_level_id}-${r.ward_no}`].size >= 5;
        return {
          pseudo_farmer_id: S.pseudo('F', r.farmer_id), pseudo_farm_id: S.pseudo('M', r.farm_id), local_level: lvlOk ? r.local_level : '', ward_no: lvlOk && wardOk ? r.ward_no : '',
          gender: r.gender, age_band: S.ageBand(r.date_of_birth), farmer_type: r.farmer_type, farmer_category: r.farmer_category, fiscal_year: r.fiscal_year, season: r.season,
          crop: r.crop, crop_category: r.crop_category, production_system: r.production_system, organic_status: r.organic_status,
          area_ha: area ? Math.round((area / 10000) * 10000) / 10000 : '', plant_count: r.plant_count, production_kg: prod, yield_kg_per_ha: area && prod !== null ? Math.round(prod / (area / 10000)) : '',
          sold_kg: r.sold_kg, loss_kg: r.loss_kg, loss_cause: r.loss_cause, avg_price_npr_per_kg: r.avg_price_npr_per_kg, market_channel: r.market_channel,
          irrigation_type: r.irrigation_type, soil_type: r.soil_type, water_source: r.water_source, altitude_m_approx: r.altitude_m === null ? '' : Math.round(r.altitude_m / 50) * 50, device_present: r.device_present
        };
      });
      level = 'anonymized';
    } else if (dataset === 'farmers') {
      if (!req.user.permissions.includes('datacenter.export_identified')) return res.status(403).json({ message: 'You do not have permission to export identified data' });
      const [raw] = await db.query(
        `SELECT f.farmer_code, f.national_farmer_id, f.full_name_en, f.full_name_ne, f.gender, f.phone, f.email, ll.name_en AS local_level, f.ward_no, f.address,
                f.farmer_type, f.farmer_category, f.verification_status, f.consent_data_use, f.consent_research,
                (SELECT COUNT(*) FROM farms x WHERE x.farmer_id = f.id) AS farms, (SELECT COALESCE(SUM(x.area_sqm), 0) FROM farms x WHERE x.farmer_id = f.id) AS total_area_sqm
           FROM farmers f LEFT JOIN local_levels ll ON ll.id = f.local_level_id WHERE f.status = 'active'${sf.sql} ORDER BY f.id`, sf.params);
      columns = ['farmer_code', 'national_farmer_id', 'full_name_en', 'full_name_ne', 'gender', 'phone', 'email', 'local_level', 'ward_no', 'address', 'farmer_type', 'farmer_category',
        'verification_status', 'consent_data_use', 'consent_research', 'farms', 'total_area_sqm'];
      rows = raw;
      level = 'identified';
    } else return res.status(404).json({ message: 'Unknown dataset' });

    await db.query('INSERT INTO data_exports (user_id, dataset, privacy_level, filters, row_count, purpose) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, dataset, level, JSON.stringify(filters), rows.length, purpose]);
    await logAudit(req.user.id, 'data_export', 'dataset', dataset, { level, rows: rows.length, purpose }, req);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="kaski_${dataset}_${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' });
    res.send(S.toCsv(rows, columns));
  } catch (e) { next(e); }
};

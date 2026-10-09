const db = require('../config/db');
const crypto = require('crypto');
const { logAudit } = require('../utils/audit');
const R = require('../services/farmerRowService');
const S = require('../services/dataCenterService');

const isSuper = (req) => req.user.roles.includes('super_admin');
const pad = (n, w) => String(n).padStart(w, '0');

const HEADERS = ['full_name_en', 'full_name_ne', 'gender', 'date_of_birth', 'phone', 'email', 'local_level', 'ward_no', 'address', 'group_name', 'farmer_type', 'farmer_category',
  'national_farmer_id', 'household_members', 'main_occupation', 'farm_name', 'farm_area_ropani', 'farm_area_aana', 'farm_area_paisa', 'farm_area_dam', 'farm_area_sqm',
  'ownership_type', 'irrigation_type', 'latitude', 'longitude'];

exports.template = (req, res) => {
  const base = Object.fromEntries(HEADERS.map((h) => [h, '']));
  const rows = [
    { ...base, full_name_en: 'Example Farmer One', full_name_ne: 'उदाहरण कृषक एक', gender: 'female', date_of_birth: '1984-06-12', phone: '9800000001', local_level: 'Pokhara', ward_no: 18, address: 'Hemja',
      farmer_type: 'individual', farmer_category: 'small', household_members: 5, main_occupation: 'agriculture', farm_name: 'Home plot', farm_area_ropani: 3, farm_area_aana: 8,
      ownership_type: 'owned', irrigation_type: 'drip', latitude: 28.2, longitude: 83.95 },
    { ...base, full_name_en: 'Example Farmer Two', gender: 'male', phone: '9800000002', local_level: 'माछापुच्छ्रे', ward_no: 3, farmer_type: 'individual', farm_area_sqm: 1200 }
  ];
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="farmers_import_template.csv"' });
  res.send(S.toCsv(rows, HEADERS));
};

async function evaluate(req, rows) {
  const [levels] = await db.query('SELECT id, name_ne, name_en, total_wards FROM local_levels');
  const prepared = rows.map((raw) => ({ n: raw.n, ...R.prepareRow(raw, levels) }));
  const dups = await R.findDuplicates(db, req.user.organization_id, prepared.map((p) => p.farmer));
  prepared.forEach((p, i) => {
    p.status = p.errors.length ? 'error' : 'ok';
    if (p.status === 'ok' && dups[i].hard) { p.status = 'duplicate'; p.errors.push(`Already registered as ${dups[i].hard.farmer_code} (${dups[i].hard.reason})`); }
    p.warnings.push(...dups[i].soft);
  });
  const seen = new Map();
  prepared.forEach((p) => {
    if (p.status !== 'ok') return;
    const keys = [p.farmer.national_farmer_id && `id:${p.farmer.national_farmer_id}`, p.farmer.phone && `ph:${p.farmer.phone}|${R.norm(p.farmer.full_name_en)}`].filter(Boolean);
    const hit = keys.find((k) => seen.has(k));
    if (hit) { p.status = 'duplicate'; p.errors.push(`Repeats row ${seen.get(hit)} of this file`); }
    else keys.forEach((k) => seen.set(k, p.n));
  });
  return prepared;
}

exports.preview = async (req, res, next) => {
  try {
    if (!req.user.organization_id) return res.status(400).json({ message: 'Your account is not linked to an office' });
    const prepared = await evaluate(req, req.body.rows);
    const count = (s) => prepared.filter((p) => p.status === s).length;
    res.json({
      summary: { total: prepared.length, ok: count('ok'), duplicate: count('duplicate'), error: count('error'), with_warnings: prepared.filter((p) => p.warnings.length).length },
      rows: prepared.map((p) => ({ n: p.n, status: p.status, name: p.farmer.full_name_en, errors: p.errors, warnings: p.warnings }))
    });
  } catch (e) { next(e); }
};

exports.commit = async (req, res, next) => {
  if (!req.user.organization_id) return res.status(400).json({ message: 'Your account is not linked to an office' });
  const { rows, batch, filename } = req.body;
  let conn;
  try {
    const prepared = await evaluate(req, rows);
    conn = await db.getConnection();
    await conn.beginTransaction();
    const results = [];
    for (const [i, p] of prepared.entries()) {
      if (p.status !== 'ok') { results.push({ n: p.n, status: p.status, errors: p.errors, warnings: p.warnings }); continue; }
      await conn.query(`SAVEPOINT sp${i}`);
      try {
        const [fr] = await conn.query('INSERT INTO farmers SET ?', [{
          ...p.farmer, farmer_code: `T-${crypto.randomBytes(8).toString('hex')}`, organization_id: req.user.organization_id, created_by: req.user.id,
          collection_method: 'import', verification_status: 'draft', import_batch: batch
        }]);
        const code = `FRM-${pad(fr.insertId, 6)}`;
        await conn.query('UPDATE farmers SET farmer_code = ? WHERE id = ?', [code, fr.insertId]);
        if (p.farm) await conn.query('INSERT INTO farms SET ?', [{ ...p.farm, farmer_id: fr.insertId, local_level_id: p.farmer.local_level_id, ward_no: p.farmer.ward_no }]);
        results.push({ n: p.n, status: 'imported', farmer_id: fr.insertId, farmer_code: code, errors: [], warnings: p.warnings });
      } catch (e) {
        await conn.query(`ROLLBACK TO SAVEPOINT sp${i}`);
        results.push({ n: p.n, status: 'error', errors: [e.code === 'ER_DUP_ENTRY' ? 'Duplicate national farmer ID' : 'The database rejected this row'], warnings: p.warnings });
      }
    }
    const c = (s) => results.filter((r) => r.status === s).length;
    await conn.query(
      `INSERT INTO data_imports (batch_uuid, user_id, filename, rows_total, rows_imported, rows_duplicate, rows_error) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rows_total = rows_total + VALUES(rows_total), rows_imported = rows_imported + VALUES(rows_imported),
         rows_duplicate = rows_duplicate + VALUES(rows_duplicate), rows_error = rows_error + VALUES(rows_error)`,
      [batch, req.user.id, (filename || '').slice(0, 255) || null, results.length, c('imported'), c('duplicate'), c('error')]);
    await conn.commit();
    await logAudit(req.user.id, 'farmers_import', 'import', batch, { imported: c('imported'), duplicates: c('duplicate'), errors: c('error'), filename }, req);
    res.json({ imported: c('imported'), duplicates: c('duplicate'), errors: c('error'), results });
  } catch (e) {
    if (conn) await conn.rollback();
    next(e);
  } finally { if (conn) conn.release(); }
};

exports.list = async (req, res, next) => {
  try {
    const sc = isSuper(req) ? { sql: '', params: [] } : { sql: ' AND u.organization_id = ?', params: [req.user.organization_id] };
    const [rows] = await db.query(
      `SELECT di.*, u.username FROM data_imports di JOIN users u ON u.id = di.user_id WHERE 1 = 1${sc.sql} ORDER BY di.id DESC LIMIT 20`, sc.params);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.undo = async (req, res, next) => {
  let conn;
  try {
    const sc = isSuper(req) ? { sql: '', params: [] } : { sql: ' AND u.organization_id = ?', params: [req.user.organization_id] };
    const [imp] = await db.query(`SELECT di.* FROM data_imports di JOIN users u ON u.id = di.user_id WHERE di.batch_uuid = ?${sc.sql}`, [req.params.batch, ...sc.params]);
    if (!imp[0]) return res.status(404).json({ message: 'Import not found' });
    if (imp[0].undone_at) return res.status(409).json({ message: 'This import was already undone' });
    const batch = req.params.batch;
    const [[touched]] = await db.query(
      `SELECT COUNT(*) AS n FROM farmers f WHERE f.import_batch = ? AND (
         f.verification_status <> 'draft' OR f.user_id IS NOT NULL OR f.consent_data_use = 1
         OR EXISTS(SELECT 1 FROM farms x JOIN crop_production cp ON cp.farm_id = x.id WHERE x.farmer_id = f.id)
         OR EXISTS(SELECT 1 FROM farms x JOIN livestock_holdings lh ON lh.farm_id = x.id WHERE x.farmer_id = f.id)
         OR EXISTS(SELECT 1 FROM farms x JOIN farm_inputs fi ON fi.farm_id = x.id WHERE x.farmer_id = f.id)
         OR EXISTS(SELECT 1 FROM farms x JOIN farm_assets fa ON fa.farm_id = x.id WHERE x.farmer_id = f.id)
         OR EXISTS(SELECT 1 FROM farms x JOIN iot_devices d ON d.farm_id = x.id WHERE x.farmer_id = f.id)
         OR EXISTS(SELECT 1 FROM farms x JOIN growing_units gu ON gu.farm_id = x.id WHERE x.farmer_id = f.id)
         OR EXISTS(SELECT 1 FROM program_beneficiaries pb WHERE pb.farmer_id = f.id)
         OR EXISTS(SELECT 1 FROM training_participants tp WHERE tp.farmer_id = f.id))`, [batch]);
    if (Number(touched.n) > 0) return res.status(409).json({ message: `${touched.n} imported farmer(s) already have consent, verification or further records, so the import cannot be undone automatically.` });
    conn = await db.getConnection();
    await conn.beginTransaction();
    await conn.query('DELETE FROM farms WHERE farmer_id IN (SELECT id FROM (SELECT id FROM farmers WHERE import_batch = ?) t)', [batch]);
    const [del] = await conn.query('DELETE FROM farmers WHERE import_batch = ?', [batch]);
    await conn.query('UPDATE data_imports SET undone_at = NOW() WHERE batch_uuid = ?', [batch]);
    await conn.commit();
    await logAudit(req.user.id, 'farmers_import_undo', 'import', batch, { removed: del.affectedRows }, req);
    res.json({ removed: del.affectedRows });
  } catch (e) {
    if (conn) await conn.rollback();
    next(e);
  } finally { if (conn) conn.release(); }
};

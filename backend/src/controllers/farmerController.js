const db = require('../config/db');
const { logAudit } = require('../utils/audit');
const crypto = require('crypto');

const FIELDS = ['full_name_en', 'full_name_ne', 'gender', 'date_of_birth', 'phone', 'email', 'local_level_id', 'ward_no', 'address', 'group_name'];
const clean = (v) => (v === '' || v === undefined ? null : v);
const isSuper = (req) => req.user.roles.includes('super_admin');
const scopeSql = (req, alias = 'f') => (isSuper(req) ? { sql: '', params: [] } : { sql: ` AND ${alias}.organization_id = ?`, params: [req.user.organization_id] });

async function findFarmer(req, id) {
  const sc = scopeSql(req);
  const [rows] = await db.query(
    `SELECT f.*, ll.name_ne AS local_level_ne, ll.name_en AS local_level_en
       FROM farmers f LEFT JOIN local_levels ll ON ll.id = f.local_level_id
      WHERE f.id = ?${sc.sql} LIMIT 1`, [id, ...sc.params]);
  return rows[0];
}

exports.list = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;
    const sc = scopeSql(req);
    let where = 'WHERE 1=1' + sc.sql;
    const params = [...sc.params];

    if (req.query.search) {
      const s = `%${String(req.query.search).trim()}%`;
      where += ' AND (f.full_name_en LIKE ? OR f.full_name_ne LIKE ? OR f.phone LIKE ? OR f.farmer_code LIKE ?)';
      params.push(s, s, s, s);
    }
    if (req.query.status) { where += ' AND f.status = ?'; params.push(req.query.status); }
    if (req.query.local_level_id) { where += ' AND f.local_level_id = ?'; params.push(req.query.local_level_id); }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM farmers f ${where}`, params);
    const [rows] = await db.query(
      `SELECT f.id, f.farmer_code, f.full_name_en, f.full_name_ne, f.gender, f.phone, f.ward_no, f.status,
              ll.name_ne AS local_level_ne, ll.name_en AS local_level_en,
              (SELECT COUNT(*) FROM farms fm WHERE fm.farmer_id = f.id) AS farm_count
         FROM farmers f LEFT JOIN local_levels ll ON ll.id = f.local_level_id
         ${where} ORDER BY f.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    res.json({ data: rows, total, page, limit });
  } catch (e) { next(e); }
};

exports.getOne = async (req, res, next) => {
  try {
    const farmer = await findFarmer(req, req.params.id);
    if (!farmer) return res.status(404).json({ message: 'Farmer not found' });
    const [farms] = await db.query(
      `SELECT fm.*, (SELECT COUNT(*) FROM growing_units gu WHERE gu.farm_id = fm.id) AS unit_count
         FROM farms fm WHERE fm.farmer_id = ? ORDER BY fm.id`, [farmer.id]);
    res.json({ farmer, farms });
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const data = {};
    FIELDS.forEach((k) => { data[k] = clean(req.body[k]); });
    const [r] = await db.query('INSERT INTO farmers SET ?', [{
      ...data, farmer_code: `T-${crypto.randomBytes(8).toString('hex')}`,
      organization_id: req.user.organization_id, created_by: req.user.id
    }]);
    const code = `FRM-${String(r.insertId).padStart(6, '0')}`;
    await db.query('UPDATE farmers SET farmer_code = ? WHERE id = ?', [code, r.insertId]);
    await logAudit(req.user.id, 'farmer_create', 'farmer', r.insertId, { code, name: data.full_name_en }, req);
    res.status(201).json({ id: r.insertId, farmer_code: code });
  } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const existing = await findFarmer(req, req.params.id);
    if (!existing) return res.status(404).json({ message: 'Farmer not found' });
    const changes = {};
    FIELDS.forEach((k) => { if (req.body[k] !== undefined) changes[k] = clean(req.body[k]); });
    if (!Object.keys(changes).length) return res.status(400).json({ message: 'No changes supplied' });
    await db.query('UPDATE farmers SET ? WHERE id = ?', [changes, existing.id]);
    await logAudit(req.user.id, 'farmer_update', 'farmer', existing.id, { fields: Object.keys(changes) }, req);
    res.json({ message: 'Farmer updated' });
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try {
    const existing = await findFarmer(req, req.params.id);
    if (!existing) return res.status(404).json({ message: 'Farmer not found' });
    await db.query("UPDATE farmers SET status = 'inactive' WHERE id = ?", [existing.id]);
    await logAudit(req.user.id, 'farmer_deactivate', 'farmer', existing.id, null, req);
    res.json({ message: 'Farmer deactivated' });
  } catch (e) { next(e); }
};

exports.addFarm = async (req, res, next) => {
  try {
    const farmer = await findFarmer(req, req.params.id);
    if (!farmer) return res.status(404).json({ message: 'Farmer not found' });
    const b = req.body;
    const [r] = await db.query('INSERT INTO farms SET ?', [{
      farmer_id: farmer.id, name: b.name, local_level_id: clean(b.local_level_id), ward_no: clean(b.ward_no),
      address: clean(b.address), area_sqm: clean(b.area_sqm),
      ownership_type: b.ownership_type || 'owned', irrigation_type: b.irrigation_type || 'none'
    }]);
    await logAudit(req.user.id, 'farm_create', 'farm', r.insertId, { farmer_id: farmer.id, name: b.name }, req);
    res.status(201).json({ id: r.insertId });
  } catch (e) { next(e); }
};


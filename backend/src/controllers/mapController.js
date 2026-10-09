const db = require('../config/db');
const S = require('../services/dataCenterService');

exports.map = async (req, res, next) => {
  try {
    const fy = req.query.fy && S.isValidFiscalYear(req.query.fy) ? req.query.fy : S.fiscalYearOf();
    const sf = req.user.roles.includes('super_admin') ? { sql: '', params: [] } : { sql: ' AND f.organization_id = ?', params: [req.user.organization_id] };
    const [farms] = await db.query(
      `SELECT fm.id AS farm_id, fm.name AS farm_name, fm.latitude, fm.longitude, fm.area_sqm, f.id AS farmer_id, f.farmer_code, f.full_name_en, f.full_name_ne,
              f.verification_status, f.local_level_id, ll.name_en AS level_en, ll.name_ne AS level_ne,
              (SELECT COUNT(*) FROM iot_devices d WHERE d.farm_id = fm.id AND d.status <> 'disabled') AS devices,
              (SELECT COALESCE(SUM(d.last_seen_at >= (NOW() - INTERVAL 5 MINUTE)), 0) FROM iot_devices d WHERE d.farm_id = fm.id AND d.status <> 'disabled') AS online,
              (SELECT GROUP_CONCAT(DISTINCT c.name_en ORDER BY c.name_en SEPARATOR ', ') FROM crop_production cp JOIN crops c ON c.id = cp.crop_id WHERE cp.farm_id = fm.id AND cp.fiscal_year = ?) AS crops_en,
              (SELECT GROUP_CONCAT(DISTINCT c.name_ne ORDER BY c.name_ne SEPARATOR ', ') FROM crop_production cp JOIN crops c ON c.id = cp.crop_id WHERE cp.farm_id = fm.id AND cp.fiscal_year = ?) AS crops_ne
         FROM farms fm JOIN farmers f ON f.id = fm.farmer_id LEFT JOIN local_levels ll ON ll.id = f.local_level_id
        WHERE fm.latitude IS NOT NULL AND fm.longitude IS NOT NULL AND f.status = 'active'${sf.sql} LIMIT 5000`, [fy, fy, ...sf.params]);
    const [[miss]] = await db.query(`SELECT COUNT(*) AS n FROM farms fm JOIN farmers f ON f.id = fm.farmer_id WHERE f.status = 'active' AND (fm.latitude IS NULL OR fm.longitude IS NULL)${sf.sql}`, sf.params);
    res.json({
      fiscal_year: fy, without_gps: Number(miss.n),
      farms: farms.map((r) => ({ ...r, latitude: Number(r.latitude), longitude: Number(r.longitude), area_sqm: r.area_sqm === null ? null : Number(r.area_sqm), devices: Number(r.devices), online: Number(r.online) }))
    });
  } catch (e) { next(e); }
};

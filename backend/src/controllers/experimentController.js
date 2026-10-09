const crypto = require('crypto');
const db = require('../config/db');
const { logAudit } = require('../utils/audit');
const ST = require('../services/stats');
const { METRICS } = require('../services/researchMetrics');

const isSuper = (req) => req.user.roles.includes('super_admin');
const pad = (n, w) => String(n).padStart(w, '0');
const notFound = (res, what) => res.status(404).json({ message: `${what} not found` });

async function loadExp(req, id) {
  const sc = isSuper(req) ? { sql: '', params: [] } : { sql: ' AND organization_id = ?', params: [req.user.organization_id] };
  const [r] = await db.query(`SELECT * FROM experiments WHERE id = ?${sc.sql}`, [id, ...sc.params]);
  return r[0];
}

exports.list = async (req, res, next) => {
  try {
    const sc = isSuper(req) ? { sql: '', params: [] } : { sql: ' AND e.organization_id = ?', params: [req.user.organization_id] };
    const [rows] = await db.query(
      `SELECT e.*, (SELECT COUNT(*) FROM experiment_units u WHERE u.experiment_id = e.id) AS units, (SELECT COUNT(*) FROM experiment_groups g WHERE g.experiment_id = e.id) AS group_count
         FROM experiments e WHERE 1 = 1${sc.sql} ORDER BY e.id DESC`, sc.params);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try {
    const exp = await loadExp(req, req.params.id);
    if (!exp) return notFound(res, 'Experiment');
    const [groups] = await db.query('SELECT id, name, description FROM experiment_groups WHERE experiment_id = ? ORDER BY sort_order, id', [exp.id]);
    const [units] = await db.query(
      `SELECT eu.group_id, gu.id, gu.code, gu.name_en, gu.is_simulated FROM experiment_units eu JOIN growing_units gu ON gu.id = eu.growing_unit_id WHERE eu.experiment_id = ? ORDER BY gu.id`, [exp.id]);
    res.json({ experiment: exp, groups: groups.map((g) => ({ ...g, units: units.filter((u) => u.group_id === g.id) })) });
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  let conn;
  try {
    const b = req.body;
    if (!req.user.organization_id) return res.status(400).json({ message: 'Your account is not linked to an office' });
    if (b.start_date > b.end_date) return res.status(400).json({ message: 'The start date must not be after the end date' });
    const all = b.groups.flatMap((g) => g.unit_ids.map(Number));
    if (new Set(all).size !== all.length) return res.status(400).json({ message: 'A greenhouse can belong to only one group' });
    if (b.groups.some((g) => !g.unit_ids.length)) return res.status(400).json({ message: 'Every group needs at least one greenhouse' });
    const sc = isSuper(req) ? { sql: '', params: [] } : { sql: ' AND s.organization_id = ?', params: [req.user.organization_id] };
    const [ok] = await db.query(`SELECT gu.id FROM growing_units gu JOIN sites s ON s.id = gu.site_id WHERE gu.id IN (?)${sc.sql}`, [all, ...sc.params]);
    if (ok.length !== all.length) return res.status(400).json({ message: 'One or more greenhouses were not found' });

    conn = await db.getConnection();
    await conn.beginTransaction();
    const [r] = await conn.query('INSERT INTO experiments SET ?', [{
      organization_id: req.user.organization_id, code: `T-${crypto.randomBytes(6).toString('hex')}`, title: b.title, hypothesis: b.hypothesis || null, metric: b.metric,
      start_date: b.start_date, end_date: b.end_date, status: b.status || 'draft', notes: b.notes || null, created_by: req.user.id
    }]);
    const code = `EXP-${pad(r.insertId, 4)}`;
    await conn.query('UPDATE experiments SET code = ? WHERE id = ?', [code, r.insertId]);
    for (const [i, g] of b.groups.entries()) {
      const [gr] = await conn.query('INSERT INTO experiment_groups SET ?', [{ experiment_id: r.insertId, name: g.name, description: g.description || null, sort_order: i }]);
      for (const uid of g.unit_ids) await conn.query('INSERT INTO experiment_units SET ?', [{ experiment_id: r.insertId, group_id: gr.insertId, growing_unit_id: Number(uid) }]);
    }
    await conn.commit();
    await logAudit(req.user.id, 'experiment_create', 'experiment', r.insertId, { code, metric: b.metric, groups: b.groups.length }, req);
    res.status(201).json({ id: r.insertId, code });
  } catch (e) {
    if (conn) await conn.rollback();
    next(e);
  } finally { if (conn) conn.release(); }
};

exports.setStatus = async (req, res, next) => {
  try {
    const exp = await loadExp(req, req.params.id);
    if (!exp) return notFound(res, 'Experiment');
    await db.query('UPDATE experiments SET status = ? WHERE id = ?', [req.body.status, exp.id]);
    await logAudit(req.user.id, 'experiment_status', 'experiment', exp.id, { status: req.body.status }, req);
    res.json({ message: 'Status updated' });
  } catch (e) { next(e); }
};

const unitLevel = (values, groups) => groups.map((g) => values[g.id] || []);

exports.analysis = async (req, res, next) => {
  try {
    const exp = await loadExp(req, req.params.id);
    if (!exp) return notFound(res, 'Experiment');
    const metric = exp.metric;
    if (!METRICS[metric]) return res.status(400).json({ message: 'Unknown metric' });
    const [groups] = await db.query('SELECT id, name FROM experiment_groups WHERE experiment_id = ? ORDER BY sort_order, id', [exp.id]);
    const [members] = await db.query('SELECT group_id, growing_unit_id AS unit_id FROM experiment_units WHERE experiment_id = ?', [exp.id]);
    const unitIds = members.map((m) => m.unit_id);
    const groupOf = Object.fromEntries(members.map((m) => [m.unit_id, m.group_id]));
    const [rows] = await db.query(
      `SELECT growing_unit_id AS u, day, ${metric} AS v FROM unit_daily WHERE growing_unit_id IN (?) AND day BETWEEN ? AND ? AND ${metric} IS NOT NULL AND data_coverage >= 70 ORDER BY day`,
      [unitIds, exp.start_date, exp.end_date]);

    const per = Object.fromEntries(groups.map((g) => [g.id, { units: {}, days: {} }]));
    rows.forEach((r) => {
      const g = per[groupOf[r.u]];
      (g.units[r.u] = g.units[r.u] || []).push(Number(r.v));
      (g.days[r.day] = g.days[r.day] || []).push(Number(r.v));
    });

    const unitMeans = {};
    const dailyVals = {};
    const stats = groups.map((g) => {
      const um = Object.values(per[g.id].units).map(ST.mean);
      const dv = Object.values(per[g.id].units).flat();
      unitMeans[g.id] = um;
      dailyVals[g.id] = dv;
      return { group_id: g.id, name: g.name, n_units: members.filter((m) => m.group_id === g.id).length, n_units_with_data: um.length, n_days_values: dv.length, mean: ST.mean(dv), sd: ST.sd(dv), unit_means: um };
    });

    const replicated = stats.every((s) => s.n_units_with_data >= 2);
    const primary = replicated ? ST.compareGroups(unitLevel(unitMeans, groups)) : null;
    const exploratory = ST.compareGroups(unitLevel(dailyVals, groups));
    const days = [...new Set(rows.map((r) => r.day))].sort();
    const series = days.map((d) => ({ day: d, ...Object.fromEntries(groups.map((g) => [`g${g.id}`, per[g.id].days[d] ? ST.mean(per[g.id].days[d]) : null])) }));

    const [yr] = await db.query(
      `SELECT cp.growing_unit_id AS u, cp.production_kg, cp.area_sqm FROM crop_production cp
        WHERE cp.growing_unit_id IN (?) AND cp.production_kg > 0 AND cp.area_sqm > 0 AND COALESCE(cp.harvest_end, cp.planting_date) BETWEEN ? AND DATE_ADD(?, INTERVAL 90 DAY)`,
      [unitIds, exp.start_date, exp.end_date]);
    const yu = {};
    yr.forEach((r) => { (yu[r.u] = yu[r.u] || []).push(Number(r.production_kg) / (Number(r.area_sqm) / 10000)); });
    const yg = {};
    groups.forEach((g) => { yg[g.id] = members.filter((m) => m.group_id === g.id).map((m) => (yu[m.unit_id] ? ST.mean(yu[m.unit_id]) : null)).filter((x) => x !== null); });
    const yieldReady = groups.every((g) => yg[g.id].length >= 2);

    const caveats = [];
    if (!replicated) caveats.push('At least one group has fewer than 2 greenhouses with data. The result below treats daily values as replicates, which they are not. Read it as exploratory, and add greenhouses to each group for a valid comparison.');
    else caveats.push('The main test uses one mean per greenhouse as the replicate unit, which is the appropriate level for a treatment applied to whole greenhouses.');
    caveats.push('Assign greenhouses to groups at random where possible, and keep everything except the treatment the same. Differences in position, crop age or variety can look like treatment effects.');
    caveats.push('Only days with at least 70 % data coverage are used. Check the Data quality tab for gaps and stuck sensors.');
    if (rows.length === 0) caveats.push('No usable daily data in the experiment dates yet. Run the rollups or wait for data.');

    res.json({
      experiment: exp, metric: { key: metric, ...METRICS[metric] }, replicated, groups: stats, primary, exploratory, series,
      yield: { groups: groups.map((g) => ({ group_id: g.id, name: g.name, n: yg[g.id].length, mean: ST.mean(yg[g.id]) })), test: yieldReady ? ST.compareGroups(groups.map((g) => yg[g.id])) : null,
        note: 'Yield in kg/ha from production records linked to these greenhouses that were harvested during the experiment or within 90 days after it.' },
      caveats
    });
  } catch (e) { next(e); }
};

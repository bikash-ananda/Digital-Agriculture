const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../config/db');
const ai = require('../services/aiEngine');

const router = express.Router();
router.use(authenticate);
const idRule = param('id').isInt({ min: 1 });
const isSuper = (req) => req.user.roles.includes('super_admin');

async function unitOf(req) {
  const sc = isSuper(req) ? { sql: '', params: [] } : { sql: ' AND s.organization_id = ?', params: [req.user.organization_id] };
  const [r] = await db.query(`SELECT gu.id FROM growing_units gu JOIN sites s ON s.id = gu.site_id WHERE gu.id = ?${sc.sql}`, [req.params.id, ...sc.params]);
  return r[0];
}
const wrap = (fn) => async (req, res, next) => {
  try { if (!(await unitOf(req))) return res.status(404).json({ message: 'Growing unit not found' }); await fn(req, res); } catch (e) { next(e); }
};
const hh = (n) => body(n).optional({ values: 'null' }).matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Use HH:MM');

router.get('/units/:id/insights', authorize('smart_farming.view'), idRule, validate, wrap(async (req, res) => res.json(await ai.insights(Number(req.params.id), 168, { fresh: req.query.fresh === '1' }))));

router.get('/units/:id/digests', authorize('smart_farming.view'), idRule, query('days').optional().isInt({ min: 1, max: 60 }), validate, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT day, digest FROM ai_digests WHERE growing_unit_id = ? ORDER BY day DESC LIMIT ?', [req.params.id, Math.min(parseInt(req.query.days, 10) || 14, 60)]);
  res.json(rows.map((r) => ({ day: r.day, digest: typeof r.digest === 'string' ? JSON.parse(r.digest) : r.digest })));
}));

const ruleBody = [
  body('start_threshold').isFloat({ min: 0, max: 100 }), body('stop_threshold').isFloat({ min: 0, max: 100 }),
  body('max_runtime_seconds').isInt({ min: 10, max: 3600 }), body('min_interval_seconds').isInt({ min: 0, max: 86400 }),
  hh('schedule_from'), hh('schedule_to'), body('days').optional().isInt({ min: 3, max: 30 })
];
router.post('/units/:id/backtest', authorize('irrigation_control.view'), idRule, ruleBody, validate, wrap(async (req, res) => {
  const b = req.body;
  if (Number(b.stop_threshold) <= Number(b.start_threshold)) return res.status(400).json({ message: 'The stop level must be higher than the start level' });
  res.json(await ai.backtest(Number(req.params.id), {
    start_threshold: Number(b.start_threshold), stop_threshold: Number(b.stop_threshold), max_runtime_seconds: Number(b.max_runtime_seconds),
    min_interval_seconds: Number(b.min_interval_seconds), schedule_from: b.schedule_from || null, schedule_to: b.schedule_to || null
  }, Number(b.days) || 14));
}));
router.post('/units/:id/recommend', authorize('irrigation_control.view'), idRule, [body('actuator_max_seconds').isInt({ min: 10, max: 3600 }), body('min_interval_seconds').isInt({ min: 0, max: 86400 }), body('days').optional().isInt({ min: 3, max: 30 })], validate,
  wrap(async (req, res) => res.json(await ai.recommendFor(Number(req.params.id), Number(req.body.actuator_max_seconds), Number(req.body.min_interval_seconds), Number(req.body.days) || 14))));

module.exports = router;

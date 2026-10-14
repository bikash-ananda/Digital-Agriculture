const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { KEYS } = require('../services/researchMetrics');
const c = require('../controllers/researchController');
const e = require('../controllers/experimentController');

const router = express.Router();
router.use(authenticate);

const TYPES = ['temperature', 'humidity', 'soil_moisture', 'soil_temperature', 'ec', 'light', 'water_level', 'co2', 'ph'];
const idRule = param('id').isInt({ min: 1 });
const day = (n) => query(n).optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage(`${n} must be YYYY-MM-DD`);
const ids = query('unit_ids').matches(/^[\d,]+$/).withMessage('unit_ids must be a comma-separated list of numbers');
const view = authorize('research.view');

router.get('/metrics', view, c.metrics);
router.get('/storage', view, c.storage);
router.get('/units', view, c.units);
router.get('/units/:id/daily', view, idRule, day('from'), day('to'), validate, c.daily);
router.get('/units/:id/hourly', view, idRule, query('type').isIn(TYPES), day('from'), day('to'), validate, c.hourly);
router.get('/units/:id/summary', view, idRule, day('from'), day('to'), validate, c.summary);
router.get('/units/:id/automation', view, idRule, query('days').optional().isInt({ min: 1, max: 60 }), validate, c.automation);
router.get('/correlation', view, ids, query('x').isIn(KEYS), query('y').isIn(KEYS), query('method').optional().isIn(['pearson', 'spearman']), day('from'), day('to'), validate, c.correlation);
router.get('/compare', view, ids, query('metric').isIn(KEYS), day('from'), day('to'), validate, c.compare);
router.get('/devices/health', view, c.devicesHealth);
router.get('/dictionary', view, c.dictionary);
router.get('/sensors/:id/calibrations', view, idRule, validate, c.calibrations);
router.post('/sensors/:id/calibrate', authorize('research.manage'), idRule, [
  body('method').trim().notEmpty().isLength({ max: 120 }), body('reference_instrument').optional({ values: 'null' }).isString().isLength({ max: 150 }),
  body('point1_measured').isFloat(), body('point1_reference').isFloat(),
  body('point2_measured').optional({ values: 'null' }).isFloat(), body('point2_reference').optional({ values: 'null' }).isFloat(),
  body('notes').optional({ values: 'null' }).isString().isLength({ max: 500 })
], validate, c.calibrate);

router.get('/export/:dataset', authorize('research.export'), param('dataset').isIn(['daily', 'hourly']), validate, c.exportData);

router.get('/experiments', view, e.list);
router.post('/experiments', authorize('research.manage'), [
  body('title').trim().notEmpty().isLength({ max: 200 }), body('metric').isIn(KEYS), body('start_date').isISO8601(), body('end_date').isISO8601(),
  body('hypothesis').optional({ values: 'null' }).isString().isLength({ max: 2000 }), body('notes').optional({ values: 'null' }).isString().isLength({ max: 2000 }),
  body('status').optional().isIn(['draft', 'running']),
  body('groups').isArray({ min: 2, max: 6 }), body('groups.*.name').trim().notEmpty().isLength({ max: 100 }),
  body('groups.*.description').optional({ values: 'null' }).isString().isLength({ max: 500 }), body('groups.*.unit_ids').isArray({ min: 1, max: 20 }), body('groups.*.unit_ids.*').isInt({ min: 1 })
], validate, e.create);
router.get('/experiments/:id', view, idRule, validate, e.get);
router.put('/experiments/:id/status', authorize('research.manage'), idRule, body('status').isIn(['draft', 'running', 'completed', 'cancelled']), validate, e.setStatus);
router.get('/experiments/:id/analysis', view, idRule, validate, e.analysis);

module.exports = router;

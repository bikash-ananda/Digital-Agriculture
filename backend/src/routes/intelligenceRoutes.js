const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/intelligenceController');

const router = express.Router();
router.use(authenticate);

const idRule = param('id').isInt({ min: 1 });
const opt = (n) => body(n).optional({ values: 'falsy' });

router.get('/units/:id/analysis', authorize('analysis.view'), idRule, validate, ctrl.analysis);
router.get('/units/:id/analysis/history', authorize('analysis.view'), idRule, query('hours').optional().isInt({ min: 1, max: 720 }), validate, ctrl.analysisHistory);
router.get('/units/:id/recommendations', authorize('analysis.view'), idRule, validate, ctrl.recommendations);
router.post('/recommendations/:id/dismiss', authorize('analysis.view'), idRule, validate, ctrl.dismissRecommendation);

router.get('/units/:id/cycles', authorize('crop_cycles.view'), idRule, validate, ctrl.listCycles);
router.post('/units/:id/cycles', authorize('crop_cycles.create'), idRule, [
  body('crop_id').isInt({ min: 1 }).withMessage('Select a crop'),
  body('planted_on').isISO8601().withMessage('Planting date is required'),
  opt('variety').trim().isLength({ max: 100 }),
  opt('plant_count').isInt({ min: 1, max: 1000000 }),
  opt('expected_harvest_on').isISO8601(),
  opt('notes').trim().isLength({ max: 2000 })
], validate, ctrl.createCycle);
router.put('/cycles/:id', authorize('crop_cycles.update'), idRule, [
  opt('status').isIn(['active', 'harvested', 'failed', 'cancelled']),
  opt('stage_override').isString().isLength({ max: 30 }),
  opt('variety').trim().isLength({ max: 100 }),
  opt('plant_count').isInt({ min: 1, max: 1000000 }),
  opt('expected_harvest_on').isISO8601(),
  opt('notes').trim().isLength({ max: 2000 })
], validate, ctrl.updateCycle);

router.get('/cycles/:id/observations', authorize('crop_cycles.view'), idRule, validate, ctrl.listObservations);
router.post('/cycles/:id/observations', authorize('observations.create'), idRule, [
  opt('obs_type').isIn(['growth', 'pest_disease', 'nutrition', 'water', 'harvest', 'note']),
  opt('observed_at').isISO8601(),
  opt('plant_height_cm').isFloat({ min: 0, max: 1000 }),
  opt('leaf_count').isInt({ min: 0, max: 100000 }),
  opt('ph_value').isFloat({ min: 0, max: 14 }),
  opt('ec_value').isFloat({ min: 0, max: 50 }),
  opt('yield_kg').isFloat({ min: 0, max: 100000 }),
  opt('pest_disease').trim().isLength({ max: 150 }),
  opt('severity').isIn(['none', 'low', 'medium', 'high']),
  opt('fertilizer').trim().isLength({ max: 150 }),
  opt('notes').trim().isLength({ max: 2000 })
], validate, ctrl.addObservation);

router.get('/units/:id/rules', authorize('automation.view'), idRule, validate, ctrl.listRules);
router.get('/units/:id/rules/suggestions', authorize('automation.view'), idRule, validate, ctrl.ruleSuggestions);
const ruleBody = (create) => [
  create ? body('actuator_id').isInt({ min: 1 }) : opt('actuator_id').isInt({ min: 1 }),
  create ? body('sensor_id').isInt({ min: 1 }) : opt('sensor_id').isInt({ min: 1 }),
  create ? body('name').trim().notEmpty().isLength({ max: 150 }) : opt('name').trim().isLength({ max: 150 }),
  create ? body('comparison').isIn(['lt', 'gt', 'lte', 'gte']) : opt('comparison').isIn(['lt', 'gt', 'lte', 'gte']),
  create ? body('start_threshold').isFloat() : opt('start_threshold').isFloat(),
  create ? body('stop_threshold').isFloat() : opt('stop_threshold').isFloat(),
  opt('max_runtime_seconds').isInt({ min: 10, max: 86400 }),
  opt('min_interval_seconds').isInt({ min: 0, max: 86400 }),
  opt('schedule_from').matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).withMessage('Use HH:MM'),
  opt('schedule_to').matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).withMessage('Use HH:MM'),
  body('is_enabled').optional().isBoolean()
];
router.post('/units/:id/rules', authorize('automation.configure'), idRule, ruleBody(true), validate, ctrl.createRule);
router.put('/rules/:id', authorize('automation.configure'), idRule, ruleBody(false), validate, ctrl.updateRule);
router.delete('/rules/:id', authorize('automation.configure'), idRule, validate, ctrl.deleteRule);

router.get('/units/:id/cameras', authorize('cameras.view'), idRule, validate, ctrl.listCameras);
router.post('/devices/:id/cameras', authorize('cameras.manage'), idRule, [
  body('name').trim().notEmpty().isLength({ max: 100 }),
  opt('camera_type').isIn(['esp32cam', 'ip_camera', 'usb']),
  opt('stream_url').trim().isURL({ require_protocol: true }).isLength({ max: 500 })
], validate, ctrl.createCamera);
router.get('/cameras/:id/latest', authorize('cameras.view'), idRule, validate, ctrl.latestImage);
router.get('/cameras/:id/snapshots', authorize('cameras.view'), idRule, validate, ctrl.listSnapshots);
router.get('/snapshots/:id/image', authorize('cameras.view'), idRule, validate, ctrl.snapshotImage);

module.exports = router;

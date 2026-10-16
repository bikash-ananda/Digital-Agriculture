const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/monitorController');
const reports = require('../controllers/reportController');
const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many report exports. Try again later.' }
});

const router = express.Router();
router.use(authenticate);
const idRule = param('id').isInt({ min: 1 });

router.get('/units/:id/live', authorize('smart_farming.view'), idRule, validate, ctrl.live);
router.get('/sensors/:id/history', authorize('smart_farming.view'), idRule, [
  query('hours').optional().isInt({ min: 1, max: 720 }),
  query('from').optional().isISO8601({ strict: true }),
  query('to').optional().isISO8601({ strict: true })
], validate, ctrl.history);

router.get('/units/:id/report.xlsx', authorize('smart_farming.view'), idRule, [
  query('hours').optional().isInt({ min: 1, max: 720 }),
  query('from').optional().isISO8601({ strict: true }),
  query('to').optional().isISO8601({ strict: true }),
  query('interval_minutes').optional().isIn(['15', '60', '240']),
  query('sensor_ids').exists().isString().isLength({ min: 1, max: 263 }).matches(/^\d+(,\d+)*$/),
  query('time_zone').optional().isLength({ min: 1, max: 64 })
], validate, exportLimiter, reports.download);

router.get('/units/:id/report.csv', authorize('smart_farming.view'), idRule, [
  query('hours').optional().isInt({ min: 1, max: 720 }),
  query('from').optional().isISO8601({ strict: true }),
  query('to').optional().isISO8601({ strict: true }),
  query('sensor_ids').exists().isString().isLength({ min: 1, max: 263 }).matches(/^\d+(,\d+)*$/),
  query('time_zone').optional().isLength({ min: 1, max: 64 })
], validate, exportLimiter, reports.downloadCsv);

router.post('/actuators/:id/command', authorize('irrigation_control.control'), idRule, [
  body('command').isIn(['on', 'off']).withMessage('Command must be on or off'),
  body('duration_seconds').optional({ values: 'falsy' }).isInt({ min: 1, max: 86400 })
], validate, ctrl.sendCommand);

router.put('/actuators/:id/mode', authorize('irrigation_control.configure'), idRule, [
  body('control_mode').isIn(['manual', 'auto'])
], validate, ctrl.setMode);

router.get('/commands/:id', authorize('irrigation_control.view'), idRule, validate, ctrl.commandStatus);

module.exports = router;

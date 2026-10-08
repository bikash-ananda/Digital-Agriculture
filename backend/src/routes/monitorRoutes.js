const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/monitorController');

const router = express.Router();
router.use(authenticate);
const idRule = param('id').isInt({ min: 1 });

router.get('/units/:id/live', authorize('smart_farming.view'), idRule, validate, ctrl.live);
router.get('/sensors/:id/history', authorize('smart_farming.view'), idRule,
  query('hours').optional().isInt({ min: 1, max: 720 }), validate, ctrl.history);

router.post('/actuators/:id/command', authorize('irrigation_control.control'), idRule, [
  body('command').isIn(['on', 'off']).withMessage('Command must be on or off'),
  body('duration_seconds').optional({ values: 'falsy' }).isInt({ min: 1, max: 86400 })
], validate, ctrl.sendCommand);

router.put('/actuators/:id/mode', authorize('irrigation_control.configure'), idRule, [
  body('control_mode').isIn(['manual', 'auto'])
], validate, ctrl.setMode);

router.get('/commands/:id', authorize('irrigation_control.view'), idRule, validate, ctrl.commandStatus);

module.exports = router;

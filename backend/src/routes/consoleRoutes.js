const express = require('express');
const { param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/consoleController');

const router = express.Router();
router.use(authenticate);
const idRule = param('id').isInt({ min: 1 });
const view = authorize('smart_farming.view');

router.get('/units', view, c.units);
router.get('/units/:id/overview', view, idRule, validate, c.overview);
router.get('/units/:id/series', view, idRule, query('hours').optional().isInt({ min: 1, max: 720 }), query('types').matches(/^[a-z_0-9,]+$/), validate, c.series);
router.get('/units/:id/automation-status', authorize('irrigation_control.view'), idRule, validate, c.automationStatus);

module.exports = router;

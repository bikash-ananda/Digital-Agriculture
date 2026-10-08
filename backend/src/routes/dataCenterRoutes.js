const express = require('express');
const { param } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/dataCenterController');

const router = express.Router();
router.use(authenticate);

router.get('/overview', authorize('datacenter.view'), c.overview);
router.get('/local-levels', authorize('datacenter.view'), c.localLevels);
router.get('/wards', authorize('datacenter.view'), c.wards);
router.get('/crops', authorize('datacenter.view'), c.crops);
router.get('/trends', authorize('datacenter.view'), c.trends);
router.get('/livestock', authorize('datacenter.view'), c.livestock);
router.get('/inputs', authorize('datacenter.view'), c.inputs);
router.get('/quality', authorize('datacenter.view'), c.quality);
router.get('/export-summary', authorize('datacenter.export'), c.exportSummary);
router.get('/export/:dataset', authorize('datacenter.export'), param('dataset').isIn(['production', 'farmers']), validate, c.exportData);

module.exports = router;

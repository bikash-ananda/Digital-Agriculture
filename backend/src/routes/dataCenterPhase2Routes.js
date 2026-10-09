const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const imp = require('../controllers/importController');
const survey = require('../controllers/surveyController');
const map = require('../controllers/mapController');

const router = express.Router();
router.use(authenticate);

router.get('/map', authorize('datacenter.view'), map.map);

router.get('/import/template', authorize('datacenter.import'), imp.template);
router.post('/import/preview', authorize('datacenter.import'), [
  body('rows').isArray({ min: 1, max: 500 }).withMessage('Send between 1 and 500 rows'), body('rows.*').isObject()
], validate, imp.preview);
router.post('/import/commit', authorize('datacenter.import'), [
  body('rows').isArray({ min: 1, max: 500 }).withMessage('Send between 1 and 500 rows'), body('rows.*').isObject(),
  body('batch').isUUID().withMessage('Invalid batch id'), body('filename').optional().isString().isLength({ max: 255 })
], validate, imp.commit);
router.get('/imports', authorize('datacenter.import'), imp.list);
router.post('/imports/:batch/undo', authorize('datacenter.import'), param('batch').isUUID(), validate, imp.undo);

router.post('/survey', authorize('datacenter.collect'), [
  body('client_uuid').isUUID().withMessage('Invalid survey id'), body('farmer').isObject(), body('farm').optional().isObject(),
  body('crops').optional().isArray({ max: 10 }), body('livestock').optional().isArray({ max: 10 }), body('consent').isObject(),
  body('confirm_duplicate').optional().isBoolean()
], validate, survey.submit);

module.exports = router;

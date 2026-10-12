const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const deviceAuth = require('../middleware/deviceAuth');
const ctrl = require('../controllers/deviceController');

const router = express.Router();

router.use(rateLimit({
  windowMs: 60 * 1000, max: 500,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: { message: 'Too many requests from this network' }
}));
router.use(rateLimit({
  windowMs: 60 * 1000, max: 120,
  keyGenerator: (req) => req.get('x-device-code') || 'anonymous',
  message: { message: 'Too many requests from this device' }
}));
router.use(deviceAuth);

router.post('/readings', [
  body('firmware').optional().isString().isLength({ max: 30 }),
  body('readings').custom((obj) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('readings must be an object');
    const vals = Object.values(obj);
    if (vals.length < 1 || vals.length > 20) throw new Error('readings must contain 1-20 values');
    if (!vals.every((v) => typeof v === 'number' && Number.isFinite(v))) throw new Error('all reading values must be numbers');
    return true;
  })
], validate, ctrl.readings);

router.get('/commands', ctrl.commands);

router.post('/commands/:id/ack', [
  param('id').isInt({ min: 1 }),
  body('success').isBoolean(),
  body('error').optional().isString().isLength({ max: 255 })
], validate, ctrl.ack);

router.post('/state', [
  body('states').isArray({ min: 1, max: 10 }),
  body('states.*.actuator_id').isInt({ min: 1 }),
  body('states.*.state').isIn(['on', 'off'])
], validate, ctrl.state);

const extra = require('../controllers/deviceExtraController');
router.get('/config', extra.config);
router.post('/cameras/:id/snapshot', param('id').isInt({ min: 1 }), validate, express.raw({ type: 'image/jpeg', limit: '600kb' }), extra.snapshot);

module.exports = router;


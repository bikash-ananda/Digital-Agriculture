const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const deviceAuth = require('../middleware/deviceAuth');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/v1Controller');

const router = express.Router();
const ipLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, keyGenerator: (req) => ipKeyGenerator(req.ip), message: { success: false, message: 'Too many device requests from this network' } });
const limiter = rateLimit({
  windowMs: 60 * 1000, max: 120, keyGenerator: (req) => req.get('x-device-code') || 'anonymous',
  message: { success: false, message: 'Too many requests from this device' }
});
const small = (req, res, next) => {
  if (Number(req.get('content-length') || 0) > 8192) return res.status(413).json({ success: false, message: 'Payload too large' });
  next();
};
const code = param('code').matches(/^[A-Za-z0-9_-]{3,50}$/).withMessage('Invalid device code');

const sensorsRule = body('sensors').custom((o) => {
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('sensors must be an object');
  const e = Object.entries(o);
  if (e.length < 1 || e.length > 30) throw new Error('sensors must contain 1-30 values');
  if (!e.every(([k, v]) => /^[a-z0-9_]{2,40}$/.test(k) && (v === null || (typeof v === 'number' && Number.isFinite(v)))))
    throw new Error('each sensor value must be a number or null, with a lowercase key');
  return true;
});
const actuatorsRule = body('actuators').optional().custom((o) => {
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('actuators must be an object');
  if (!Object.entries(o).every(([k, v]) => /^[a-z0-9_]{2,40}$/.test(k) && typeof v === 'boolean')) throw new Error('actuator states must be true or false');
  return true;
});

router.post('/telemetry', ipLimiter, limiter, small, deviceAuth, [
  body('device_id').isString().isLength({ min: 3, max: 50 }), body('timestamp').optional().isISO8601(), body('sequence').optional().isInt({ min: 0 }),
  sensorsRule, actuatorsRule, body('status').optional().isObject()
], validate, c.telemetry);

router.get('/devices/:code/commands/next', ipLimiter, limiter, deviceAuth, code, validate, c.nextCommand);
router.post('/devices/:code/commands/ack', ipLimiter, limiter, small, deviceAuth, code, [
  body('command_id').isInt({ min: 1 }), body('success').isBoolean(), body('error').optional().isString().isLength({ max: 255 }), body('actuator_state').optional().isIn(['on', 'off'])
], validate, c.ackCommand);

router.get('/devices/:code/status', authenticate, authorize('devices.view'), code, validate, c.deviceStatus);

module.exports = router;

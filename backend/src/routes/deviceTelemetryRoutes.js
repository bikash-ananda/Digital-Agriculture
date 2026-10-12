const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const deviceAuth = require('../middleware/deviceAuth');
const db = require('../config/db');

const router = express.Router();
const telemetryIpLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, keyGenerator: (req) => ipKeyGenerator(req.ip), message: { message: 'Too many telemetry requests from this network' } });
const telemetryDeviceLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, keyGenerator: (req) => req.get('x-device-code') || 'anonymous', message: { message: 'Too many requests from this device' } });

router.post('/', telemetryIpLimiter, telemetryDeviceLimiter, deviceAuth, [
  body('rssi').optional().isInt({ min: -130, max: 0 }), body('uptime_s').optional().isInt({ min: 0 }), body('free_heap').optional().isInt({ min: 0 }),
  body('reset_reason').optional().isString().isLength({ max: 30 }), body('firmware').optional().isString().isLength({ max: 30 }),
  body('sensor_errors').optional().isInt({ min: 0 }), body('wifi_reconnects').optional().isInt({ min: 0 }), body('http_failures').optional().isInt({ min: 0 })
], validate, async (req, res, next) => {
  try {
    const b = req.body;
    await db.query('INSERT INTO device_telemetry SET ?', [{
      device_id: req.device.id, rssi: b.rssi ?? null, uptime_s: b.uptime_s ?? null, free_heap: b.free_heap ?? null, reset_reason: b.reset_reason ?? null, firmware: b.firmware ?? null,
      sensor_errors: b.sensor_errors ?? null, wifi_reconnects: b.wifi_reconnects ?? null, http_failures: b.http_failures ?? null
    }]);
    if (b.firmware) await db.query('UPDATE iot_devices SET firmware_version = ? WHERE id = ?', [b.firmware, req.device.id]);
    res.status(201).json({ message: 'OK' });
  } catch (e) { next(e); }
});

module.exports = router;

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { param } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/opsController');

const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 1000, max: 90, message: { message: 'Too many requests from this device' } });
const small = (req, res, next) => (Number(req.get('content-length') || 0) > 16384 ? res.status(413).json({ message: 'Payload too large' }) : next());
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1 } }).single('file');
const uploadMw = (req, res, next) => upload(req, res, (err) => (err ? res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 4 MB' : 'Upload failed' }) : next()));
const opsId = param('opsId').matches(/^[A-Za-z0-9_-]{3,60}$/);

// device-facing (compatible with the old service)
router.post('/devices/:opsId/telemetry', limiter, small, c.deviceAuth, c.telemetry);
router.post('/devices/:opsId/poll', limiter, small, c.deviceAuth, c.poll);
router.post('/devices/:opsId/ack', limiter, small, c.deviceAuth, c.ack);

// staff-facing
router.get('/admin/devices', authenticate, authorize('devices.view'), c.listDevices);
router.get('/admin/devices/:opsId/health', authenticate, authorize('devices.view'), opsId, validate, c.health);
router.get('/admin/devices/:opsId/commands', authenticate, authorize('devices.view'), opsId, validate, c.commands);
router.post('/admin/devices/:opsId/commands', authenticate, authorize('devices.update'), opsId, validate, c.queue);
router.delete('/admin/commands/:id', authenticate, authorize('devices.update'), param('id').isInt({ min: 1 }), validate, c.cancel);
router.get('/admin/firmware', authenticate, authorize('devices.view'), c.firmwareList);
router.post('/admin/firmware', authenticate, authorize('settings.update'), uploadMw, c.firmwareUpload);

module.exports = router;

const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/applicationController');

const limit = (max, minutes, message) => rateLimit({ windowMs: minutes * 60 * 1000, max, standardHeaders: true, legacyHeaders: false, message: { message } });
const router = express.Router();

// Public: applicants. No account is needed; abuse is limited by rate limits and the phone check.
router.get('/types', c.types);
router.post('/check', limit(60, 15, 'Too many checks. Please wait a few minutes.'), c.check);
router.post('/otp', limit(5, 60, 'Too many code requests. Please try again later.'), c.sendOtp);
router.post('/', limit(5, 60, 'Application limit reached. Please try again later.'), c.submit);
router.post('/track', limit(20, 60, 'Too many attempts. Please try again later.'), c.track);

// Staff
router.use(authenticate);
router.param('id', (req, res, next, value) => (/^\d{1,10}$/.test(value) ? next() : res.status(404).json({ message: 'Application not found' })));
router.get('/', authorize('applications.view'), c.list);
router.get('/:id', authorize('applications.view'), c.get);
router.put('/:id/status', authorize('applications.manage'), c.updateStatus);

module.exports = router;

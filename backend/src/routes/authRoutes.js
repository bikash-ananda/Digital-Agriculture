const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { message: 'Too many login attempts. Please try again later.' }
});

router.post('/login', loginLimiter,
  [body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username is required'),
   body('password').isString().isLength({ min: 1, max: 128 }).withMessage('Password is required')],
  validate, ctrl.login);
router.post('/logout', ctrl.logout);
router.get('/me', authenticate, ctrl.me);

module.exports = router;

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const auth = require('../controllers/authController');
const accounts = require('../controllers/accountController');

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { message: 'Too many sign-in attempts. Try again later.' } });
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { message: 'Too many account requests. Try again later.' } });
const codeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 12, message: { message: 'Too many code requests. Try again later.' } });
const emailField = body('email').isEmail().withMessage('Enter a valid email address').bail().isLength({ max: 150 }).normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false });
const otpField = (name) => body(name).isString().trim().matches(/^\d{6}$/).withMessage('Enter the six-digit code');

router.post('/login', loginLimiter,
  [body('email').optional().isEmail(), body('username').optional().isEmail(), body('password').isString().isLength({ min: 1, max: 128 }).withMessage('Password is required')],
  validate, auth.login);
router.post('/register', signupLimiter,
  [emailField, body('phone').isString().trim().isLength({ min: 8, max: 24 }), body('fullName').isString().trim().isLength({ min: 2, max: 150 }), body('password').isString().isLength({ min: 1, max: 128 })],
  validate, accounts.register);
router.post('/verify-registration', codeLimiter,
  [emailField, otpField('emailCode'), otpField('phoneCode')], validate, accounts.verifyRegistration);
router.post('/resend-verification', codeLimiter, [emailField], validate, accounts.resendRegistration);
router.post('/forgot-password', codeLimiter, [emailField], validate, accounts.forgotPassword);
router.post('/reset-password', codeLimiter,
  [emailField, otpField('code'), body('password').isString().isLength({ min: 1, max: 128 })],
  validate, accounts.resetPassword);
router.post('/change-password', authenticate,
  [body('current_password').isString().isLength({ min: 1, max: 128 }), body('new_password').isString().isLength({ min: 1, max: 128 })],
  validate, auth.changePassword);

router.get('/admin/users', authenticate, authorize('users.view'), accounts.adminUsers);
router.post('/admin/users', authenticate, authorize('users.create'),
  [emailField, body('phone').isString().trim().isLength({ min: 8, max: 24 }), body('fullName').isString().trim().isLength({ min: 2, max: 150 }), body('password').isString().isLength({ min: 1, max: 128 }), body('roleCode').isString().isLength({ min: 3, max: 50 })],
  validate, accounts.createUser);
router.patch('/admin/users/:id/approve', authenticate, authorize('users.update'),
  [param('id').isInt({ min: 1 })], validate, accounts.approveUser);
router.post('/logout', authenticate, auth.logout);
router.get('/me', authenticate, auth.me);

module.exports = router;
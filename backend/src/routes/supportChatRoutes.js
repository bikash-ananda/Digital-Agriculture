const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const chat = require('../controllers/supportChatController');

const router = express.Router();
const createLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many chat sessions. Try again later.' } });
const messageLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { message: 'Please wait before sending more messages.' } });
const id = param('id').isUUID();
const tokenHeader = (req, res, next) => {
  if (!/^[A-Za-z0-9_-]{43,64}$/.test(String(req.get('x-support-token') || ''))) {
    return res.status(401).json({ message: 'Chat session token is missing or invalid.' });
  }
  next();
};

// No account or cookie is required. Each chat is protected by a random browser-held bearer token.
router.post('/conversations', createLimiter, chat.createConversation);
router.get('/conversations/:id/messages', tokenHeader, id, query('after').optional().isInt({ min: 0 }), validate, chat.messages);
router.post('/conversations/:id/messages', messageLimiter, tokenHeader, id,
  body('body').isString().trim().isLength({ min: 1, max: 2000 }).withMessage('Message must be between 1 and 2000 characters'),
  validate, chat.sendMessage);

// Set this URL as the Twilio WhatsApp sender's inbound-message webhook.
router.post('/whatsapp/inbound', express.urlencoded({ extended: false, limit: '16kb' }), chat.whatsappInbound);

module.exports = router;

const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { query } = require('express-validator');
const validate = require('../middleware/validate');
const { getWeather } = require('../services/weatherService');
const farmingAi = require('../services/publicFarmingAi');

const router = express.Router();
const weatherLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
const assistantLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false, message: { message: 'Please wait before sending another assistant question.' } });
const diagnosisLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { message: 'Please wait before submitting another crop case.' } });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10, fieldSize: 2500 },
  fileFilter: (req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
});

router.get('/status', (req, res) => res.json(farmingAi.status()));

router.get('/weather', weatherLimit, [
  query('lat').isFloat({ min: -90, max: 90 }),
  query('lng').isFloat({ min: -180, max: 180 }),
  query('lang').optional().isIn(['en', 'ne'])
], validate, async (req, res) => {
  try {
    const data = await getWeather(Number(req.query.lat), Number(req.query.lng), req.query.lang === 'ne' ? 'ne' : 'en');
    res.json(data);
  } catch {
    res.status(502).json({ configured: Boolean(process.env.GOOGLE_WEATHER_API_KEY), available: false, reason: 'provider_unavailable' });
  }
});

router.post('/assistant', assistantLimit, async (req, res, next) => {
  try {
    const { messages, lang } = req.body || {};
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 12 || !['en', 'ne'].includes(lang)) {
      return res.status(400).json({ message: 'Send a supported language and up to 12 conversation messages.' });
    }
    const safeMessages = [];
    let total = 0;
    for (const message of messages) {
      if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || !message.content.trim() || message.content.length > 2500) {
        return res.status(400).json({ message: 'Each message must contain a role and 1 to 2500 characters of text.' });
      }
      total += message.content.length;
      safeMessages.push({ role: message.role, content: message.content.trim() });
    }
    if (total > 10000 || safeMessages[safeMessages.length - 1].role !== 'user') {
      return res.status(400).json({ message: 'Conversation is too long or the latest message is missing.' });
    }
    const answer = await farmingAi.ask(safeMessages, lang);
    res.json({ answer });
  } catch (error) { next(error); }
});

router.post('/crop-doctor', diagnosisLimit, (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Image must be 5 MB or smaller.' });
      return res.status(400).json({ message: 'Choose a JPEG, PNG, or WebP image up to 5 MB.' });
    }
    next();
  });
}, async (req, res, next) => {
  try {
    const { crop, symptoms, plant_part: plantPart, crop_stage: cropStage, location, duration, recent_weather: recentWeather, irrigation, lang } = req.body || {};
    const optionalFields = [plantPart, cropStage, location, duration, recentWeather, irrigation];
    if (!req.file || !crop || !symptoms || String(crop).length > 80 || String(symptoms).trim().length < 8 || String(symptoms).length > 2000 || !['en', 'ne'].includes(lang) || optionalFields.some((value) => value !== undefined && (typeof value !== 'string' || value.length > 160))) {
      return res.status(400).json({ message: 'Select a crop, add a symptom description of at least 8 characters, and attach a valid image.' });
    }
    const bytes = req.file.buffer;
    const validSignature = req.file.mimetype === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8
      : req.file.mimetype === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : req.file.mimetype === 'image/webp' ? bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' : false;
    if (!validSignature) return res.status(400).json({ message: 'The image content does not match a supported image type.' });
    const analysis = await farmingAi.diagnose({ crop, symptoms: String(symptoms).trim(), plantPart, cropStage, location, duration, recentWeather, irrigation }, req.file, lang);
    res.json({ analysis, preliminary: true });
  } catch (error) { next(error); }
});

module.exports = router;

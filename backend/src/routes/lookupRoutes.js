const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/local-levels', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id, name_ne, name_en, level_type, total_wards FROM local_levels ORDER BY name_en');
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/crops', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id, code, name_ne, name_en, category FROM crops ORDER BY name_en');
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;

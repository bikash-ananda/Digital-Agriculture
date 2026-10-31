'use strict';
const express = require('express');
const { param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { harvestDatePrediction, diseaseRiskScore, moistureTrend } = require('../services/predictionEngine');

const router = express.Router();
router.use(authenticate);

const view = authorize('smart_farming.view');
const unitRule = param('unitId').isInt({ min: 1 }).toInt();

/** GET /api/predictions/:unitId/harvest */
router.get('/:unitId/harvest', view, unitRule, validate, async (req, res, next) => {
  try {
    const result = await harvestDatePrediction(req.params.unitId);
    if (!result) return res.status(404).json({ error: 'No active crop cycle found for this unit.' });
    res.json(result);
  } catch (err) { next(err); }
});

/** GET /api/predictions/:unitId/disease-risk */
router.get('/:unitId/disease-risk', view, unitRule, validate, async (req, res, next) => {
  try {
    const result = await diseaseRiskScore(req.params.unitId);
    res.json(result);
  } catch (err) { next(err); }
});

/** GET /api/predictions/:unitId/moisture-trend?hours=24 */
router.get('/:unitId/moisture-trend', view,
  unitRule,
  query('hours').optional().isInt({ min: 1, max: 720 }).toInt(),
  validate,
  async (req, res, next) => {
    try {
      const hours = req.query.hours || 24;
      const result = await moistureTrend(req.params.unitId, hours);
      res.json(result);
    } catch (err) { next(err); }
  }
);

module.exports = router;

'use strict';
/**
 * farmerAgentRoutes.js
 * REST API for Farmer Support AI Agent interactions.
 */

const express = require('express');
const { param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const agent = require('../services/farmerSupportAgent');
const waterBudget = require('../services/waterBudgetEngine');
const greenhouseAgent = require('../services/greenhouseAgentEngine');

const router = express.Router();
router.use(authenticate);

const view = authorize('smart_farming.view');
const admin = authorize('smart_farming.manage');
const unitRule = param('unitId').isInt({ min: 1 }).toInt();

/**
 * GET /api/farmer-agent/:unitId/state
 * Get current holistic sensor, disease, and harvest diagnostic state.
 */
router.get('/:unitId/state', view, unitRule, validate, async (req, res, next) => {
  try {
    const state = await agent.inspectUnitState(req.params.unitId);
    if (!state) return res.status(404).json({ message: 'Growing unit state not available.' });
    res.json(state);
  } catch (err) { next(err); }
});

/**
 * GET /api/farmer-agent/:unitId/advisory
 * Generate an instant AI-powered guidance plan for a growing unit.
 */
router.get('/:unitId/advisory', view,
  unitRule,
  query('lang').optional().isIn(['en', 'ne']),
  validate,
  async (req, res, next) => {
    try {
      const lang = req.query.lang || 'en';
      const state = await agent.inspectUnitState(req.params.unitId);
      if (!state) return res.status(404).json({ message: 'Growing unit not found.' });

      const advisory = await agent.generateSupportAdvisory(state, lang);
      res.json(advisory);
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/farmer-agent/:unitId/dispatch
 * Manually trigger dispatch of an advisory to the farmer.
 */
router.post('/:unitId/dispatch', admin,
  unitRule,
  validate,
  async (req, res, next) => {
    try {
      const state = await agent.inspectUnitState(req.params.unitId);
      if (!state) return res.status(404).json({ message: 'Growing unit not found.' });

      const advisory = await agent.generateSupportAdvisory(state, req.body.lang || 'ne');
      const result = await agent.dispatchToFarmer({
        unitId: req.params.unitId,
        advisory,
        urgent: Boolean(req.body.urgent)
      });

      res.json({ success: true, dispatch: result, advisory });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/farmer-agent/sweep
 * Admin trigger for the autonomous agent check across all growing units.
 */
router.post('/sweep', admin, async (req, res, next) => {
  try {
    const result = await agent.runAutonomousSupportSweep();
    res.json(result);
  } catch (err) { next(err); }
});


/**
 * GET /api/farmer-agent/:unitId/water-budget
 * Tank reserve forecast & solar deficit irrigation optimization.
 */
router.get('/:unitId/water-budget', view, unitRule, validate, async (req, res, next) => {
  try {
    const budget = await waterBudget.calculateWaterBudget(req.params.unitId);
    if (!budget) return res.status(404).json({ message: 'Water budget data unavailable' });
    res.json(budget);
  } catch (err) { next(err); }
});

/**
 * GET /api/farmer-agent/referral-network
 * Directory of local agriculture offices, JTAs, and Agro-Vet cooperatives in Kaski.
 */
router.get('/referral-network', view, async (req, res, next) => {
  try {
    const contacts = [
      {
        id: 'kaski-agri-center',
        name_ne: 'कृषि ज्ञान केन्द्र, कास्की',
        name_en: 'Agriculture Knowledge Center, Kaski',
        role_en: 'District Agriculture Office / JTA Support',
        phone: '+977-61-520123',
        location: 'Pokhara, Kaski',
        emergencyServices: true
      },
      {
        id: 'hemja-agro-vet',
        name_ne: 'हेम्जा जैविक कृषि सहकारी',
        name_en: 'Hemja Organic Agro-Vet Cooperative',
        role_en: 'Certified Seeds & Biological Controls',
        phone: '+977-9846012345',
        location: 'Hemja, Kaski',
        emergencyServices: false
      },
      {
        id: 'righa-farmers-group',
        name_ne: 'लेखनाथ स्मार्ट कृषि विकास समूह',
        name_en: 'Lekhnath Smart Farming Group',
        role_en: 'Greenhouse & Drip Irrigation Extension',
        phone: '+977-9856098765',
        location: 'Lekhnath, Kaski',
        emergencyServices: true
      }
    ];
    res.json(contacts);
  } catch (err) { next(err); }
});

/**
 * GET /api/farmer-agent/greenhouse/:unitId/status
 * Complete greenhouse microclimate, VPD, targets, and actuator state.
 */
router.get('/greenhouse/:unitId/status', view, unitRule, validate, async (req, res, next) => {
  try {
    const [env, targets] = await Promise.all([
      greenhouseAgent.getUnitEnvironment(req.params.unitId),
      greenhouseAgent.loadCropTargets(req.params.unitId)
    ]);
    if (!env) return res.status(404).json({ message: 'Greenhouse environment not available' });
    res.json({ ...env, ...targets });
  } catch (err) { next(err); }
});

/**
 * POST /api/farmer-agent/greenhouse/:unitId/evaluate
 * Trigger AI evaluation and autonomous actuation for this greenhouse.
 */
router.post('/greenhouse/:unitId/evaluate', admin, unitRule, validate, async (req, res, next) => {
  try {
    const outcome = await greenhouseAgent.evaluateAndControlUnit(req.params.unitId);
    res.json(outcome);
  } catch (err) { next(err); }
});

/**
 * POST /api/farmer-agent/greenhouse/loop
 * Trigger greenhouse autonomous control loop for all active greenhouses.
 */
router.post('/greenhouse/loop', admin, async (req, res, next) => {
  try {
    const outcomes = await greenhouseAgent.runAutonomousGreenhouseLoop();
    res.json({ success: true, count: outcomes.length, outcomes });
  } catch (err) { next(err); }
});
module.exports = router;

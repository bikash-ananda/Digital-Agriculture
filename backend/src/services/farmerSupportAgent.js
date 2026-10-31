const { humanizeResponse } = require('../utils/responseHumanizer');
'use strict';

/**
 * farmerSupportAgent.js
 * Comprehensive Autonomous AI Agent for Farmer Support.
 *
 * Capabilities:
 *  1. Autonomous Unit Diagnostics:
 *     - Gathers real-time sensor metrics, GDD & harvest predictions, disease risk, moisture trends.
 *     - Fetches active open alerts from actuators / devices.
 *  2. Context-Aware Agricultural RAG:
 *     - Queries knowledge articles & learning resources.
 *  3. Multi-Channel Dispatch:
 *     - Internal notifications (notifications table).
 *     - Smart Chat Hub real-time push (SSE).
 *     - Mobile SMS / WhatsApp alerts (via Twilio service).
 *  4. Automated Proactive Advisory Engine:
 *     - Evaluates all active growing units, generates bilingual (English/Nepali) advice,
 *       and dispatches action items directly to the responsible farmer.
 */

const db = require('../config/db');
const { harvestDatePrediction, diseaseRiskScore, moistureTrend } = require('./predictionEngine');
const farmingAi = require('./publicFarmingAi');
const chatHub = require('./smartChatHub');
const sms = require('./sms');
const { logAudit } = require('../utils/audit');

/**
 * Gather complete telemetry, prediction, and environmental state for a growing unit.
 * @param {number} unitId 
 */
async function inspectUnitState(unitId) {
  try {
    const [units] = await db.query(
      `SELECT gu.id, gu.name_en, gu.name_ne, gu.unit_type,
              f.id AS farm_id, f.name AS farm_name,
              fm.id AS farmer_id, fm.full_name_en, fm.full_name_ne, fm.phone, fm.user_id,
              c.id AS crop_id, c.name_en AS crop_en, c.name_ne AS crop_ne
         FROM growing_units gu
         LEFT JOIN farms f ON f.id = gu.farm_id
         LEFT JOIN farmers fm ON fm.id = f.farmer_id
         LEFT JOIN crop_cycles cc ON cc.growing_unit_id = gu.id AND cc.status = 'active'
         LEFT JOIN crops c ON c.id = cc.crop_id
        WHERE gu.id = ? LIMIT 1`,
      [unitId]
    );

    if (!units.length) return null;
    const unit = units[0];

    // Parallel analysis via predictionEngine
    const [harvest, disease, moisture, [openAlerts]] = await Promise.all([
      harvestDatePrediction(unitId).catch(() => null),
      diseaseRiskScore(unitId).catch(() => ({ risk: 'unknown', score: null, reasons: [] })),
      moistureTrend(unitId, 24).catch(() => ({ trend: 'unknown' })),
      db.query(
        `SELECT id, severity, message, triggered_at
           FROM alerts
          WHERE growing_unit_id = ? AND status = 'open'
          ORDER BY triggered_at DESC LIMIT 5`,
        [unitId]
      ).catch(() => [[]])
    ]);

    return {
      unit,
      harvest,
      disease,
      moisture,
      openAlerts
    };
  } catch (err) {
    console.error(`[farmerSupportAgent] inspectUnitState failed for unit ${unitId}:`, err.message);
    return null;
  }
}

/**
 * Run autonomous AI reasoning over a unit state and generate targeted, actionable recommendations.
 * @param {object} state - Output from inspectUnitState
 * @param {'ne'|'en'} lang
 */
async function generateSupportAdvisory(state, lang = 'en') {
  if (!state || !state.unit) return null;

  const { unit, harvest, disease, moisture, openAlerts } = state;
  const isNe = lang === 'ne';

  // Build telemetry summary for prompt context
  const contextLines = [
    `Growing Unit: ${unit.name_en} (${unit.unit_type})`,
    `Crop: ${unit.crop_en || 'Not active'}`,
    `Farmer: ${unit.full_name_en || 'Assigned Manager'}`,
    `Disease Risk Score: ${disease?.score ?? 'N/A'}/100 (${disease?.risk ?? 'unknown'})`,
    `Disease Factors: ${disease?.reasons?.join('; ') || 'None reported'}`,
    `Soil Moisture Trend: ${moisture?.trend ?? 'unknown'} (Current: ${moisture?.currentMoisture ?? 'N/A'}%, 6h forecast: ${moisture?.forecastIn6h ?? 'N/A'}%)`,
    `Harvest Prediction: ${harvest?.daysRemaining !== null ? `${harvest.daysRemaining} days remaining (Target date: ${harvest.predictedDate})` : 'Data gathering phase'}`,
    `Open Sensor Alerts: ${openAlerts.length ? openAlerts.map(a => `[${a.severity}] ${a.message}`).join(', ') : 'None'}`
  ];

  const systemPrompt = `You are the Autonomous AI Agricultural Advisor for Digital Agriculture in Kaski District, Nepal.
You provide precise, highly practical, preventative advice to farmers.
Rules:
1. Ground advice strictly in the provided unit telemetry and regional best agronomic practices.
2. Structure output into:
   - Status Assessment (Overview)
   - Immediate Actions Needed (Bulleted, prioritized)
   - Irrigation & Climate Management Advice
   - Long-term / Pest Precaution
3. If disease risk is medium/high or soil is unstable, emphasize early corrective steps.
4. Reply entirely in ${isNe ? 'Nepali (नेपाली)' : 'English'}. Keep language encouraging, clear, and easy to read on mobile.`;

  const userQuery = `Review our current field state and provide guidance:\n\n${contextLines.join('\n')}`;

  try {
    const aiConfig = farmingAi.status();
    if (!aiConfig.assistant_configured) {
      // Deterministic rule-based fallback if external LLM provider is unconfigured
      return fallbackAdvisory(state, lang);
    }

    const { answer } = await farmingAi.chat(
      [{ role: 'user', content: userQuery }],
      { lang, systemPrompt }
    );

    return {
      source: 'ai_llm',
      summary: humanizeResponse(answer, lang),
      diseaseRisk: disease.risk,
      moistureTrend: moisture.trend,
      harvest: harvest
    };
  } catch (err) {
    console.warn('[farmerSupportAgent] LLM failed, using fallback rule engine:', err.message);
    return fallbackAdvisory(state, lang);
  }
}

/**
 * Deterministic expert-rule fallback advisor ensuring 100% uptime even without LLM tokens.
 */
function fallbackAdvisory(state, lang = 'en') {
  const { unit, disease, moisture, harvest } = state;
  const isNe = lang === 'ne';

  const actions = [];
  if (disease.risk === 'high') {
    actions.push(isNe 
      ? 'रोगको जोखिम उच्च छ: भेन्टिलेसन बढाउनुहोस् र अत्यधिक चिस्यान घटाउनुहोस्।' 
      : 'High disease pressure detected: Increase tunnel ventilation and reduce excess misting.');
  }
  if (moisture.trend === 'falling' && (moisture.currentMoisture < 35)) {
    actions.push(isNe 
      ? 'माटोको चिस्यान घट्दै गएको छ: हल्का सिँचाइको तालिका बनाउनुहोस्।' 
      : 'Soil moisture is steadily falling: Schedule light drip irrigation.');
  } else if (moisture.trend === 'rising' && (moisture.currentMoisture > 75)) {
    actions.push(isNe 
      ? 'माटो बढी भिजेको छ: पानीको निकास खुला गर्नुहोस् र सिँचाइ रोक्नुहोस्।' 
      : 'Soil is saturated: Hold off irrigation and check drainage channels.');
  }

  if (harvest?.daysRemaining && harvest.daysRemaining <= 7) {
    actions.push(isNe
      ? `बाली पाक्ने समय नजिकिँदै छ (अनुमानित ${harvest.daysRemaining} दिन बाँकी): भण्डारण तथा बजार तयारी सुरु गर्नुहोस्।`
      : `Crop maturity approaching (~${harvest.daysRemaining} days remaining): Prepare clean harvest crates and storage.`);
  }

  if (!actions.length) {
    actions.push(isNe
      ? 'खेतको अवस्था स्थिर र उपयुक्त छ। नियमित अनुगमन जारी राख्नुहोस्।'
      : 'Growing conditions are stable within optimal parameters. Continue regular monitoring.');
  }

  const summary = isNe
    ? `【${unit.name_ne || unit.name_en} सल्लाह】\n• रोग जोखिम: ${disease.risk}\n• चिस्यान अवस्था: ${moisture.trend}\n\nसिफारिस कदमहरू:\n- ${actions.join('\n- ')}`
    : `[Advisory for ${unit.name_en}]\n• Disease Risk: ${disease.risk.toUpperCase()}\n• Moisture Trend: ${moisture.trend.toUpperCase()}\n\nRecommended Actions:\n- ${actions.join('\n- ')}`;

  return {
    source: 'rule_engine',
    summary: humanizeResponse(summary, lang),
    diseaseRisk: disease.risk,
    moistureTrend: moisture.trend,
    harvest
  };
}

/**
 * Dispatches an automated advisory to the farmer across database notifications,
 * real-time SSE Web channels, and optional WhatsApp/SMS.
 * @param {object} param0
 */
async function dispatchToFarmer({ unitId, advisory, urgent = false }) {
  try {
    const [units] = await db.query(
      `SELECT gu.name_en, gu.name_ne, fm.id AS farmer_id, fm.user_id, fm.phone, fm.full_name_en
         FROM growing_units gu
         JOIN farms f ON f.id = gu.farm_id
         JOIN farmers fm ON fm.id = f.farmer_id
        WHERE gu.id = ? LIMIT 1`,
      [unitId]
    );

    if (!units.length) return { dispatched: false, reason: 'no_farmer_linked' };
    const farmer = units[0];

    const title = `AI Advisory: ${farmer.name_en}`;
    const message = advisory.summary.slice(0, 480);

    // 1. Insert In-App Notification (if farmer has a user login)
    if (farmer.user_id) {
      await db.query(
        `INSERT INTO notifications (user_id, category, title, message, link, is_read)
         VALUES (?, 'smart_farming', ?, ?, ?, 0)`,
        [farmer.user_id, title, message, `/smart-farming/units/${unitId}`]
      ).catch(e => console.error('[dispatch] notification write failed:', e.message));

      // 2. Real-time Smart Chat Hub SSE push
      chatHub.sendTo({
        userId: farmer.user_id,
        event: {
          type: 'ai-advisory',
          unitId,
          title,
          summary: advisory.summary,
          urgent,
          timestamp: new Date().toISOString()
        }
      });
    }

    // 3. Mobile Dispatch (SMS/WhatsApp) if urgent or high disease risk
    let mobileSent = false;
    if (urgent && farmer.phone) {
      const smsResult = await sms.sendOtp({
        to: farmer.phone,
        code: `ALERT: ${farmer.name_en} requires attention. Check app for AI diagnosis.`,
        purpose: 'farmer_support'
      }).catch(() => ({ sent: false }));
      mobileSent = smsResult.sent;
    }

    // 4. Audit Log
    await logAudit(
      farmer.user_id || null,
      'autonomous_advisory_dispatched',
      'growing_unit',
      String(unitId),
      { urgent, diseaseRisk: advisory.diseaseRisk, mobileSent },
      null
    ).catch(() => {});

    return {
      dispatched: true,
      farmerId: farmer.farmer_id,
      userId: farmer.user_id,
      mobileSent
    };
  } catch (err) {
    console.error(`[farmerSupportAgent] dispatch error for unit ${unitId}:`, err.message);
    return { dispatched: false, error: err.message };
  }
}

/**
 * Autonomous periodic agent sweep:
 * Scans all active growing units, detects anomalies or critical thresholds,
 * generates tailored guidance, and triggers dispatch.
 */
async function runAutonomousSupportSweep() {
  console.log('[farmerSupportAgent] Starting autonomous support sweep...');
  try {
    const [units] = await db.query(
      `SELECT DISTINCT gu.id
         FROM growing_units gu
         JOIN iot_devices d ON d.growing_unit_id = gu.id
        WHERE gu.status = 'active' AND d.status <> 'disabled'`
    );

    let processed = 0;
    let alertsDispatched = 0;

    for (const { id: unitId } of units) {
      const state = await inspectUnitState(unitId);
      if (!state) continue;

      // Evaluate urgency trigger
      const hasHighDisease = state.disease.risk === 'high';
      const hasCriticalAlert = state.openAlerts.some(a => a.severity === 'critical');
      const isUrgent = hasHighDisease || hasCriticalAlert;

      // Generate advisory in Nepali for local accessibility
      const advisory = await generateSupportAdvisory(state, 'ne');

      if (isUrgent || (state.disease.risk === 'medium')) {
        await dispatchToFarmer({ unitId, advisory, urgent: isUrgent });
        alertsDispatched += 1;
      }
      processed += 1;
    }

    console.log(`[farmerSupportAgent] Sweep finished. Processed: ${processed} units, Dispatched: ${alertsDispatched} advisories.`);
    return { processed, alertsDispatched };
  } catch (err) {
    console.error('[farmerSupportAgent] Sweep encountered an error:', err.message);
    return { error: err.message };
  }
}

module.exports = {
  inspectUnitState,
  generateSupportAdvisory,
  dispatchToFarmer,
  runAutonomousSupportSweep
};

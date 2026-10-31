'use strict';
/**
 * predictionEngine.js
 * Read-only crop intelligence predictions derived from sensor_hourly,
 * sensor_daily, unit_daily, crop_cycles, and crops tables.
 *
 * Exports:
 *   harvestDatePrediction(unitId) → object | null
 *   diseaseRiskScore(unitId)      → object
 *   moistureTrend(unitId, hours)  → object
 */

const db = require('../config/db');

const TZ = '+05:45';
const LOCAL_MS = (5 * 60 + 45) * 60000;
const DEFAULT_GDD_PER_DAY = 8;

function localDate(offsetDays = 0) {
  return new Date(Date.now() + LOCAL_MS + offsetDays * 86400000).toISOString().slice(0, 10);
}

function addDays(d, n) {
  return new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

/** Simple linear regression: returns { slope, intercept } */
function linearRegression(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/**
 * Predict harvest date using accumulated GDD from unit_daily.
 * Falls back to days-to-maturity × DEFAULT_GDD_PER_DAY if no GDD target on crop.
 */
async function harvestDatePrediction(unitId) {
  try {
    const today = localDate();

    // Active crop cycle for this unit
    const [cycles] = await db.query(
      `SELECT cc.id AS cycle_id, cc.crop_id, cc.planted_on,
              c.days_to_maturity, c.gdd_to_maturity
         FROM crop_cycles cc
         JOIN crops c ON c.id = cc.crop_id
        WHERE cc.growing_unit_id = ?
          AND cc.planted_on <= ?
          AND (cc.closed_at IS NULL OR DATE(cc.closed_at) >= ?)
        ORDER BY cc.id DESC LIMIT 1`,
      [unitId, today, today]
    );

    if (!cycles.length) return null;
    const cycle = cycles[0];
    const gddRequired = cycle.gdd_to_maturity
      ? Number(cycle.gdd_to_maturity)
      : Number(cycle.days_to_maturity || 90) * DEFAULT_GDD_PER_DAY;

    // Sum GDD accumulated so far in this cycle
    const [gddRows] = await db.query(
      `SELECT SUM(COALESCE(gdd, 0)) AS total_gdd, COUNT(*) AS dap
         FROM unit_daily
        WHERE growing_unit_id = ? AND cycle_id = ? AND day <= ?`,
      [unitId, cycle.cycle_id, today]
    );

    const gddAccumulated = Number(gddRows[0]?.total_gdd || 0);
    const dap = Number(gddRows[0]?.dap || 0);
    const gddRemaining = Math.max(0, gddRequired - gddAccumulated);

    // Average GDD over last 3 days for rate estimate
    const fromDay3 = addDays(today, -3);
    const [recent] = await db.query(
      `SELECT AVG(COALESCE(gdd, 0)) AS avg_gdd
         FROM unit_daily
        WHERE growing_unit_id = ? AND cycle_id = ? AND day >= ? AND day <= ?`,
      [unitId, cycle.cycle_id, fromDay3, today]
    );
    const avgGdd = Number(recent[0]?.avg_gdd || 0);

    let daysRemaining = null;
    let predictedDate = null;
    if (avgGdd > 0) {
      daysRemaining = Math.ceil(gddRemaining / avgGdd);
      predictedDate = addDays(today, daysRemaining);
    }

    const confidence = dap >= 5 ? 'high' : dap >= 2 ? 'medium' : 'low';

    return {
      cycleId: cycle.cycle_id,
      cropId: cycle.crop_id,
      plantedOn: cycle.planted_on,
      dap,
      gddAccumulated: Math.round(gddAccumulated),
      gddRequired: Math.round(gddRequired),
      gddRemaining: Math.round(gddRemaining),
      avgGddLast3Days: Math.round(avgGdd * 10) / 10,
      daysRemaining,
      predictedDate,
      confidence,
      method: cycle.gdd_to_maturity ? 'gdd' : 'estimated-gdd'
    };
  } catch (err) {
    console.error('[predictionEngine] harvestDatePrediction error:', err.message);
    return null;
  }
}

/**
 * Disease risk score based on last 5 days of unit_daily climate data.
 */
async function diseaseRiskScore(unitId) {
  const noData = { risk: 'unknown', score: null, reasons: [], advice: 'Sensor data unavailable.' };
  try {
    const today = localDate();
    const from = addDays(today, -5);

    const [rows] = await db.query(
      `SELECT rh_avg, temp_avg, vpd_avg, day
         FROM unit_daily
        WHERE growing_unit_id = ? AND day >= ? AND day <= ?
        ORDER BY day DESC`,
      [unitId, from, today]
    );

    if (!rows.length) return noData;

    const avgRh = rows.reduce((s, r) => s + Number(r.rh_avg || 0), 0) / rows.length;
    const avgTemp = rows.reduce((s, r) => s + Number(r.temp_avg || 0), 0) / rows.length;
    const avgVpd = rows.reduce((s, r) => s + Number(r.vpd_avg || 0), 0) / rows.length;
    const wetDays = rows.filter((r) => Number(r.rh_avg || 0) > 75).length;

    let score = 0;
    const reasons = [];

    // High humidity
    if (avgRh > 80) { score += 40; reasons.push(`Average humidity ${Math.round(avgRh)}% — very high (>80%)`); }
    else if (avgRh > 70) { score += 20; reasons.push(`Average humidity ${Math.round(avgRh)}% — elevated (>70%)`); }

    // Temperature stress
    if (avgTemp < 10 || avgTemp > 35) {
      score += 30;
      reasons.push(`Average temperature ${Math.round(avgTemp * 10) / 10}°C — outside optimal range`);
    }

    // Consecutive wet days
    const wetPts = Math.min(40, wetDays * 10);
    if (wetDays >= 2) { score += wetPts; reasons.push(`${wetDays} of last 5 days above 75% humidity`); }

    // Low VPD (stagnant, humid air)
    if (avgVpd !== null && avgVpd < 0.4) {
      score += 20;
      reasons.push(`Average VPD ${Math.round(avgVpd * 100) / 100} kPa — very low, poor air movement`);
    }

    score = Math.min(100, score);
    const risk = score < 30 ? 'low' : score < 60 ? 'medium' : 'high';

    const advice =
      risk === 'high' ? 'Increase ventilation, reduce irrigation, and inspect for early disease signs.' :
      risk === 'medium' ? 'Monitor plants closely. Improve air circulation if possible.' :
      'Conditions are generally favourable. Continue routine monitoring.';

    return { risk, score: Math.round(score), reasons, advice };
  } catch (err) {
    console.error('[predictionEngine] diseaseRiskScore error:', err.message);
    return noData;
  }
}

/**
 * Soil moisture trend via linear regression over sensor_hourly data.
 */
async function moistureTrend(unitId, hours = 24) {
  const unknown = { trend: 'unknown', slope: null, currentMoisture: null, forecastIn6h: null };
  try {
    const hoursBack = Math.min(Math.max(1, parseInt(hours, 10)), 720);

    // Find soil_moisture sensors for this unit
    const [sensors] = await db.query(
      `SELECT s.id FROM sensors s
        JOIN growing_units gu ON gu.id = s.growing_unit_id
       WHERE s.growing_unit_id = ? AND s.sensor_type = 'soil_moisture' AND s.status <> 'disabled'`,
      [unitId]
    );
    if (!sensors.length) return unknown;

    const sensorIds = sensors.map((s) => s.id);
    const [rows] = await db.query(
      `SELECT UNIX_TIMESTAMP(CONVERT_TZ(hour_local, '${TZ}', '+00:00')) AS ts,
              SUM(v_avg * n) / SUM(n) AS avg_moisture, SUM(n) AS n
         FROM sensor_hourly
        WHERE sensor_id IN (?)
          AND hour_local >= CONVERT_TZ(UTC_TIMESTAMP() - INTERVAL ? HOUR, '+00:00', '${TZ}')
        GROUP BY hour_local
        ORDER BY hour_local ASC`,
      [sensorIds, hoursBack]
    );

    if (rows.length < 3) return unknown;

    const points = rows.map((r, i) => ({ x: i, y: Number(r.avg_moisture) }));
    const { slope } = linearRegression(points);

    const currentMoisture = Math.round(Number(rows[rows.length - 1].avg_moisture) * 10) / 10;
    const slopePerHour = slope; // x-unit is one hourly bucket
    const forecast = Math.min(100, Math.max(0, Math.round((currentMoisture + slopePerHour * 6) * 10) / 10));

    const trend = Math.abs(slopePerHour) < 0.5 ? 'stable' : slopePerHour > 0 ? 'rising' : 'falling';

    return {
      trend,
      slope: Math.round(slopePerHour * 100) / 100,
      currentMoisture,
      forecastIn6h: forecast,
      dataPoints: rows.length
    };
  } catch (err) {
    console.error('[predictionEngine] moistureTrend error:', err.message);
    return unknown;
  }
}

module.exports = { harvestDatePrediction, diseaseRiskScore, moistureTrend };

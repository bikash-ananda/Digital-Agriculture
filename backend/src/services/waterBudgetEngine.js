'use strict';
/**
 * waterBudgetEngine.js
 * Predictive water reservoir consumption & solar-friendly deficit irrigation calculations.
 */

const db = require('../config/db');

/**
 * Predicts water tank exhaustion timeline and recommends optimal scheduling.
 * @param {number} unitId 
 */
async function calculateWaterBudget(unitId) {
  try {
    // 1. Check water level & flow rate sensors
    const [sensors] = await db.query(
      `SELECT id, sensor_type, sensor_value FROM sensors
        WHERE growing_unit_id = ? AND sensor_type IN ('water_level', 'soil_moisture') AND status <> 'disabled'`,
      [unitId]
    );

    const waterSensor = sensors.find(s => s.sensor_type === 'water_level');
    const soilSensor = sensors.find(s => s.sensor_type === 'soil_moisture');

    // Default 1000L tank assumptions if no dedicated depth-to-volume formula is mapped
    const currentPercent = waterSensor ? Number(waterSensor.sensor_value || 50) : 50;
    const estLiters = Math.round(currentPercent * 10); // 1000L capacity assumption

    // 2. Compute historical daily consumption
    const [dailyUsage] = await db.query(
      `SELECT AVG(irrigation_min) as avg_mins, COUNT(*) as days
         FROM unit_daily
        WHERE growing_unit_id = ? AND day >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
      [unitId]
    );

    const avgMinutesPerDay = Number(dailyUsage[0]?.avg_mins || 15);
    // Standard drip line flow rate: ~4 Liters/minute
    const litersPerDay = Math.max(10, Math.round(avgMinutesPerDay * 4));
    const daysRemaining = Math.max(0, Math.round(estLiters / litersPerDay));

    const status = daysRemaining < 3 ? 'critical' : daysRemaining < 7 ? 'warning' : 'sufficient';

    // 3. Recommended Solar / Deficit Scheduling
    const recommendation = status === 'critical'
      ? {
          ne: 'पानीको सतह निकै कम छ। बिहान ६-७ वा साँझ ५-६ बजे मात्र थोपा सिँचाइ गर्नुहोस्।',
          en: 'Water reserve is critical. Restrict drip irrigation strictly to early morning (06:00-07:00) or evening (17:00-18:00) to minimize evaporation.'
        }
      : {
          ne: 'पानी पर्याप्त छ। घाम चर्किने समयमा सिँचाइ नगर्नुहोस्।',
          en: 'Reservoir is sufficient. Avoid midday watering during peak solar radiation.'
        };

    return {
      unitId,
      currentReservePercent: currentPercent,
      estimatedLiters: estLiters,
      dailyConsumptionLiters: litersPerDay,
      daysRemaining,
      status,
      optimalWindow: '06:00 - 08:00 / 17:00 - 19:00',
      recommendation
    };
  } catch (err) {
    console.error('[waterBudgetEngine] error:', err.message);
    return null;
  }
}

module.exports = { calculateWaterBudget };

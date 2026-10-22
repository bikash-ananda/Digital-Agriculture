const db = require('../config/db');
const D = require('./dataCenterService');

const number = (value) => Number(value || 0);
const scopeFor = (req, alias) => (req.user.roles.includes('super_admin')
  ? { sql: '', params: [] }
  : { sql: ' AND ' + alias + '.organization_id = ?', params: [req.user.organization_id] });

function buildRecommendations(levels) {
  const recommendations = [];
  const add = (code, level, severity, evidence, ne, en, actionNe, actionEn) => recommendations.push({
    code, local_level_id: level ? level.id : null,
    local_level_ne: level ? level.name_ne : null,
    local_level_en: level ? level.name_en : null,
    severity, evidence, message_ne: ne, message_en: en, action_ne: actionNe, action_en: actionEn
  });

  for (const level of levels) {
    if (!level.active_farmers) {
      add('no_farmer_records', level, 'review', { active_farmers: 0 },
        'यस स्थानीय तहमा प्रणालीमा सक्रिय कृषक अभिलेख छैन।',
        'There are no active farmer records for this local level.',
        'वडा कृषि शाखासँग दर्ता र तथ्याङ्क समेटिएको छ कि छैन पुष्टि गर्नुहोस्।',
        'Check with the local agriculture section whether registrations and data collection are in place.');
    }
    if (level.farms > 0 && level.geo_pct < 80) {
      add('improve_farm_location_data', level, 'review', { farms: level.farms, geocoded_farms: level.geocoded_farms, geocoded_pct: level.geo_pct },
        'फार्मका GPS स्थान कम अभिलेख भएका छन्।',
        'Farm GPS locations are missing from many records.',
        'योजना नक्सा वा सेवा मार्ग बनाउनुअघि कृषकको सहमतिमा फार्मको स्थान जाँचेर भर्नुहोस्।',
        'With the farmer’s consent, verify and record farm locations before using the map for planning or service routes.');
    }
    if (level.farms > 0 && level.environment_profile_pct < 50) {
      add('complete_environment_profile', level, 'review', {
        farms: level.farms, soil_or_water_recorded: level.environment_profiled_farms,
        environment_profile_pct: level.environment_profile_pct
      },
      'माटो वा पानीको स्रोतसम्बन्धी फार्म अभिलेख अपुग छन्।',
      'Farm records often lack soil or water-source information.',
      'माटो, पानीको स्रोत, सिँचाइ, उचाइ र सिँढीखेतको विवरण खेतमै पुष्टि गरेर थप्नुहोस्।',
      'Collect verified soil, water source, irrigation, altitude, and terrace information during a farm visit.');
    }
    if (level.active_farmers > 0 && !level.production_records) {
      add('collect_production_records', level, 'review', { active_farmers: level.active_farmers, production_records: 0 },
        'यस स्थानीय तहका सक्रिय कृषकसँग उत्पादन अभिलेख जोडिएको छैन।',
        'No crop-production records are linked to active farmers in this local level.',
        'बाली, मौसम, खेती क्षेत्रफल, उत्पादन र बिक्रीको परिमाण चयन सूचीबाट अभिलेख गर्नुहोस्।',
        'Record crop, season, cultivated area, production, and sales using the selectable survey fields.');
    }
    if (level.reported_loss_records > 0) {
      add('review_reported_crop_losses', level, 'attention', {
        fiscal_year: level.fiscal_year, reported_loss_records: level.reported_loss_records,
        loss_kg: level.loss_kg, causes: level.loss_causes
      },
      'उत्पादन अभिलेखमा बाली क्षति उल्लेख छ।',
      'Crop-production records report crop losses.',
      'कारण र परिमाण कृषि प्राविधिकसँग पुष्टि गरी स्थानीय अनुकूलन कार्यक्रमको प्राथमिकता समीक्षा गर्नुहोस्।',
      'Verify the reported cause and amount with an agriculture technician before prioritizing local adaptation support.');
    }
    if (level.farmers_without_data_consent > 0) {
      add('review_data_use_consent', level, 'attention', { farmers_without_data_consent: level.farmers_without_data_consent },
        'केही कृषकको तथ्याङ्क प्रयोग सहमति अभिलेख गरिएको छैन।',
        'Some farmer records have no recorded data-use consent.',
        'अनुसन्धान वा नयाँ उद्देश्यका लागि प्रयोग गर्नुअघि सहमति र अनुमति जाँच्नुहोस्।',
        'Check consent and authorization before using these records for research or a new purpose.');
    }
  }

  const order = { attention: 0, review: 1, information: 2 };
  return recommendations.sort((a, b) => order[a.severity] - order[b.severity]);
}

async function getKaskiPlanning(req, requestedYear) {
  const fy = D.isValidFiscalYear(requestedYear) ? requestedYear : D.fiscalYearOf();
  const farmerScope = scopeFor(req, 'f');
  const [localLevels] = await db.query(
    `SELECT ll.id, ll.name_ne, ll.name_en, ll.total_wards
       FROM local_levels ll JOIN districts d ON d.id = ll.district_id
      WHERE d.name_en = 'Kaski' ORDER BY ll.name_en`);
  const ids = localLevels.map((level) => Number(level.id));
  if (!ids.length) return { district: 'Kaski', fiscal_year: fy, sources: [], summary: {}, local_levels: [], recommendations: [] };

  const [baselines, [farmers], [farms], [production], [livestock]] = await Promise.all([
    db.query(
      `SELECT indicator_code, reference_period, indicator_value, unit, source_title, source_url, methodology_note
         FROM district_planning_baselines b JOIN districts d ON d.id = b.district_id
        WHERE d.name_en = 'Kaski' ORDER BY indicator_code, reference_period`),
    db.query(
      `SELECT f.local_level_id AS id, COUNT(*) AS active_farmers,
              SUM(f.verification_status = 'verified') AS verified_farmers,
              SUM(f.consent_data_use = 0 OR f.consent_data_use IS NULL) AS farmers_without_data_consent,
              ROUND(AVG(${D.COMPLETENESS})) AS avg_completeness
         FROM farmers f WHERE f.status = 'active' AND f.local_level_id IN (?)${farmerScope.sql}
        GROUP BY f.local_level_id`, [ids, ...farmerScope.params]),
    db.query(
      `SELECT COALESCE(fm.local_level_id, f.local_level_id) AS id, COUNT(*) AS farms,
              COALESCE(SUM(fm.latitude IS NOT NULL AND fm.longitude IS NOT NULL), 0) AS geocoded_farms,
              COALESCE(SUM(fm.area_sqm), 0) AS area_sqm,
              COALESCE(SUM(fm.soil_type IS NOT NULL OR fm.water_source IS NOT NULL OR fm.irrigated_area_sqm IS NOT NULL OR fm.altitude_m IS NOT NULL OR fm.terrace_farming IS NOT NULL OR fm.road_access IS NOT NULL OR fm.distance_to_market_km IS NOT NULL), 0) AS environment_profiled_farms,
              AVG(fm.gps_accuracy_m) AS avg_gps_accuracy_m
         FROM farms fm JOIN farmers f ON f.id = fm.farmer_id
        WHERE fm.status = 'active' AND COALESCE(fm.local_level_id, f.local_level_id) IN (?)${farmerScope.sql}
        GROUP BY COALESCE(fm.local_level_id, f.local_level_id)`, [ids, ...farmerScope.params]),
    db.query(
      `SELECT COALESCE(fm.local_level_id, f.local_level_id) AS id,
              COUNT(cp.id) AS production_records, COUNT(DISTINCT cp.crop_id) AS crop_types,
              COALESCE(SUM(cp.production_kg), 0) AS production_kg,
              COALESCE(SUM(cp.loss_kg), 0) AS loss_kg,
              COALESCE(SUM(cp.loss_cause IS NOT NULL AND cp.loss_cause <> 'none'), 0) AS reported_loss_records,
              GROUP_CONCAT(DISTINCT CASE WHEN cp.loss_cause IS NOT NULL AND cp.loss_cause <> 'none' THEN cp.loss_cause END ORDER BY cp.loss_cause SEPARATOR ', ') AS loss_causes
         FROM crop_production cp JOIN farms fm ON fm.id = cp.farm_id JOIN farmers f ON f.id = fm.farmer_id
        WHERE cp.fiscal_year = ? AND f.status = 'active' AND COALESCE(fm.local_level_id, f.local_level_id) IN (?)${farmerScope.sql}
        GROUP BY COALESCE(fm.local_level_id, f.local_level_id)`, [fy, ids, ...farmerScope.params]),
    db.query(
      `SELECT COALESCE(fm.local_level_id, f.local_level_id) AS id, COUNT(DISTINCT lh.id) AS livestock_records,
              COALESCE(SUM(lh.head_count), 0) AS animals
         FROM livestock_holdings lh JOIN farms fm ON fm.id = lh.farm_id JOIN farmers f ON f.id = fm.farmer_id
        WHERE lh.fiscal_year = ? AND f.status = 'active' AND COALESCE(fm.local_level_id, f.local_level_id) IN (?)${farmerScope.sql}
        GROUP BY COALESCE(fm.local_level_id, f.local_level_id)`, [fy, ids, ...farmerScope.params])
  ]);

  const mapRows = (rows) => new Map(rows.map((row) => [Number(row.id), row]));
  const farmerByLevel = mapRows(farmers);
  const farmByLevel = mapRows(farms);
  const productionByLevel = mapRows(production);
  const livestockByLevel = mapRows(livestock);
  const levels = localLevels.map((source) => {
    const f = farmerByLevel.get(Number(source.id)) || {};
    const fm = farmByLevel.get(Number(source.id)) || {};
    const cp = productionByLevel.get(Number(source.id)) || {};
    const lh = livestockByLevel.get(Number(source.id)) || {};
    const farmCount = number(fm.farms);
    const geocoded = number(fm.geocoded_farms);
    const environmental = number(fm.environment_profiled_farms);
    return {
      ...source,
      active_farmers: number(f.active_farmers), verified_farmers: number(f.verified_farmers),
      farmers_without_data_consent: number(f.farmers_without_data_consent), avg_completeness: number(f.avg_completeness),
      farms: farmCount, geocoded_farms: geocoded,
      geo_pct: farmCount ? Math.round((geocoded / farmCount) * 100) : 0,
      area_sqm: number(fm.area_sqm), environment_profiled_farms: environmental,
      environment_profile_pct: farmCount ? Math.round((environmental / farmCount) * 100) : 0,
      avg_gps_accuracy_m: fm.avg_gps_accuracy_m === null || fm.avg_gps_accuracy_m === undefined ? null : Math.round(number(fm.avg_gps_accuracy_m)),
      production_records: number(cp.production_records), crop_types: number(cp.crop_types),
      production_kg: number(cp.production_kg), loss_kg: number(cp.loss_kg),
      reported_loss_records: number(cp.reported_loss_records), loss_causes: cp.loss_causes || null,
      livestock_records: number(lh.livestock_records), animals: number(lh.animals), fiscal_year: fy
    };
  });

  const baselineRows = baselines[0];
  const baseline = Object.fromEntries(baselineRows.map((row) => [row.indicator_code + ':' + row.reference_period, {
    value: number(row.indicator_value), unit: row.unit, period: row.reference_period,
    source_title: row.source_title, source_url: row.source_url, note: row.methodology_note
  }]));
  const getBase = (code, period) => baseline[code + ':' + period] || null;
  const [[totals]] = await db.query(
    `SELECT COUNT(*) AS active_farmers,
            SUM(f.verification_status = 'verified') AS verified_farmers,
            SUM(f.local_level_id IS NULL) AS farmers_without_local_level,
            ROUND(AVG(${D.COMPLETENESS})) AS avg_completeness
       FROM farmers f WHERE f.status = 'active'${farmerScope.sql}`, farmerScope.params);
  const [[farmTotals]] = await db.query(
    `SELECT COUNT(*) AS farms,
            COALESCE(SUM(fm.latitude IS NOT NULL AND fm.longitude IS NOT NULL), 0) AS geocoded_farms,
            COALESCE(SUM(fm.area_sqm), 0) AS area_sqm,
            COALESCE(SUM(fm.soil_type IS NOT NULL OR fm.water_source IS NOT NULL OR fm.irrigated_area_sqm IS NOT NULL OR fm.altitude_m IS NOT NULL OR fm.terrace_farming IS NOT NULL OR fm.road_access IS NOT NULL OR fm.distance_to_market_km IS NOT NULL), 0) AS environment_profiled_farms
       FROM farms fm JOIN farmers f ON f.id = fm.farmer_id WHERE fm.status = 'active'${farmerScope.sql}`, farmerScope.params);

  const population = getBase('population_total', '2021');
  const holdings = getBase('agricultural_holdings_total', '2021/22');
  const registryScalePct = holdings && holdings.value ? Math.round((number(totals.active_farmers) / holdings.value) * 1000) / 10 : null;
  return {
    district: 'Kaski', fiscal_year: fy,
    summary: {
      active_farmers: number(totals.active_farmers), verified_farmers: number(totals.verified_farmers),
      farmers_without_local_level: number(totals.farmers_without_local_level), avg_completeness: number(totals.avg_completeness),
      farms: number(farmTotals.farms), geocoded_farms: number(farmTotals.geocoded_farms),
      geo_pct: number(farmTotals.farms) ? Math.round((number(farmTotals.geocoded_farms) / number(farmTotals.farms)) * 100) : 0,
      area_sqm: number(farmTotals.area_sqm), environment_profiled_farms: number(farmTotals.environment_profiled_farms),
      environment_profile_pct: number(farmTotals.farms) ? Math.round((number(farmTotals.environment_profiled_farms) / number(farmTotals.farms)) * 100) : 0,
      population_2021: population ? population.value : null,
      agriculture_holdings_2021_22: holdings ? holdings.value : null,
      registry_to_historical_holdings_pct: registryScalePct
    },
    baseline: baselineRows.map((row) => ({
      indicator_code: row.indicator_code, period: row.reference_period, value: number(row.indicator_value), unit: row.unit,
      source_title: row.source_title, source_url: row.source_url, note: row.methodology_note
    })),
    local_levels: levels,
    recommendations: buildRecommendations(levels)
  };
}

module.exports = { getKaskiPlanning };

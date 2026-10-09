const db = require('../config/db');

const LABELS = {
  temperature: { ne: 'हावाको तापक्रम', en: 'Air temperature', unit: '°C' },
  humidity: { ne: 'सापेक्षिक आर्द्रता', en: 'Relative humidity', unit: '%' },
  soil_moisture: { ne: 'माटोको चिस्यान', en: 'Soil moisture', unit: '%' },
  soil_temperature: { ne: 'माटोको तापक्रम', en: 'Soil temperature', unit: '°C' },
  ec: { ne: 'माटोको EC (नुन/मल स्तर)', en: 'Electrical conductivity (EC)', unit: 'mS/cm' },
  vpd: { ne: 'VPD (वाष्प चाप अन्तर)', en: 'Vapor pressure deficit (VPD)', unit: 'kPa' },
  dli: { ne: 'दैनिक प्रकाश मात्रा (DLI)', en: 'Daily light integral (DLI)', unit: 'mol/m²/day' }
};
const WEIGHTS = { temperature: 25, soil_moisture: 25, humidity: 15, vpd: 15, ec: 10, soil_temperature: 10 };
const FRESH_SECONDS = 600;
const LUX_TO_PPFD = 0.0185; // approximate conversion for sunlight

const MSG = {
  temperature: {
    high: (v, g) => [`तापक्रम उच्च छ (${v}°C, उपयुक्त ${g.opt_max}°C सम्म)। भेन्टिलेसन खोल्नुहोस्, छायाँ वा पंखा चलाउनुहोस्।`, `Temperature is high (${v}°C; optimum up to ${g.opt_max}°C). Open ventilation and use shade or fans.`],
    low: (v, g) => [`तापक्रम कम छ (${v}°C, उपयुक्त ${g.opt_min}°C देखि)। राति पर्दा/प्लास्टिक बन्द गरी चिसोबाट बचाउनुहोस्।`, `Temperature is low (${v}°C; optimum from ${g.opt_min}°C). Close curtains or covers at night to retain heat.`]
  },
  humidity: {
    high: (v) => [`आर्द्रता उच्च छ (${v}%)। हावा आवतजावत बढाउनुहोस्; ढुसी/ब्लाइट रोगको जोखिम बढ्छ।`, `Humidity is high (${v}%). Increase air movement; fungal and blight risk rises.`],
    low: (v) => [`आर्द्रता कम छ (${v}%)। मिस्टिङ वा सिँचाइ गर्नुहोस्।`, `Humidity is low (${v}%). Use misting or irrigation.`]
  },
  soil_moisture: {
    high: (v) => [`माटोमा चिस्यान धेरै छ (${v}%)। सिँचाइ रोक्नुहोस् र ड्रेनेज जाँच गर्नुहोस् (जरा कुहिने जोखिम)।`, `Soil moisture is high (${v}%). Stop irrigation and check drainage (root rot risk).`],
    low: (v) => [`माटोमा चिस्यान कम छ (${v}%)। सिँचाइ गर्नुहोस्।`, `Soil moisture is low (${v}%). Irrigate.`]
  },
  soil_temperature: {
    high: (v) => [`माटोको तापक्रम उच्च छ (${v}°C)। मल्चिङ र हल्का सिँचाइ गर्नुहोस्।`, `Soil temperature is high (${v}°C). Apply mulch and light irrigation.`],
    low: (v) => [`माटोको तापक्रम कम छ (${v}°C)। मल्चिङ गर्नुहोस् र चिसो पानीले सिँचाइ नगर्नुहोस्।`, `Soil temperature is low (${v}°C). Apply mulch and avoid very cold irrigation water.`]
  },
  ec: {
    high: (v) => [`EC उच्च छ (${v} mS/cm) — नुन/मल धेरै हुन सक्छ। स्वच्छ पानीले माटो धुनुहोस् र मलको मात्रा घटाउनुहोस्।`, `EC is high (${v} mS/cm) — possible salt or fertilizer build-up. Flush with fresh water and reduce fertilizer.`],
    low: (v) => [`EC कम छ (${v} mS/cm)। पोषक तत्व/मल थप्ने विचार गर्नुहोस्।`, `EC is low (${v} mS/cm). Consider adding nutrients or fertilizer.`]
  },
  vpd: {
    high: (v) => [`VPD उच्च छ (${v} kPa) — बिरुवाले धेरै पानी गुमाउँछ। मिस्टिङ वा छायाँ प्रयोग गर्नुहोस्।`, `VPD is high (${v} kPa) — plants lose water fast. Use misting or shading.`],
    low: (v) => [`VPD कम छ (${v} kPa) — वाष्पीकरण सुस्त र रोगको जोखिम। हावा संचार बढाउनुहोस्।`, `VPD is low (${v} kPa) — slow transpiration and disease risk. Increase air circulation.`]
  }
};

const round = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 10 ** d) / 10 ** d);
const svp = (t) => 0.6108 * Math.exp((17.27 * t) / (t + 237.3));
const calcVpd = (t, rh) => svp(t) * (1 - Math.min(Math.max(rh, 0), 100) / 100);
const calcDewPoint = (t, rh) => {
  const a = 17.27, b = 237.3;
  const al = (a * t) / (b + t) + Math.log(Math.max(rh, 1) / 100);
  return (b * al) / (a - al);
};
const fmtDate = (d) => (d instanceof Date ? d.toLocaleDateString('en-CA') : String(d).slice(0, 10));
const avgOf = (arr) => (arr && arr.length ? arr.reduce((a, s) => a + Number(s.last_value), 0) / arr.length : null);
const labelFor = (s) => (s === null ? null
  : s >= 85 ? { code: 'excellent', ne: 'उत्कृष्ट', en: 'Excellent' }
  : s >= 70 ? { code: 'good', ne: 'राम्रो', en: 'Good' }
  : s >= 50 ? { code: 'attention', ne: 'ध्यान चाहिन्छ', en: 'Needs attention' }
  : { code: 'critical', ne: 'गम्भीर', en: 'Critical' });

async function trendOf(sensorId, minutes = 60) {
  const [rows] = await db.query(
    `SELECT UNIX_TIMESTAMP(recorded_at) AS ts, value FROM sensor_readings
      WHERE sensor_id = ? AND recorded_at >= (NOW() - INTERVAL ? MINUTE) ORDER BY recorded_at`, [sensorId, minutes]);
  const n = rows.length;
  if (n < 3) return { slope_per_hour: null, stuck: false };
  const t0 = rows[0].ts;
  let sx = 0, sy = 0, sxx = 0, sxy = 0, mn = Infinity, mx = -Infinity;
  for (const r of rows) {
    const x = (r.ts - t0) / 3600;
    sx += x; sy += r.value; sxx += x * x; sxy += x * r.value;
    mn = Math.min(mn, r.value); mx = Math.max(mx, r.value);
  }
  const den = n * sxx - sx * sx;
  return { slope_per_hour: Math.abs(den) < 1e-9 ? 0 : (n * sxy - sx * sy) / den, stuck: n >= 20 && mx - mn < 1e-9 };
}

async function loadSensors(unitId) {
  const [rows] = await db.query(
    `SELECT id, sensor_type, name, unit, status, sensor_value AS last_value, last_sensor_reading_at AS last_reading_at,
            TIMESTAMPDIFF(SECOND, last_sensor_reading_at, NOW()) AS age
       FROM sensors WHERE growing_unit_id = ? AND status = 'active' ORDER BY id`, [unitId]);
  const byType = {}, stale = [];
  for (const s of rows) {
    const fresh = s.last_value !== null && s.age !== null && s.age <= FRESH_SECONDS;
    if (!fresh) { stale.push({ id: s.id, name: s.name, type: s.sensor_type }); continue; }
    (byType[s.sensor_type] = byType[s.sensor_type] || []).push(s);
  }
  return { all: rows, byType, stale };
}

async function loadCycle(unitId) {
  const [rows] = await db.query(
    `SELECT cc.*, DATEDIFF(CURDATE(), cc.planted_on) AS days_since,
            c.name_ne AS crop_ne, c.name_en AS crop_en, c.base_temp_c,
            c.description_ne AS crop_desc_ne, c.description_en AS crop_desc_en
       FROM crop_cycles cc JOIN crops c ON c.id = cc.crop_id
      WHERE cc.growing_unit_id = ? AND cc.status = 'active' ORDER BY cc.id DESC LIMIT 1`, [unitId]);
  return rows[0] || null;
}

async function loadStage(cycle) {
  if (!cycle) return null;
  const [stages] = await db.query('SELECT * FROM crop_stages WHERE crop_id = ? ORDER BY sort_order', [cycle.crop_id]);
  if (!stages.length) return null;
  const last = stages[stages.length - 1];
  let stage = cycle.stage_override ? stages.find((s) => s.stage_code === cycle.stage_override) : null;
  if (!stage) {
    stage = stages.find((s) => cycle.days_since >= s.start_day && cycle.days_since <= s.end_day)
      || (cycle.days_since > last.end_day ? last : stages[0]);
  }
  return { ...stage, overridden: !!(cycle.stage_override && stage.stage_code === cycle.stage_override),
    progress_percent: Math.max(0, Math.min(100, Math.round((cycle.days_since / last.end_day) * 100))), total_days: last.end_day };
}

async function loadTargets(cycle, stageCode) {
  const [[g]] = await db.query("SELECT id FROM crops WHERE code = 'GENERIC'");
  const genericId = g ? g.id : 0;
  const cropId = cycle ? cycle.crop_id : genericId;
  const [rows] = await db.query(
    "SELECT * FROM crop_stage_targets WHERE crop_id IN (?, ?) AND stage_code IN ('all', ?)", [cropId, genericId, stageCode || 'all']);
  const rank = (r) => (r.crop_id === cropId ? 2 : 0) + (r.stage_code !== 'all' ? 1 : 0);
  const best = {};
  for (const r of rows) if (!best[r.parameter] || rank(r) > best[r.parameter].rank) best[r.parameter] = { ...r, rank: rank(r) };
  return best;
}

async function dliToday(sensorId) {
  const [rows] = await db.query(
    'SELECT UNIX_TIMESTAMP(recorded_at) AS ts, value FROM sensor_readings WHERE sensor_id = ? AND recorded_at >= CURDATE() ORDER BY recorded_at', [sensorId]);
  if (rows.length < 2) return null;
  let mol = 0;
  for (let i = 1; i < rows.length; i++) {
    const dt = Math.min(rows[i].ts - rows[i - 1].ts, 600);
    mol += ((((rows[i].value + rows[i - 1].value) / 2) * LUX_TO_PPFD) * dt) / 1e6;
  }
  return mol;
}

async function gddFor(sensorIds, base, since) {
  if (!sensorIds.length) return { today: null, accumulated: null };
  const [rows] = await db.query(
    `SELECT DATE_FORMAT(recorded_at, '%Y-%m-%d') AS d, MAX(value) AS mx, MIN(value) AS mn
       FROM sensor_readings WHERE sensor_id IN (?) AND recorded_at >= ? GROUP BY d ORDER BY d`, [sensorIds, since]);
  const todayStr = new Date().toLocaleDateString('en-CA');
  let acc = 0, today = null;
  for (const r of rows) {
    const g = Math.max(0, (r.mx + r.mn) / 2 - Number(base));
    acc += g;
    if (r.d === todayStr) today = g;
  }
  return { today: rows.length ? (today === null ? 0 : today) : null, accumulated: rows.length ? acc : null };
}

function evaluate(v, t) {
  if (v === null) return { status: 'no_data', score: null };
  if (v < t.min_value) return { status: 'critical_low', score: 10 };
  if (v > t.max_value) return { status: 'critical_high', score: 10 };
  if (v < t.opt_min) return { status: 'low', score: 100 - 70 * ((t.opt_min - v) / Math.max(t.opt_min - t.min_value, 1e-6)) };
  if (v > t.opt_max) return { status: 'high', score: 100 - 70 * ((v - t.opt_max) / Math.max(t.max_value - t.opt_max, 1e-6)) };
  return { status: 'optimal', score: 100 };
}

function buildRisks(v) {
  const risks = [];
  if (v.temperature !== null && v.humidity !== null) {
    const dp = calcDewPoint(v.temperature, v.humidity);
    if (v.temperature - dp < 1.5)
      risks.push({ code: 'condensation', level: 'high', message_ne: 'पातमा ओस/पानी जम्ने (कन्डेन्सेसन) जोखिम उच्च — ओसिलोपनले रोग बढाउँछ।', message_en: 'High condensation risk — wet leaf surfaces favour disease.' });
    if (v.temperature >= 15 && v.temperature <= 28 && v.humidity >= 80)
      risks.push({ code: 'fungal_risk', level: v.humidity >= 85 ? 'high' : 'medium', message_ne: 'ढुसी रोगको जोखिम सूचक: न्यानो र ओसिलो अवस्था लामो रहे ब्लाइट/ढुसी लाग्न सक्छ।', message_en: 'Fungal risk indicator: warm, humid conditions that persist can lead to blight or mould.' });
  }
  return risks;
}

function buildRecs(params, risks, forecast) {
  const recs = [];
  for (const p of params) {
    if (!MSG[p.key] || !p.target) continue;
    const side = p.status.endsWith('_low') || p.status === 'low' ? 'low' : (p.status.endsWith('_high') || p.status === 'high' ? 'high' : null);
    if (!side) continue;
    const [ne, en] = MSG[p.key][side](p.value, p.target);
    recs.push({ code: `${p.key}_${side}`, severity: p.status.startsWith('critical') ? 'critical' : 'warning', category: p.key, message_ne: ne, message_en: en });
  }
  for (const r of risks) if (r.level === 'high')
    recs.push({ code: r.code, severity: 'warning', category: 'risk', message_ne: r.message_ne, message_en: r.message_en });
  if (forecast.soil_moisture_hours_to_low !== null && forecast.soil_moisture_hours_to_low <= 6)
    recs.push({ code: 'irrigation_soon', severity: 'info', category: 'forecast',
      message_ne: `माटोको चिस्यान घट्दै छ — करिब ${forecast.soil_moisture_hours_to_low} घण्टामा सिँचाइ आवश्यक हुनेछ।`,
      message_en: `Soil moisture is falling — irrigation will be needed in about ${forecast.soil_moisture_hours_to_low} hours.` });
  const order = { critical: 0, warning: 1, info: 2 };
  return recs.sort((a, b) => order[a.severity] - order[b.severity]);
}

function describe(cycle, stage, p, health, lastObs) {
  const ne = [], en = [];
  const g = (k, d = 1) => (p[k] && p[k].value !== null ? round(p[k].value, d) : null);
  if (!cycle) {
    ne.push('यस इकाईमा हाल कुनै सक्रिय बाली चक्र दर्ता गरिएको छैन। बाली चक्र दर्ता गरेपछि बिरुवाको विवरण र चरण अनुसारको विश्लेषण स्वतः देखिनेछ।');
    en.push('No active crop cycle is registered for this unit. Register one to get an automatic plant description and stage-based analysis.');
  } else {
    const v = cycle.variety ? ` (${cycle.variety})` : '';
    ne.push(`${cycle.crop_ne}${v} — ब्याच ${cycle.batch_code}। ${fmtDate(cycle.planted_on)} मा रोपिएको, आज ${cycle.days_since} दिन भयो${stage ? `; हालको चरण: ${stage.name_ne} (वृद्धि प्रगति ${stage.progress_percent}%)` : ''}।`);
    en.push(`${cycle.crop_en}${v} — batch ${cycle.batch_code}. Planted on ${fmtDate(cycle.planted_on)}, now day ${cycle.days_since}${stage ? `; current stage: ${stage.name_en} (growth progress ${stage.progress_percent}%)` : ''}.`);
    if (cycle.crop_desc_ne) { ne.push(cycle.crop_desc_ne); en.push(cycle.crop_desc_en); }
    if (stage && stage.description_ne) { ne.push(stage.description_ne); en.push(stage.description_en); }
  }
  const items = [['temperature', 'तापक्रम', 'Temperature', '°C'], ['humidity', 'आर्द्रता', 'Humidity', '%'], ['soil_moisture', 'माटोको चिस्यान', 'Soil moisture', '%'],
    ['soil_temperature', 'माटोको तापक्रम', 'Soil temperature', '°C'], ['ec', 'EC', 'EC', ' mS/cm'], ['vpd', 'VPD', 'VPD', ' kPa']];
  const have = items.filter(([k]) => g(k) !== null);
  if (have.length) {
    ne.push(`हालको वातावरण: ${have.map(([k, n, , u]) => `${n} ${g(k)}${u}`).join(', ')}।`);
    en.push(`Current conditions: ${have.map(([k, , e, u]) => `${e} ${g(k)}${u}`).join(', ')}.`);
  }
  if (health) {
    ne.push(`समग्र स्वास्थ्य स्कोर ${health.score}/100 (${health.label.ne})।`);
    en.push(`Overall health score ${health.score}/100 (${health.label.en}).`);
  }
  if (lastObs) {
    const bitsNe = [], bitsEn = [];
    if (lastObs.plant_height_cm !== null) { bitsNe.push(`उचाइ ${lastObs.plant_height_cm} से.मि.`); bitsEn.push(`height ${lastObs.plant_height_cm} cm`); }
    if (lastObs.leaf_count !== null) { bitsNe.push(`पात ${lastObs.leaf_count} वटा`); bitsEn.push(`${lastObs.leaf_count} leaves`); }
    if (lastObs.pest_disease) { bitsNe.push(`रोग/कीरा: ${lastObs.pest_disease}`); bitsEn.push(`pest/disease: ${lastObs.pest_disease}`); }
    if (bitsNe.length) {
      ne.push(`अन्तिम हातले गरिएको अवलोकन (${fmtDate(lastObs.observed_at)}): ${bitsNe.join(', ')}।`);
      en.push(`Latest manual observation (${fmtDate(lastObs.observed_at)}): ${bitsEn.join(', ')}.`);
    }
  }
  return { ne, en };
}

async function analyzeUnit(unitId) {
  const [cycle, sens] = await Promise.all([loadCycle(unitId), loadSensors(unitId)]);
  const stage = await loadStage(cycle);
  const targets = await loadTargets(cycle, stage && stage.stage_code);
  const now = new Date();

  const t = avgOf(sens.byType.temperature), rh = avgOf(sens.byType.humidity);
  const values = {
    temperature: t, humidity: rh, soil_moisture: avgOf(sens.byType.soil_moisture),
    soil_temperature: avgOf(sens.byType.soil_temperature), ec: avgOf(sens.byType.ec),
    vpd: t !== null && rh !== null ? calcVpd(t, rh) : null
  };
  const hasType = (k) => sens.all.some((s) => s.sensor_type === k);

  const params = [];
  for (const key of ['temperature', 'humidity', 'soil_moisture', 'soil_temperature', 'ec', 'vpd']) {
    const v = values[key];
    if (v === null && (key === 'vpd' || !hasType(key))) continue;
    const tg = targets[key] || null;
    const ev = tg ? evaluate(v, tg) : { status: v === null ? 'no_data' : 'no_target', score: null };
    const tr = sens.byType[key] && key !== 'vpd' ? await trendOf(sens.byType[key][0].id, 60) : null;
    params.push({
      key, label_ne: LABELS[key].ne, label_en: LABELS[key].en, unit: LABELS[key].unit, value: round(v), status: ev.status, score: ev.score,
      target: tg ? { min: tg.min_value, opt_min: tg.opt_min, opt_max: tg.opt_max, max: tg.max_value } : null,
      trend_per_hour: tr ? round(tr.slope_per_hour, 2) : null, stuck: tr ? tr.stuck : false, sensor_count: (sens.byType[key] || []).length
    });
  }

  const lightSensor = sens.all.find((s) => s.sensor_type === 'light');
  const dli = lightSensor ? await dliToday(lightSensor.id) : null;
  if (dli !== null) {
    const tg = targets.dli || null;
    const evaluated = tg && now.getHours() >= 17 ? evaluate(dli, tg) : { status: tg ? 'accumulating' : 'no_target', score: null };
    params.push({ key: 'dli', label_ne: LABELS.dli.ne, label_en: LABELS.dli.en, unit: LABELS.dli.unit, value: round(dli), status: evaluated.status, score: null,
      target: tg ? { min: tg.min_value, opt_min: tg.opt_min, opt_max: tg.opt_max, max: tg.max_value } : null, trend_per_hour: null, stuck: false, sensor_count: 1 });
  }

  let wSum = 0, sSum = 0;
  for (const p of params) if (p.score !== null && WEIGHTS[p.key]) { wSum += WEIGHTS[p.key]; sSum += WEIGHTS[p.key] * p.score; }
  const score = wSum ? Math.round(sSum / wSum) : null;
  const health = score === null ? null : { score, label: labelFor(score) };

  const base = cycle ? Number(cycle.base_temp_c) : 10;
  const tempIds = (sens.all.filter((s) => s.sensor_type === 'temperature')).map((s) => s.id);
  const gdd = await gddFor(tempIds, base, cycle ? cycle.planted_on : new Date().toLocaleDateString('en-CA'));

  const sm = params.find((p) => p.key === 'soil_moisture');
  const forecast = { soil_moisture_hours_to_low: null };
  if (sm && sm.target && sm.value !== null && sm.trend_per_hour !== null && sm.trend_per_hour < -0.1 && sm.value > sm.target.opt_min) {
    const h = (sm.value - sm.target.opt_min) / -sm.trend_per_hour;
    if (Number.isFinite(h) && h < 48) forecast.soil_moisture_hours_to_low = round(h, 1);
  }

  const risks = buildRisks(values);
  const recommendations = buildRecs(params, risks, forecast);

  let lastObs = null;
  if (cycle) {
    const [o] = await db.query('SELECT * FROM manual_observations WHERE cycle_id = ? ORDER BY observed_at DESC, id DESC LIMIT 1', [cycle.id]);
    lastObs = o[0] || null;
  }
  const pm = Object.fromEntries(params.map((p) => [p.key, p]));

  return {
    unit_id: Number(unitId), generated_at: now.toISOString(),
    cycle: cycle ? { id: cycle.id, batch_code: cycle.batch_code, crop_ne: cycle.crop_ne, crop_en: cycle.crop_en, variety: cycle.variety,
      planted_on: cycle.planted_on, days_since: cycle.days_since, plant_count: cycle.plant_count, expected_harvest_on: cycle.expected_harvest_on } : null,
    stage: stage ? { code: stage.stage_code, name_ne: stage.name_ne, name_en: stage.name_en, progress_percent: stage.progress_percent, total_days: stage.total_days, overridden: stage.overridden } : null,
    health, parameters: params,
    derived: { vpd: round(values.vpd), dew_point: t !== null && rh !== null ? round(calcDewPoint(t, rh)) : null, dli: round(dli),
      gdd_today: round(gdd.today), gdd_accumulated: round(gdd.accumulated), base_temp: base },
    risks, recommendations, forecast,
    data_quality: { stale_sensors: sens.stale, stuck_sensors: params.filter((p) => p.stuck).map((p) => p.key) },
    description: describe(cycle, stage, pm, health, lastObs)
  };
}

module.exports = { analyzeUnit };

const NAME_MAP = {
  air_temperature_c: 'temperature', air_humidity_pct: 'humidity', soil_moisture_pct: 'soil_moisture', soil_temperature_c: 'soil_temperature',
  light_lux: 'light', ec_ms_cm: 'ec', water_level_pct: 'water_level', co2_ppm: 'co2', ph: 'ph', leaf_wetness_pct: 'leaf_wetness',
  water_temperature_c: 'water_temperature', flow_l_min: 'flow', pressure_kpa: 'pressure', wind_speed_ms: 'wind_speed', rainfall_mm: 'rainfall'
};

function toSensorTypeKey(name) {
  if (NAME_MAP[name]) return NAME_MAP[name];
  const match = /^(.+)_(\d+)_(c|pct|lux|ms_cm|ppm|l_min|kpa|ms|mm)$/.exec(name);
  if (match && NAME_MAP[`${match[1]}_${match[3]}`]) return `${NAME_MAP[`${match[1]}_${match[3]}`]}_${match[2]}`;
  return null;
}

function indexSensors(sensors) {
  const byKey = new Map();
  for (const sensor of sensors) {
    const key = sensor.channel_key || sensor.sensor_type;
    if (key && !byKey.has(key)) byKey.set(key, sensor);
  }
  return byKey;
}

function resolveTelemetrySensor(name, byKey) {
  const normalized = toSensorTypeKey(name);
  // Standard firmware names resolve by known sensor type; custom names resolve only
  // when an administrator explicitly registered that exact channel key.
  return (normalized && byKey.get(normalized)) || byKey.get(name) || null;
}

module.exports = { indexSensors, resolveTelemetrySensor, toSensorTypeKey };

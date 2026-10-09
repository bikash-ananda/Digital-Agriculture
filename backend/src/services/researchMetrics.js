const M = {
  temp_avg: ['तापक्रम (औसत)', 'Air temperature, mean', '°C', 'Mean of the hourly mean air temperatures.'],
  temp_min: ['तापक्रम (न्यूनतम)', 'Air temperature, minimum', '°C', 'Lowest raw reading of the day.'],
  temp_max: ['तापक्रम (अधिकतम)', 'Air temperature, maximum', '°C', 'Highest raw reading of the day.'],
  rh_avg: ['आर्द्रता (औसत)', 'Relative humidity, mean', '%', 'Mean of the hourly mean relative humidity.'],
  vpd_avg: ['VPD (औसत)', 'Vapour pressure deficit, mean', 'kPa', 'Mean of hourly VPD from hourly mean temperature and humidity: VPD = 0.6108*exp(17.27*T/(T+237.3))*(1-RH/100).'],
  vpd_max: ['VPD (उच्चतम घण्टा)', 'Vapour pressure deficit, peak hour', 'kPa', 'Highest hourly VPD. Hourly means smooth out short peaks.'],
  dew_point_min: ['शीत बिन्दु (न्यूनतम)', 'Dew point, minimum', '°C', 'Lowest hourly dew point (Magnus formula).'],
  dli: ['दैनिक प्रकाश मात्रा (DLI)', 'Daily light integral', 'mol/m²/day', 'Sum over hours of mean lux x 0.0185 umol/m²/s per lux x 3600 s. The factor suits sunlight; artificial light needs another factor.'],
  gdd: ['वृद्धि दिन तापक्रम (GDD)', 'Growing degree days', '°C·day', 'max(0, (Tmax+Tmin)/2 - base). Base temperature comes from the active crop (default 10 C).'],
  soil_moisture_avg: ['माटोको चिस्यान (औसत)', 'Soil moisture, mean', '%', 'Mean of hourly mean soil moisture.'],
  soil_moisture_min: ['माटोको चिस्यान (न्यूनतम)', 'Soil moisture, minimum', '%', 'Lowest raw reading of the day.'],
  soil_moisture_max: ['माटोको चिस्यान (अधिकतम)', 'Soil moisture, maximum', '%', 'Highest raw reading of the day.'],
  soil_temp_avg: ['माटोको तापक्रम (औसत)', 'Soil temperature, mean', '°C', 'Mean of hourly mean soil temperature.'],
  ec_avg: ['EC (औसत)', 'Electrical conductivity, mean', 'mS/cm', 'Mean of hourly mean EC.'],
  water_level_min: ['पानी तह (न्यूनतम)', 'Water tank level, minimum', '%', 'Lowest raw reading of the day.'],
  irrigation_min: ['सिँचाइ समय', 'Irrigation run time', 'min/day', 'Total ON time of irrigation actuators, from actuator events.'],
  misting_min: ['मिस्टिङ समय', 'Misting run time', 'min/day', 'Total ON time of misting actuators.'],
  fan_min: ['पंखा समय', 'Fan run time', 'min/day', 'Total ON time of fan actuators.'],
  irrigation_events: ['सिँचाइ पटक', 'Irrigation events', 'count', 'Number of irrigation runs overlapping the day.'],
  tir_temp: ['उपयुक्त दायरामा तापक्रम', 'Time in range: temperature', '% of hours', 'Share of hours whose mean temperature was inside the crop optimum range.'],
  tir_rh: ['उपयुक्त दायरामा आर्द्रता', 'Time in range: humidity', '% of hours', 'Share of hours whose mean humidity was inside the optimum range.'],
  tir_soil_moisture: ['उपयुक्त दायरामा माटो चिस्यान', 'Time in range: soil moisture', '% of hours', 'Share of hours whose mean soil moisture was inside the optimum range.'],
  tir_vpd: ['उपयुक्त दायरामा VPD', 'Time in range: VPD', '% of hours', 'Share of hours whose VPD was inside the optimum range.'],
  h_temp_above: ['उपयुक्तभन्दा तातो घण्टा', 'Hours above optimum temperature', 'hours', 'Hours whose mean temperature exceeded the optimum maximum.'],
  h_temp_below: ['उपयुक्तभन्दा चिसो घण्टा', 'Hours below optimum temperature', 'hours', 'Hours whose mean temperature was under the optimum minimum.'],
  data_coverage: ['तथ्याङ्क कभरेज', 'Data coverage', '%', 'Mean over active sensors of hours with data divided by hours elapsed.']
};

const METRICS = Object.fromEntries(Object.entries(M).map(([k, v]) => [k, { ne: v[0], en: v[1], unit: v[2], def: v[3] }]));
module.exports = { METRICS, KEYS: Object.keys(METRICS) };

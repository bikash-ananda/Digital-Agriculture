export const STATUS = {
  optimal: { cls: 'bg-green-100 text-green-800', bar: '#16a34a', ne: 'उपयुक्त', en: 'Optimal' },
  low: { cls: 'bg-yellow-100 text-yellow-800', bar: '#d97706', ne: 'कम', en: 'Low' },
  high: { cls: 'bg-yellow-100 text-yellow-800', bar: '#d97706', ne: 'उच्च', en: 'High' },
  critical_low: { cls: 'bg-red-100 text-red-800', bar: '#dc2626', ne: 'अति कम', en: 'Too low' },
  critical_high: { cls: 'bg-red-100 text-red-800', bar: '#dc2626', ne: 'अति उच्च', en: 'Too high' },
  accumulating: { cls: 'bg-blue-100 text-blue-800', bar: '#2563eb', ne: 'जम्मा हुँदै', en: 'Accumulating' },
  no_target: { cls: 'bg-gray-100 text-gray-700', bar: '#94a3b8', ne: 'लक्ष्य छैन', en: 'No target' },
  no_data: { cls: 'bg-gray-100 text-gray-700', bar: '#94a3b8', ne: 'डाटा छैन', en: 'No data' }
};

export const PARAM_ICON = { temperature: '🌡️', humidity: '💧', soil_moisture: '🌱', soil_temperature: '🪴', ec: '🧪', vpd: '🌫️', dli: '☀️' };
export const ANALYZED = ['temperature', 'humidity', 'soil_moisture', 'soil_temperature', 'ec'];

export const SENSOR_LABEL = {
  light: { ne: 'प्रकाश', en: 'Light', icon: '☀️' },
  water_level: { ne: 'पानीको तह', en: 'Water level', icon: '🛢️' },
  co2: { ne: 'कार्बन डाइअक्साइड', en: 'CO₂', icon: '🫧' },
  leaf_wetness: { ne: 'पातको ओसिलोपन', en: 'Leaf wetness', icon: '🍃' },
  water_temperature: { ne: 'पानीको तापक्रम', en: 'Water temperature', icon: '🌊' },
  flow: { ne: 'पानी प्रवाह', en: 'Flow', icon: '🚰' },
  ph: { ne: 'pH', en: 'pH', icon: '⚗️' },
  pressure: { ne: 'चाप', en: 'Pressure', icon: '⏲️' },
  wind_speed: { ne: 'हावाको गति', en: 'Wind speed', icon: '💨' },
  rainfall: { ne: 'वर्षा', en: 'Rainfall', icon: '🌧️' },
  other: { ne: 'अन्य', en: 'Other', icon: '📟' }
};

export const ACT_LABEL = {
  irrigation: { ne: 'सिँचाइ', en: 'Irrigation', icon: '💦' },
  misting: { ne: 'मिस्टिङ', en: 'Misting', icon: '🌫️' },
  fan: { ne: 'पंखा', en: 'Fan', icon: '🌀' },
  heater: { ne: 'हिटर', en: 'Heater', icon: '🔥' },
  vent: { ne: 'भेन्टिलेसन', en: 'Vent', icon: '🪟' },
  light: { ne: 'बत्ती', en: 'Light', icon: '💡' },
  shade: { ne: 'छायाँ पर्दा', en: 'Shade', icon: '⛱️' },
  fertigation: { ne: 'फर्टिगेसन', en: 'Fertigation', icon: '🧴' },
  pump: { ne: 'पम्प', en: 'Pump', icon: '⚙️' },
  relay: { ne: 'रिले', en: 'Relay', icon: '🔌' },
  other: { ne: 'अन्य', en: 'Other', icon: '🔌' }
};

export const CMP = { lt: '<', gt: '>', lte: '≤', gte: '≥' };
export const fmt = (v, d = 1) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(d));
export const ageText = (sec) => (sec === null || sec === undefined ? '—' : sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.floor(sec / 60)}m` : `${Math.floor(sec / 3600)}h`);

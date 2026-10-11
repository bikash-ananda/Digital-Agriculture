export const TYPE = {
  temperature: { ne: 'तापक्रम', en: 'Temperature', unit: '°C', icon: '🌡️', color: '#dc2626', d: 1 },
  humidity: { ne: 'आर्द्रता', en: 'Humidity', unit: '%', icon: '💧', color: '#2563eb', d: 0 },
  soil_moisture: { ne: 'माटोको चिस्यान', en: 'Soil moisture', unit: '%', icon: '🌱', color: '#15803d', d: 1 },
  light: { ne: 'प्रकाश', en: 'Light', unit: 'lux', icon: '☀️', color: '#d97706', d: 0 },
  soil_temperature: { ne: 'माटोको तापक्रम', en: 'Soil temperature', unit: '°C', icon: '🪴', color: '#92400e', d: 1 },
  ec: { ne: 'EC', en: 'EC', unit: 'mS/cm', icon: '🧪', color: '#7c3aed', d: 2 },
  water_level: { ne: 'पानीको तह', en: 'Water level', unit: '%', icon: '🛢️', color: '#0891b2', d: 0 }
};
export const meta = (t) => TYPE[t] || { ne: t, en: t, unit: '', icon: '📟', color: '#475569', d: 1 };
export const fv = (v, d = 1) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(d));
export const ageText = (s, t) => (s === null || s === undefined ? '—' : s < 60 ? `${s} ${t('से. अघि', 's ago')}` : s < 3600 ? `${Math.floor(s / 60)} ${t('मि. अघि', 'min ago')}` : `${Math.floor(s / 3600)} ${t('घण्टा अघि', 'h ago')}`);
export const dur = (s) => (s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`);
export const hhmm = (ts) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const dayhm = (ts) => new Date(ts * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
export const CMD = {
  pending: { cls: 'bg-blue-100 text-blue-800', ne: 'पर्खिँदै', en: 'Waiting' }, sent: { cls: 'bg-blue-100 text-blue-800', ne: 'यन्त्रले पायो', en: 'Received' },
  acknowledged: { cls: 'bg-green-100 text-green-800', ne: 'सम्पन्न', en: 'Done' }, failed: { cls: 'bg-red-100 text-red-800', ne: 'असफल', en: 'Failed' },
  expired: { cls: 'bg-gray-200 text-gray-700', ne: 'म्याद सकियो', en: 'Expired' }, cancelled: { cls: 'bg-gray-200 text-gray-700', ne: 'रद्द', en: 'Cancelled' },
  queued: { cls: 'bg-blue-100 text-blue-800', ne: 'लाइनमा', en: 'Queued' }, ok: { cls: 'bg-green-100 text-green-800', ne: 'सम्पन्न', en: 'Done' },
  error: { cls: 'bg-red-100 text-red-800', ne: 'त्रुटि', en: 'Error' }, rejected: { cls: 'bg-red-100 text-red-800', ne: 'अस्वीकृत', en: 'Rejected' },
  skipped: { cls: 'bg-gray-200 text-gray-700', ne: 'छोडियो', en: 'Skipped' }, started: { cls: 'bg-yellow-100 text-yellow-800', ne: 'सुरु भयो', en: 'In progress' }
};
export function friendly(msg, t) {
  const m = String(msg || '').toLowerCase();
  if (m.includes('cooldown')) return t('पम्पले आराम गर्दैछ (न्यूनतम बन्द समय)', 'The pump is resting (minimum off time)');
  if (m.includes('water')) return t('पानीको तह कम छ', 'Water level is too low');
  return msg || '';
}

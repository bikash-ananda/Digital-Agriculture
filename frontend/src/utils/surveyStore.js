const KEY = 'da_surveys_v1';
const LKEY = 'da_survey_lookups_v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (a) => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* storage full or blocked */ } };

export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const emptyData = () => ({
  farmer: { full_name_ne: '', full_name_en: '', gender: '', date_of_birth: '', phone: '', local_level_id: '', ward_no: '', address: '', group_name: '', farmer_type: 'individual', farmer_category: '', household_members: '', agri_workers: '', main_occupation: '', education_level: '' },
  farm: { name: '', address: '', area_sqm: '', ownership_type: 'owned', irrigation_type: 'none', land_use: 'cultivated', soil_type: '', water_source: '', irrigated_area_sqm: '', altitude_m: '', terrace_farming: false, road_access: '', distance_to_market_km: '', latitude: '', longitude: '', gps_accuracy_m: '', location_source: '' },
  crops: [], livestock: [], consent: { data_use: false, research: false }
});

export const newSurvey = () => ({ id: uuid(), status: 'draft', error: '', updated_at: Date.now(), data: emptyData() });
export const listSurveys = () => read().sort((a, b) => b.updated_at - a.updated_at);
export const getSurvey = (id) => read().find((s) => s.id === id) || null;
export function saveSurvey(s) { write([...read().filter((x) => x.id !== s.id), { ...s, updated_at: Date.now() }]); }
export const removeSurvey = (id) => write(read().filter((s) => s.id !== id));

export const cacheLookups = (v) => { try { localStorage.setItem(LKEY, JSON.stringify(v)); } catch { /* ignore */ } };
export const readLookups = () => { try { return JSON.parse(localStorage.getItem(LKEY) || 'null'); } catch { return null; } };

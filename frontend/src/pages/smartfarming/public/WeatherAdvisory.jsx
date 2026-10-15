import { useCallback, useEffect, useRef, useState } from 'react';
import { CloudRain, CloudSun, Droplets, LocateFixed, RefreshCw, Thermometer, Wind } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import { office } from '../../../data/office';
import { Callout, PublicPage } from './common';
import { copy, field, surface } from './helpers';

function formatTime(value, lang, timeZone) {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ne-NP', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(value)); }
  catch { return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
}

export default function WeatherAdvisory() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  const [coords, setCoords] = useState({ lat: String(office.lat), lng: String(office.lng) });
  const [locationName, setLocationName] = useState(copy(lang, 'Kaski office reference location', 'कृषि विकास कार्यालय, कास्की वरिपरि'));
  const [weather, setWeather] = useState(null);
  const lastLocation = useRef({ lat: String(office.lat), lng: String(office.lng) });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (lat, lng) => {
    setLoading(true); setError('');
    lastLocation.current = { lat: String(lat), lng: String(lng) };
    try {
      const { data } = await api.get('/public-farming/weather', { params: { lat, lng, lang } });
      setWeather(data);
    } catch (cause) {
      setWeather(cause.response?.data || { configured: true, available: false, reason: 'provider_unavailable' });
      setError(cause.response?.status === 400 ? copy(lang, 'Enter valid latitude and longitude.', 'मान्य अक्षांश र देशान्तर राख्नुहोस्।') : '');
    } finally { setLoading(false); }
  }, [lang]);
  useEffect(() => { load(lastLocation.current.lat, lastLocation.current.lng); }, [lang, load]);
  const useLocation = () => {
    if (!navigator.geolocation) { setError(copy(lang, 'Location is not supported by this browser.', 'यस ब्राउजरमा स्थान सेवा छैन।')); return; }
    setError('');
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude.toFixed(5), lng = position.coords.longitude.toFixed(5);
      setCoords({ lat, lng }); setLocationName(copy(lang, 'Current device location', 'हालको उपकरणको स्थान')); load(lat, lng);
    }, () => setError(copy(lang, 'Location permission was unavailable. Enter coordinates or use the Kaski office reference.', 'स्थान अनुमति उपलब्ध भएन। निर्देशाङ्क राख्नुहोस् वा कार्यालयको सन्दर्भ स्थान प्रयोग गर्नुहोस्।')), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  };
  const current = weather?.current;
  const hourly = weather?.hourly || [];
  const rainyHours = hourly.filter((hour) => Number(hour.precipitation?.probability_pct) >= 60);
  return <PublicPage eyebrow={copy(lang, 'WEATHER & FARM ADVISORY', 'मौसम तथा कृषि सल्लाह')} title={copy(lang, 'Check conditions before fieldwork', 'खेतमा काम गर्नुअघि मौसम हेर्नुहोस्')} intro={copy(lang, 'Current weather and hourly forecast are shown only when the server has a live weather provider configured. Values are forecasts, not farm sensors or official crop recommendations.', 'सर्भरमा प्रत्यक्ष मौसम सेवा जडान भएमा मात्र हालको मौसम र घण्टागत पूर्वानुमान देखिन्छ। यी पूर्वानुमान हुन्, खेतका सेन्सर वा सरकारी बाली सिफारिस होइनन्।')}>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,.8fr)]">
      <section className={`${surface} p-5 sm:p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{copy(lang, 'WEATHER LOCATION', 'मौसम स्थान')}</p><h2 className="mt-1 text-xl font-bold text-slate-950">{locationName}</h2><p className="mt-1 text-xs text-slate-600">{coords.lat}, {coords.lng}</p></div><div className="flex gap-2"><button type="button" onClick={useLocation} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><LocateFixed size={15} aria-hidden="true" />{copy(lang, 'Use my location', 'मेरो स्थान')}</button><button type="button" onClick={() => load(coords.lat, coords.lng)} aria-label={copy(lang, 'Refresh weather', 'मौसम ताजा गर्नुहोस्')} className="grid min-h-10 min-w-10 place-items-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" /></button></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs font-semibold text-slate-700">{copy(lang, 'Latitude', 'अक्षांश')}<input className={`${field} mt-1`} type="number" min="-90" max="90" step="any" value={coords.lat} onChange={(event) => setCoords((old) => ({ ...old, lat: event.target.value }))} /></label><label className="text-xs font-semibold text-slate-700">{copy(lang, 'Longitude', 'देशान्तर')}<input className={`${field} mt-1`} type="number" min="-180" max="180" step="any" value={coords.lng} onChange={(event) => setCoords((old) => ({ ...old, lng: event.target.value }))} /></label><button type="button" onClick={() => { setLocationName(copy(lang, 'Selected coordinates', 'छानिएको निर्देशाङ्क')); load(coords.lat, coords.lng); }} disabled={loading || !coords.lat || !coords.lng} className="mt-auto min-h-11 rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{copy(lang, 'Get weather', 'मौसम हेर्नुहोस्')}</button></div>
        {error && <p role="alert" className="mt-3 text-sm text-rose-800">{error}</p>}
        {loading && !weather?.available && <p role="status" className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{copy(lang, 'Loading weather data…', 'मौसम डाटा लोड हुँदैछ…')}</p>}
        {weather?.available && current && <><div className="mt-6 rounded-2xl bg-gradient-to-r from-emerald-950 to-teal-800 p-5 text-white"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-emerald-100">{copy(lang, 'Current conditions', 'हालको अवस्था')}</p><p className="mt-1 text-5xl font-bold">{current.temperature_c == null ? '—' : `${Math.round(current.temperature_c)}°`}</p><p className="mt-1 text-sm">{current.condition?.text || copy(lang, 'Condition unavailable', 'मौसम अवस्था उपलब्ध छैन')}</p></div><CloudSun size={54} className="text-lime-200" aria-hidden="true" /></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[[Thermometer, copy(lang, 'Feels like', 'अनुभूत तापक्रम'), current.feels_like_c == null ? '—' : `${Math.round(current.feels_like_c)} °C`], [Droplets, copy(lang, 'Humidity', 'आर्द्रता'), current.humidity_pct == null ? '—' : `${current.humidity_pct}%`], [CloudRain, copy(lang, 'Rain chance', 'वर्षा सम्भावना'), current.precipitation?.probability_pct == null ? '—' : `${current.precipitation.probability_pct}%`], [Wind, copy(lang, 'Wind', 'हावा'), current.wind?.speed_kmh == null ? '—' : `${current.wind.speed_kmh} km/h`]].map(([Icon, label, value]) => <div key={label} className="rounded-xl bg-white/10 p-3"><p className="flex items-center gap-1.5 text-[11px] text-emerald-100"><Icon size={14} aria-hidden="true" />{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>)}</div></div>
          <div className="mt-5"><div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="font-bold text-slate-950">{copy(lang, 'Next 24 hours', 'आगामी २४ घण्टा')}</h3><p className="text-xs text-slate-600">{copy(lang, 'Hourly forecast from the weather provider', 'मौसम सेवा प्रदायकको घण्टागत पूर्वानुमान')}</p></div><p className="text-xs text-slate-500">{copy(lang, 'Updated', 'अद्यावधिक')}: {weather.generated_at ? new Date(weather.generated_at).toLocaleString(lang === 'en' ? 'en-GB' : 'ne-NP') : '—'}</p></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{hourly.slice(0, 8).map((hour) => <article key={hour.time} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><time className="text-xs font-semibold text-slate-600" dateTime={hour.time}>{formatTime(hour.time, lang, weather.time_zone)}</time><p className="mt-2 text-lg font-bold text-slate-950">{hour.temperature_c == null ? '—' : `${Math.round(hour.temperature_c)}°`}</p><p className="mt-1 truncate text-xs text-slate-600" title={hour.condition?.text || ''}>{hour.condition?.text || '—'}</p><p className="mt-2 text-xs text-sky-900">{hour.precipitation?.probability_pct == null ? '—' : `${hour.precipitation.probability_pct}%`} {copy(lang, 'rain', 'वर्षा')}</p></article>)}</div></div>
          {rainyHours.length > 0 && <Callout title={copy(lang, 'Rain in the hourly forecast', 'घण्टागत पूर्वानुमानमा वर्षा')} >{copy(lang, `Rain probability is 60% or higher during ${rainyHours.slice(0, 3).map((h) => formatTime(h.time, lang, weather.time_zone)).join(', ')}. Check field drainage and soil condition before irrigation or machinery work.`, `${rainyHours.slice(0, 3).map((h) => formatTime(h.time, lang, weather.time_zone)).join(', ')} बजे वर्षा सम्भावना ६०% वा बढी छ। सिँचाइ वा मेसिन चलाउनुअघि खेतको निकास र माटोको अवस्था जाँच्नुहोस्।`)}</Callout>}
        </>}
        {!loading && weather && !weather.available && <div role="status" className="mt-6"><Callout title={copy(lang, weather.configured ? 'Weather data is temporarily unavailable' : 'Weather provider not configured', weather.configured ? 'मौसम डाटा अस्थायी रूपमा उपलब्ध छैन' : 'मौसम सेवा जडान छैन')} tone="amber">{copy(lang, weather.configured ? 'The provider did not return weather data for these coordinates. Try again later or choose another location.' : 'A server administrator must configure GOOGLE_WEATHER_API_KEY. No sample or guessed weather values are shown.', weather.configured ? 'प्रदायकले यी निर्देशाङ्कका लागि मौसम डाटा दिएन। पछि फेरि प्रयास गर्नुहोस् वा अर्को स्थान छान्नुहोस्।' : 'सर्भर व्यवस्थापकले GOOGLE_WEATHER_API_KEY राख्नुपर्छ। नमुना वा अनुमानित मौसम देखाइएको छैन।')}</Callout></div>}
        {weather?.available && <p className="mt-3 text-xs text-slate-500">{copy(lang, 'Source', 'स्रोत')}: {weather.source} · {copy(lang, 'Forecast period', 'पूर्वानुमान अवधि')}: 24 hours · {copy(lang, 'Cache expires', 'क्यास म्याद')}: {weather.expires_at ? new Date(weather.expires_at).toLocaleTimeString() : '—'}</p>}
      </section>
      <div className="space-y-4"><Callout title={copy(lang, 'Use the forecast carefully', 'पूर्वानुमान सावधानीपूर्वक प्रयोग गर्नुहोस्')} tone="amber">{copy(lang, 'Forecasts describe expected conditions and can change. Check field moisture directly before irrigation. This page does not trigger alerts or control pumps.', 'पूर्वानुमानले सम्भावित अवस्था देखाउँछ र परिवर्तन हुन सक्छ। सिँचाइअघि खेतको चिस्यान प्रत्यक्ष जाँच्नुहोस्। यो पृष्ठले सूचना पठाउँदैन वा पम्प नियन्त्रण गर्दैन।')}</Callout><aside className={`${surface} p-5`}><h2 className="font-bold text-slate-950">{copy(lang, 'Location choices', 'स्थान छान्ने तरिका')}</h2><p className="mt-2 text-sm leading-6 text-slate-700">{copy(lang, 'Use the office reference coordinates, your device location, or enter farm coordinates. Location permission is optional.', 'कार्यालयको सन्दर्भ निर्देशाङ्क, उपकरणको स्थान वा खेतको निर्देशाङ्क प्रयोग गर्नुहोस्। स्थान अनुमति वैकल्पिक हो।')}</p></aside></div>
    </div>
  </PublicPage>;
}

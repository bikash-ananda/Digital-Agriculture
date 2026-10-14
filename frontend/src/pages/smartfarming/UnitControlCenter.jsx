import { useCallback, useEffect, useState } from 'react';
import './UnitControlCenter.css';
import { Link, useParams } from 'react-router-dom';
import { LoaderCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import api from '../../services/api';
import useLang from '../../utils/useLang';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import HealthRing from '../../components/greenhouse/HealthRing';
import ParamCard from '../../components/greenhouse/ParamCard';
import SensorComparisonChart from '../../components/greenhouse/SensorComparisonChart';
import ControlPanel from '../../components/greenhouse/ControlPanel';
import CropPanel from '../../components/greenhouse/CropPanel';
import AutomationPanel from '../../components/greenhouse/AutomationPanel';
import CameraPanel from '../../components/greenhouse/CameraPanel';
import { DerivedChips, Recommendations, PlantDescription } from '../../components/greenhouse/InfoCards';
import { PARAM_ICON, SENSOR_LABEL, ACT_LABEL, ageText, fmt } from '../../utils/greenhouse';

const MAIN = [
  { key: 'temperature', en: 'Temperature', ne: 'तापक्रम', icon: '🌡️' },
  { key: 'humidity', en: 'Humidity', ne: 'आर्द्रता', icon: '💧' },
  { key: 'soil_moisture', en: 'Soil moisture', ne: 'माटोको चिस्यान', icon: '🌱' },
  { key: 'light', en: 'Light intensity', ne: 'प्रकाशको तीव्रता', icon: '☀️' }
];
const NAMES = {
  temperature: ['Temperature', 'तापक्रम', '🌡️'], humidity: ['Humidity', 'आर्द्रता', '💧'],
  soil_moisture: ['Soil moisture', 'माटोको चिस्यान', '🌱'], soil_temperature: ['Soil temperature', 'माटोको तापक्रम', '🪴'],
  ec: ['Electrical conductivity', 'विद्युत चालकता', '🧪'], light: ['Light intensity', 'प्रकाशको तीव्रता', '☀️']
};
const when = (value, lang) => value ? new Date(value).toLocaleString(lang === 'en' ? 'en-GB' : 'ne-NP', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function MainReadings({ sensors, devices, analysis, lang, t }) {
  const params = new Map((analysis?.parameters || []).map((p) => [p.key, p]));
  const labels = { live: t('लाइभ', 'Live'), stale: t('पुरानो डाटा', 'Stale data'), offline: t('यन्त्र अफलाइन', 'Device offline'), empty: t('पठन छैन', 'No reading') };
  const styles = { live: 'border-emerald-500 bg-emerald-50 text-emerald-800', stale: 'border-amber-500 bg-amber-50 text-amber-900', offline: 'border-slate-400 bg-slate-100 text-slate-700', empty: 'border-gray-300 bg-gray-50 text-gray-600' };
  return <section aria-labelledby="main-readings"><div className="mb-3"><h3 id="main-readings" className="text-lg font-bold text-gov-blue">{t('मुख्य वातावरणीय मापन', 'Key growing conditions')}</h3><p className="text-sm text-gray-600">{t('पछिल्लो पठन, प्रवृत्ति र सेन्सर अवस्था', 'Latest readings, trends, and sensor freshness')}</p></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{MAIN.map((metric) => {
      const sensor = sensors.find((s) => s.sensor_type === metric.key && s.status !== 'disabled');
      const p = params.get(metric.key);
      const value = sensor?.last_value == null ? NaN : Number(sensor.last_value);
      const device = sensor && devices.find((d) => d.id === sensor.device_id);
      const state = !sensor || sensor.last_value == null ? 'empty' : device?.live_status !== 'online' ? 'offline' : Number(sensor.age_seconds) > 300 || sensor.age_seconds == null ? 'stale' : 'live';
      const min = p?.target?.opt_min ?? sensor?.min_valid;
      const max = p?.target?.opt_max ?? sensor?.max_valid;
      const inRange = Number.isFinite(value) && min != null && max != null && value >= Number(min) && value <= Number(max);
      const trend = p?.trend_per_hour;
      return <article key={metric.key} className={`rounded-xl border-l-4 bg-white p-4 shadow-sm ring-1 ring-black/5 ${styles[state].split(' ')[0]}`}>
        <div className="flex items-start justify-between gap-2"><h4 className="text-sm font-semibold text-gray-700">{metric.icon} {lang === 'en' ? metric.en : metric.ne}</h4><span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${styles[state]}`}>{labels[state]}</span></div>
        {sensor ? <><p className="mt-3 text-3xl font-bold tracking-tight text-terrace-900">{fmt(sensor.last_value, metric.key === 'light' ? 0 : 1)} <span className="text-base font-medium text-gray-500">{sensor.unit}</span></p>
          <div className="mt-2 flex min-h-5 flex-wrap justify-between gap-1 text-xs"><span className="text-gray-600">{Number.isFinite(Number(trend)) && Math.abs(Number(trend)) >= 0.05 ? `${Number(trend) > 0 ? '↑' : '↓'} ${Math.abs(Number(trend)).toFixed(2)} ${sensor.unit}/${t('घण्टा', 'h')}` : t('प्रवृत्ति उपलब्ध छैन', 'Trend unavailable')}</span>{min != null && max != null && <span className={inRange ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-800'}>{inRange ? t('दायराभित्र', 'In range') : t('दायराबाहिर', 'Out of range')}</span>}</div>
          {min != null && max != null && <p className="mt-1 text-xs text-gray-500">{p?.target ? t('लक्षित दायरा', 'Target range') : t('यन्त्रको सीमा', 'Sensor limits')}: {min}–{max} {sensor.unit}</p>}
          <p className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">{t('अन्तिम प्राप्त', 'Last received')}: {when(sensor.last_reading_at, lang)} ({ageText(sensor.age_seconds)} {t('अघि', 'ago')})</p><p className="mt-1 truncate text-[11px] text-gray-400">{sensor.name}</p>
        </> : <p className="mt-3 min-h-20 text-sm text-gray-500">{t('यो सेन्सर फार्ममा दर्ता गरिएको छैन।', 'This sensor is not registered for this farm.')}</p>}
      </article>;
    })}</div>
  </section>;
}

function ExtraReadings({ sensors, devices, analysis, lang, t }) {
  const mainTypes = MAIN.map((x) => x.key);
  const others = sensors.filter((s) => !mainTypes.includes(s.sensor_type) && s.status !== 'disabled');
  if (!others.length) return null;
  const params = new Map((analysis?.parameters || []).map((p) => [p.key, p]));
  return <section><h3 className="mb-2 font-semibold text-gov-blue">{t('अन्य सेन्सर', 'Other sensors')}</h3><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{others.map((s) => {
    const name = NAMES[s.sensor_type] || [SENSOR_LABEL[s.sensor_type]?.en || s.sensor_type, SENSOR_LABEL[s.sensor_type]?.ne || s.sensor_type, PARAM_ICON[s.sensor_type] || '📟'];
    const p = params.get(s.sensor_type); const val = Number(s.last_value); const tg = p?.target; const missing = s.last_value == null;
    const device = devices.find((d) => d.id === s.device_id); const stale = s.age_seconds == null || Number(s.age_seconds) > 300; const offline = device?.live_status !== 'online';
    const ok = tg && Number.isFinite(val) && val >= tg.opt_min && val <= tg.opt_max;
    return <article key={s.id} className={`rounded-lg border-l-4 bg-white p-4 shadow-sm ${offline ? 'border-slate-400' : stale ? 'border-amber-500' : 'border-emerald-500'}`}><div className="flex justify-between gap-2"><h4 className="text-sm font-medium">{name[2]} {lang === 'en' ? name[0] : name[1]} · {s.name}</h4><span className="text-xs">{missing ? t('पठन छैन', 'No reading') : offline ? t('अफलाइन', 'Offline') : stale ? t('पुरानो', 'Stale') : t('लाइभ', 'Live')}</span></div><p className="mt-2 text-2xl font-bold text-gov-blue">{fmt(s.last_value, s.sensor_type === 'ec' ? 3 : 1)} <span className="text-sm font-normal text-gray-500">{s.unit}</span></p><p className="mt-2 text-xs text-gray-500">{t('अन्तिम प्राप्त', 'Last received')}: {when(s.last_reading_at, lang)}</p>{tg && Number.isFinite(val) && <p className={`mt-1 text-xs ${ok ? 'text-emerald-700' : 'text-amber-800'}`}>{ok ? t('लक्षित दायराभित्र', 'Within target') : t('लक्षित दायराबाहिर', 'Outside target')}: {tg.opt_min}–{tg.opt_max} {s.unit}</p>}</article>;
  })}</div></section>;
}

export default function UnitControlCenter() {
  const { id } = useParams(); const { lang, t } = useLang(); const { can } = useAuth();
  const canAnalysis = can('analysis.view');
  const [live, setLive] = useState(null); const [analysis, setAnalysis] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [tab, setTab] = useState('charts');
  const loadLive = useCallback(() => api.get(`/smart/units/${id}/live`).then((r) => { setLive(r.data); setError(''); }).catch((e) => setError(e.response?.data?.message || t('यन्त्रबाट डाटा प्राप्त हुन सकेन।', 'Could not reach the sensor service.'))).finally(() => setLoading(false)), [id, t]);
  const loadAnalysis = useCallback(() => canAnalysis ? api.get(`/smart/units/${id}/analysis`).then((r) => setAnalysis(r.data)).catch(() => {}) : Promise.resolve(), [id, canAnalysis]);
  useEffect(() => { loadLive(); loadAnalysis(); const a = setInterval(loadLive, 10000); const b = setInterval(loadAnalysis, 30000); return () => { clearInterval(a); clearInterval(b); }; }, [loadLive, loadAnalysis]);
  if (loading && !live) return <div className="grid min-h-64 place-items-center rounded-xl bg-white text-gray-600" role="status"><span className="inline-flex items-center gap-2"><LoaderCircle className="animate-spin" size={19} />{t('फार्म डाटा लोड हुँदैछ…', 'Loading farm data…')}</span></div>;
  if (error && !live) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"><p className="font-semibold">{t('ड्यासबोर्डमा जडान हुन सकेन', 'Could not load the farm dashboard')}</p><p className="mt-1 text-sm">{error}</p><button type="button" onClick={() => { setLoading(true); loadLive(); loadAnalysis(); }} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold ring-1 ring-red-200"><RefreshCw size={16} />{t('फेरि प्रयास गर्नुहोस्', 'Try again')}</button></div>;
  if (!live) return null;
  const { unit } = live; const online = live.devices.some((d) => d.live_status === 'online');
  const latestReading = live.sensors.filter((s) => s.last_reading_at).sort((a, b) => new Date(b.last_reading_at) - new Date(a.last_reading_at))[0];
  const latestDevice = live.devices.filter((d) => d.last_seen_at).sort((a, b) => new Date(b.last_seen_at) - new Date(a.last_seen_at))[0];
  const latest = latestReading?.last_reading_at || latestDevice?.last_seen_at; const dq = analysis?.data_quality;
  const tabs = [['charts', '📈', t('ग्राफ तथा प्रतिवेदन', 'Charts & reports'), true], ['overview', '📋', t('सिंहावलोकन', 'Overview'), true], ['control', '🎛️', t('नियन्त्रण', 'Control'), can('irrigation_control.view')], ['crop', '🌱', t('बाली तथा अवलोकन', 'Crop & Observations'), can('crop_cycles.view')], ['automation', '🤖', t('स्वचालन', 'Automation'), can('automation.view')], ['camera', '📷', t('क्यामेरा', 'Camera'), can('cameras.view')]].filter((x) => x[3]);
  const reload = () => { loadLive(); loadAnalysis(); };
  const title = lang === 'en' ? unit.name_en : (unit.name_ne || unit.name_en);
  return <div className="sf-dashboard mx-auto max-w-7xl space-y-5">
    <header className="rounded-xl border-t-4 border-agri-green bg-white p-4 shadow-sm md:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center">{analysis && <HealthRing health={analysis.health} lang={lang} />}<div className="min-w-0 flex-1"><Link to="/app/smart-farming" className="text-xs font-medium text-gov-blue underline">← {t('स्मार्ट फार्मिङ', 'Smart Farming')}</Link><h2 className="mt-1 text-2xl font-bold text-gov-blue">{title}</h2><p className="text-sm text-gray-600">{lang === 'en' ? unit.site_name_en : unit.site_name_ne} · {unit.code} · {unit.unit_type}</p><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"><span className={`inline-flex items-center gap-1.5 font-semibold ${online ? 'text-emerald-800' : 'text-slate-700'}`}>{online ? <Wifi size={16} /> : <WifiOff size={16} />}{online ? t('अनलाइन', 'Online') : t('अफलाइन', 'Offline')}</span><span className="text-xs text-gray-600">{t('अन्तिम प्राप्त', 'Last received')}: <time dateTime={latest || undefined}>{when(latest, lang)}</time></span>{live.open_alerts > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">🔔 {live.open_alerts} {t('खुला अलर्ट', 'open alerts')}</span>}</div>{error && <p role="status" className="mt-2 text-xs text-amber-800">{t('अद्यावधिक हुन सकेन; पछिल्लो प्राप्त डाटा देखाइएको छ।', 'Refresh failed; showing the last received data.')}</p>}</div>{analysis && <DerivedChips d={analysis.derived} t={t} />}<div className="flex shrink-0 gap-2"><button type="button" onClick={reload} aria-label={t('डाटा ताजा गर्नुहोस्', 'Refresh data')} className="sf-no-print inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-300 text-gray-700"><RefreshCw size={17} /></button><button type="button" onClick={() => window.print()} className="sf-no-print min-h-11 rounded-lg bg-terrace-800 px-3 text-sm font-semibold text-white">📄 {t('PDF प्रतिवेदन', 'Export PDF')}</button></div></div></header>
    <div className="sf-print-only"><h1 className="text-2xl font-bold">{t('स्मार्ट फार्मिङ सेन्सर प्रतिवेदन', 'Smart Farming Sensor Report')}</h1><p className="text-sm">{lang === 'en' ? unit.site_name_en : unit.site_name_ne} · {title} · {new Date().toLocaleString()}</p></div>
    {!online && <div role="status" className="rounded-lg border border-slate-300 bg-slate-100 p-3 text-sm text-slate-800">⚠ {live.devices.length ? t('यन्त्र अफलाइन छ। मापन अन्तिम प्राप्त डाटा हुन्।', 'Device is offline. Readings below are the last received values.') : t('यस इकाईमा यन्त्र दर्ता गरिएको छैन।', 'No device is registered for this unit.')}</div>}
    {dq && (dq.stale_sensors.length || dq.stuck_sensors.length) ? <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{dq.stale_sensors.length > 0 && <p>🕒 {t('पुरानो डाटा भएका सेन्सर', 'Stale sensors')}: {dq.stale_sensors.map((s) => s.name).join(', ')}</p>}{dq.stuck_sensors.length > 0 && <p>📌 {t('अड्किएको जस्तो देखिने', 'Possibly stuck')}: {dq.stuck_sensors.join(', ')}</p>}</div> : null}
    <MainReadings sensors={live.sensors} devices={live.devices} analysis={analysis} lang={lang} t={t} /><ExtraReadings sensors={live.sensors} devices={live.devices} analysis={analysis} lang={lang} t={t} />
    <nav aria-label={t('फार्म खण्डहरू', 'Farm sections')} className="sf-no-print -mb-2 flex gap-1 overflow-x-auto border-b border-gray-200">{tabs.map(([key, icon, label]) => <button type="button" key={key} onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined} className={`min-h-11 shrink-0 whitespace-nowrap border-b-2 px-4 text-sm font-semibold ${tab === key ? 'border-agri-green text-agri-green' : 'border-transparent text-gray-600'}`}>{icon} {label}</button>)}</nav>
    {tab === 'charts' && <SensorComparisonChart sensors={live.sensors} parameters={analysis?.parameters || []} lang={lang} t={t} />}
    {tab === 'overview' && <div className="space-y-5">{analysis ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{analysis.parameters.map((p) => <ParamCard key={p.key} p={p} lang={lang} t={t} />)}</div> : <p className="rounded-lg bg-white p-4 text-sm text-gray-500">{canAnalysis ? t('विश्लेषण डाटा उपलब्ध छैन।', 'Analysis data is not available.') : t('विश्लेषण हेर्ने अनुमति छैन', 'No permission to view analysis')}</p>}<section><h3 className="mb-2 font-semibold text-gov-blue">{t('एक्चुएटर अवस्था', 'Actuator status')}</h3><div className="flex flex-wrap gap-2">{live.actuators.map((a) => { const m = ACT_LABEL[a.actuator_type] || ACT_LABEL.other; return <span key={a.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">{m.icon} {a.name} <StatusBadge value={a.current_state} /><span className="text-xs text-gray-400">{a.control_mode}</span></span>; })}{!live.actuators.length && <p className="text-sm text-gray-500">{t('एक्चुएटर दर्ता गरिएको छैन।', 'No actuators are registered.')}</p>}</div></section>{analysis && <div className="grid gap-5 lg:grid-cols-2"><PlantDescription analysis={analysis} lang={lang} t={t} /><Recommendations recs={analysis.recommendations} risks={analysis.risks} lang={lang} t={t} /></div>}</div>}
    {tab === 'control' && <div className="sf-print-hide"><ControlPanel actuators={live.actuators} devices={live.devices} canControl={can('irrigation_control.control')} canConfigure={can('irrigation_control.configure')} onDone={reload} lang={lang} t={t} /></div>}{tab === 'crop' && <div className="sf-print-hide"><CropPanel unitId={id} analysis={analysis} can={can} onChanged={reload} lang={lang} t={t} /></div>}{tab === 'automation' && <div className="sf-print-hide"><AutomationPanel unitId={id} live={live} can={can} lang={lang} t={t} /></div>}{tab === 'camera' && <div className="sf-print-hide"><CameraPanel unitId={id} t={t} /></div>}
  </div>;
}
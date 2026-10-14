import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowRight, ArrowUpRight, BookOpen, Bot, CalendarDays, CheckCircle2,
  Clock3, FlaskConical, Lightbulb, LoaderCircle, MessageCircle, Newspaper,
  RefreshCw, Sprout, Wifi, WifiOff
} from 'lucide-react';
import api from '../../services/api';
import HistoryChart from '../../components/greenhouse/HistoryChart';

const METRICS = [
  { key: 'temperature', en: 'Air temperature', ne: 'हावाको तापक्रम', icon: '🌡️' },
  { key: 'humidity', en: 'Relative humidity', ne: 'सापेक्ष आर्द्रता', icon: '💧' },
  { key: 'soil_moisture', en: 'Soil moisture', ne: 'माटोको चिस्यान', icon: '🌱' },
  { key: 'light', en: 'Light intensity', ne: 'प्रकाशको तीव्रता', icon: '☀️' }
];
const EMPTY = [];

const titleOf = (row, lang) => lang === 'en'
  ? (row.title_en || row.title_ne || row.title)
  : (row.title_ne || row.title_en || row.title);
const dateOf = (value, lang) => value
  ? new Date(value).toLocaleString(lang === 'en' ? 'en-GB' : 'ne-NP', { dateStyle: 'medium', timeStyle: 'short' })
  : '—';
const cropLabel = (unit, lang) => lang === 'en'
  ? (unit?.crop_en || 'Greenhouse crop not set')
  : (unit?.crop_ne || unit?.crop_en || 'बाली चयन गरिएको छैन');

function freshness(sensor, device, t) {
  const age = sensor?.age_seconds == null ? null : Number(sensor.age_seconds);
  if (age === null) return { key: 'empty', label: t('पठन छैन', 'No reading'), className: 'bg-slate-100 text-slate-700' };
  if (device?.live_status === 'disabled' || device?.live_status === 'offline' || age > 900) {
    return { key: 'offline', label: t('अफलाइन', 'Offline'), className: 'bg-slate-100 text-slate-700' };
  }
  if (age > 180) return { key: 'stale', label: t('पुरानो', 'Stale'), className: 'bg-amber-100 text-amber-900' };
  return { key: 'live', label: t('लाइभ', 'Live'), className: 'bg-emerald-100 text-emerald-900' };
}

function answerFromInsights(question, data, live, lang, t) {
  const q = question.toLocaleLowerCase();
  const type = q.includes('soil') || q.includes('माटो') || q.includes('water') || q.includes('irrigat') || q.includes('सिँचाइ')
    ? 'soil_moisture'
    : q.includes('humid') || q.includes('आर्द्र') ? 'humidity'
      : q.includes('light') || q.includes('प्रकाश') ? 'light'
        : q.includes('temp') || q.includes('ताप') ? 'temperature' : null;
  const days = data.data_status?.days_of_data ?? 0;
  const caveat = t('यो तथ्याङ्कमा आधारित मार्गदर्शन हो; कारण प्रमाणित गर्दैन।', 'This is guidance from the recorded data; it does not establish cause.');
  if (type === 'light') {
    const sensor = live?.sensors?.find((item) => item.sensor_type === 'light' && item.status !== 'disabled');
    const coverage = data.data_status?.coverage_24h?.light;
    const value = sensor?.last_value == null ? null : Number(sensor.last_value);
    const reading = value == null || !Number.isFinite(value)
      ? t('हालको प्रकाश पठन उपलब्ध छैन।', 'No current light reading is available.')
      : t(`हालको प्रकाश ${value} ${sensor.unit || 'lux'} छ।`, `Current illuminance is ${value} ${sensor.unit || 'lux'}.`);
    return `${reading} ${t(`२४ घण्टाको नमुना कभरेज ${coverage ?? '—'}% छ। प्रकाश सेन्सर lux मा छ; यसलाई PAR वा DLI नमान्नुहोस्।`, `24-hour sample coverage is ${coverage ?? '—'}%. The sensor reports lux; do not treat it as PAR or DLI.`)} ${caveat}`;
  }
  if (type === 'soil_moisture' && data.soil) {
    const soil = data.soil;
    const model = data.models?.dry_down;
    const estimate = soil.hours_to_threshold == null
      ? t('सुक्ने पूर्वानुमानका लागि पर्याप्त इतिहास छैन।', 'There is not enough history for a dry-down forecast.')
      : t(`दर्ता भएको सुक्ने मोडेलले ${soil.threshold}% पुग्न करिब ${soil.hours_to_threshold} घण्टा देखाउँछ।`, `The learned dry-down model estimates about ${soil.hours_to_threshold} hours to ${soil.threshold}%.`);
    return `${t('हालको माटोको चिस्यान', 'Current soil moisture')}: ${soil.current}%. ${estimate} ${model?.ready ? t(`मोडेल: ${model.kind}, n=${model.n}.`, `Model: ${model.kind}, n=${model.n}.`) : ''} ${caveat}`;
  }
  if (type && data.forecasts?.[type]?.ready) {
    const f = data.forecasts[type];
    const start = f.forecast[0]?.v;
    const end = f.forecast[f.forecast.length - 1]?.v;
    const max = Math.max(...f.forecast.map((point) => point.v));
    const error = f.rmse?.[5];
    return t(
      `${METRICS.find((metric) => metric.key === type)?.ne}: अर्को ६ घण्टामा अनुमानित दायरा ${Math.min(start, end, max).toFixed(1)}–${Math.max(start, end, max).toFixed(1)} ${f.unit} छ। ६ घण्टाको ऐतिहासिक त्रुटि ${error == null ? 'उपलब्ध छैन' : `±${error} ${f.unit}`}। ${caveat}`,
      `${METRICS.find((metric) => metric.key === type)?.en}: the 6-hour forecast spans about ${Math.min(start, end, max).toFixed(1)}–${Math.max(start, end, max).toFixed(1)} ${f.unit}. Back-test RMSE at 6 hours: ${error == null ? 'not available' : `±${error} ${f.unit}`}. ${caveat}`
    );
  }
  if (type && data.forecasts?.[type] && !data.forecasts[type].ready) {
    const forecast = data.forecasts[type];
    const note = forecast.reason === 'stale'
      ? t('पूर्वानुमानका लागि ताजा मापन चाहिन्छ।', 'Fresh readings are needed before a forecast can be shown.')
      : forecast.reason === 'no_sensor'
        ? t('यस मापनका लागि सेन्सर दर्ता वा सक्रिय छैन।', 'No sensor is registered or enabled for this measurement.')
        : t(`पूर्वानुमान सिक्न ${forecast.need_hours || 72} घण्टासम्मको पर्याप्त इतिहास चाहिन्छ; अहिले ${forecast.have_hours || 0} घण्टा मात्र छ।`, `The forecast needs a longer history to learn its pattern; it currently has ${forecast.have_hours || 0} usable hours.`);
    return `${note} ${caveat}`;
  }
  if (!data.data_status?.any_data) {
    return t('यस ग्रीनहाउसका लागि विश्लेषण गर्न मिल्ने सेन्सर इतिहास छैन। यन्त्र जडान र अन्तिम प्राप्त समय जाँच्नुहोस्।', 'There is no sensor history to analyze for this greenhouse yet. Check the device connection and last-received time.');
  }
  const bullets = (data.digest?.bullets || []).slice(0, 3).map((item) => lang === 'en' ? item.en : item.ne);
  const needs = (data.data_status?.needs || []).map((item) => lang === 'en' ? item.en : item.ne);
  const summary = bullets.length ? bullets.join(' ') : t('हालको सारांश बनाउन पर्याप्त मापन छैन।', 'There are not enough measurements for a current summary.');
  const dataNote = t(`विश्लेषणमा करिब ${days} दिनको डाटा छ।`, `The analysis currently has about ${days} days of data.`);
  return `${summary} ${dataNote} ${needs[0] || ''} ${caveat}`;
}

function ScienceAssistant({ unitId, live, lang, t }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const suggestions = [
    t('आजको अवस्थाको सारांश', 'Summarize current conditions'),
    t('माटोको चिस्यानबारे बताउनुहोस्', 'What is the soil moisture outlook?'),
    t('तापक्रमको ६ घण्टे अनुमान', 'Show the 6-hour temperature outlook')
  ];

  const ask = async (event) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || !unitId || busy) return;
    setQuestion('');
    setMessages((current) => [...current, { role: 'user', text }]);
    setBusy(true);
    try {
      const { data } = await api.get(`/ai/units/${unitId}/insights`);
      setMessages((current) => [...current, { role: 'assistant', text: answerFromInsights(text, data, live, lang, t) }]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', text: error.response?.data?.message || t('विश्लेषण सेवा अहिले उपलब्ध छैन। फेरि प्रयास गर्नुहोस्।', 'The analysis service is unavailable right now. Please try again.') }]);
    } finally {
      setBusy(false);
    }
  };

  return <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
    <div className="flex items-start gap-3 bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-800 p-5 text-white">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10"><Bot size={23} /></span>
      <div><h3 className="font-bold">{t('ग्रीनहाउस विज्ञान सहायक', 'Greenhouse science assistant')}</h3><p className="mt-1 text-xs text-emerald-100">{t('सर्भरको सेन्सर इतिहास र तथ्याङ्कीय विश्लेषणमा आधारित', 'Grounded in server-side sensor history and statistical analysis')}</p></div>
    </div>
    <div className="space-y-3 p-4">
      <p className="text-xs leading-relaxed text-slate-500">{t('सहायकले चयन गरिएको इकाईको तथ्याङ्क पढ्छ; प्रश्न बाह्य एआई सेवामा पठाइँदैन। सुझावले कारण वा सुरक्षित नियन्त्रण प्रमाणित गर्दैन।', 'The assistant reads the selected unit’s analysis; your question is not sent to an external AI service. Suggestions do not prove causes or safe control settings.')}</p>
      {messages.length > 0 && <div aria-live="polite" className="max-h-64 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`max-w-[95%] rounded-xl px-3 py-2 text-sm leading-relaxed ${message.role === 'user' ? 'ml-auto bg-emerald-900 text-white' : 'bg-white text-slate-800 ring-1 ring-slate-200'}`}>{message.text}</div>)}
        {busy && <p className="text-xs text-slate-500">{t('सर्भरमा विश्लेषण हुँदैछ…', 'Analyzing on the server…')}</p>}
      </div>}
      <div className="flex flex-wrap gap-2">{suggestions.map((item) => <button key={item} type="button" onClick={() => setQuestion(item)} className="min-h-9 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-950 hover:bg-emerald-100">{item}</button>)}</div>
      <form onSubmit={ask} className="flex gap-2">
        <label className="sr-only" htmlFor="science-question">{t('ग्रीनहाउसबारे प्रश्न', 'Ask about this greenhouse')}</label>
        <input id="science-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t('मापन वा अनुमानबारे सोध्नुहोस्…', 'Ask about a reading or forecast…')} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
        <button disabled={busy || !question.trim()} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white disabled:opacity-50"><MessageCircle size={16} />{t('सोध्नुहोस्', 'Ask')}</button>
      </form>
    </div>
  </section>;
}

function FeedSection({ kind, rows, loading, lang, t, can }) {
  const isNews = kind === 'news';
  const Icon = isNews ? Newspaper : BookOpen;
  const title = isNews ? t('कृषि समाचार तथा अवसर', 'Agriculture news & opportunities') : t('ग्रीनहाउस पढाइ तथा लेख', 'Greenhouse reads & blogs');
  const empty = isNews ? t('अहिले प्रकाशित समाचार छैन।', 'No published news at the moment.') : t('अहिले प्रकाशित लेख छैन।', 'No published articles at the moment.');
  const category = (value) => ({
    news: t('समाचार', 'News'), press_release: t('विज्ञप्ति', 'Press release'), program: t('कार्यक्रम', 'Program'), training: t('तालिम', 'Training')
  }[value] || value);

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-900"><Icon size={18} /></span><h3 className="font-bold text-slate-900">{title}</h3></div><Link to={isNews ? (can('notices.view') ? '/app/notices' : '/knowledge') : (can('knowledge.view') ? '/app/knowledge' : '/knowledge')} className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-emerald-900 hover:underline">{t('सबै हेर्नुहोस्', 'View all')}<ArrowRight size={14} /></Link></div>
    {loading ? <div role="status" className="flex items-center gap-2 py-4 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin" />{t('लोड हुँदैछ…', 'Loading…')}</div> : rows.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{empty}</p> : <ul className="divide-y divide-slate-100">
      {rows.slice(0, 3).map((row) => <li key={row.id} className="py-3 first:pt-0 last:pb-0">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{isNews ? category(row.category) : (row.crop_en || row.topic || t('कृषि', 'Agriculture'))}</span><time>{dateOf(row.published_at || row.created_at, lang)}</time></div>
        <h4 className="mt-2 text-sm font-semibold leading-snug text-slate-900">{titleOf(row, lang)}</h4>
        {row.body && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{row.body}</p>}
        {row.file_path && /^https?:\/\//i.test(row.file_path) && <a href={row.file_path} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-900 underline">{t('थप पढ्नुहोस्', 'Read more')}<ArrowUpRight size={13} /></a>}
      </li>)}
    </ul>}
  </section>;
}

export default function ResearchOverview({ units, lang, t, can }) {
  const [savedUnitId, setSavedUnitId] = useState(() => {
    try { return window.localStorage.getItem('da.researchUnitId') || ''; } catch { return ''; }
  });
  const [liveState, setLiveState] = useState({ unitId: '', data: null });
  const [liveErrorState, setLiveErrorState] = useState({ unitId: '', message: '' });
  const [insightState, setInsightState] = useState({ unitId: '', data: null });
  const [insightErrorState, setInsightErrorState] = useState({ unitId: '', message: '' });
  const [refreshing, setRefreshing] = useState(false);
  const [news, setNews] = useState([]);
  const [articles, setArticles] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState('');
  const canSeeLive = can('smart_farming.view');
  const selectedUnit = units.find((unit) => String(unit.id) === savedUnitId) || units[0] || null;
  const unitId = selectedUnit ? String(selectedUnit.id) : '';
  const live = liveState.unitId === unitId ? liveState.data : null;
  const insights = insightState.unitId === unitId ? insightState.data : null;
  const liveError = liveErrorState.unitId === unitId ? liveErrorState.message : '';
  const insightError = insightErrorState.unitId === unitId ? insightErrorState.message : '';

  const loadInsights = useCallback(async () => {
    if (!unitId || !canSeeLive) return;
    try {
      const { data } = await api.get(`/ai/units/${unitId}/insights`);
      setInsightState({ unitId, data });
      setInsightErrorState({ unitId, message: '' });
    } catch (error) {
      setInsightErrorState({ unitId, message: error.response?.data?.message || t('वैज्ञानिक विश्लेषण लोड हुन सकेन।', 'Scientific analysis could not load.') });
    }
  }, [unitId, canSeeLive, t]);

  useEffect(() => {
    if (!unitId || !canSeeLive) return undefined;
    let active = true;
    const load = async () => {
      try {
        const { data } = await api.get(`/smart/units/${unitId}/live`);
        if (active) { setLiveState({ unitId, data }); setLiveErrorState({ unitId, message: '' }); }
      } catch (error) {
        if (active) setLiveErrorState({ unitId, message: error.response?.data?.message || t('सेन्सर अवस्था लोड हुन सकेन।', 'Sensor status could not load.') });
      }
    };
    const initial = window.setTimeout(load, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30000);
    return () => { active = false; window.clearTimeout(initial); window.clearInterval(timer); };
  }, [unitId, canSeeLive, t]);

  useEffect(() => {
    if (!unitId || !canSeeLive) return undefined;
    let active = true;
    const load = async () => {
      try {
        const { data } = await api.get(`/ai/units/${unitId}/insights`);
        if (active) { setInsightState({ unitId, data }); setInsightErrorState({ unitId, message: '' }); }
      } catch (error) {
        if (active) setInsightErrorState({ unitId, message: error.response?.data?.message || t('वैज्ञानिक विश्लेषण लोड हुन सकेन।', 'Scientific analysis could not load.') });
      }
    };
    const initial = window.setTimeout(load, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load(); }, 120000);
    return () => { active = false; window.clearTimeout(initial); window.clearInterval(timer); };
  }, [unitId, canSeeLive, t]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.get('/content/public/news'), api.get('/content/public/articles')]).then(([newsResult, articleResult]) => {
      if (!active) return;
      if (newsResult.status === 'fulfilled') setNews(newsResult.value.data || []);
      if (articleResult.status === 'fulfilled') setArticles(articleResult.value.data || []);
      if (newsResult.status === 'rejected' || articleResult.status === 'rejected') setFeedError(t('समाचार वा लेखमध्ये केही लोड भएनन्।', 'Some news or articles could not load.'));
      setFeedLoading(false);
    });
    return () => { active = false; };
  }, [t]);

  const chooseUnit = (value) => {
    setSavedUnitId(value);
    try { window.localStorage.setItem('da.researchUnitId', value); } catch { /* Keep the selection for this visit. */ }
  };
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadInsights(), unitId && canSeeLive ? api.get(`/smart/units/${unitId}/live`).then((response) => { setLiveState({ unitId, data: response.data }); setLiveErrorState({ unitId, message: '' }); }).catch((error) => setLiveErrorState({ unitId, message: error.response?.data?.message || t('सेन्सर अवस्था लोड हुन सकेन।', 'Sensor status could not load.') })) : Promise.resolve()]);
    setRefreshing(false);
  };

  const sensors = live?.sensors || EMPTY;
  const devices = live?.devices || EMPTY;
  const readings = useMemo(() => METRICS.map((metric) => {
    const sensor = sensors.find((item) => item.sensor_type === metric.key && item.status !== 'disabled');
    const device = devices.find((item) => item.id === sensor?.device_id);
    const limits = insights?.targets?.t?.[metric.key];
    const min = limits?.[0] ?? sensor?.min_valid;
    const max = limits?.[1] ?? sensor?.max_valid;
    const value = sensor?.last_value == null ? null : Number(sensor.last_value);
    const previous = sensor?.previous_value == null ? null : Number(sensor.previous_value);
    const trend = value !== null && Number.isFinite(value) && previous !== null && Number.isFinite(previous)
      ? Math.round((value - previous) * 100) / 100 : null;
    return { ...metric, sensor, device, value, min, max, trend, state: freshness(sensor, device, t), inRange: value !== null && min != null && max != null && value >= Number(min) && value <= Number(max) };
  }), [sensors, devices, insights, t]);
  const chartParameters = readings
    .filter((reading) => reading.min != null && reading.max != null)
    .map((reading) => ({ key: reading.key, target: { opt_min: Number(reading.min), opt_max: Number(reading.max) } }));
  const online = devices.filter((device) => device.live_status === 'online').length;
  const coverage = insights?.data_status?.coverage_24h || {};
  const coverageValues = Object.entries(coverage)
    .filter(([type]) => sensors.some((sensor) => sensor.sensor_type === type && sensor.status !== 'disabled'))
    .map(([, value]) => Number(value)).filter(Number.isFinite);
  const averageCoverage = coverageValues.length ? Math.round(coverageValues.reduce((sum, value) => sum + Number(value), 0) / coverageValues.length) : null;

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-5 text-white shadow-lg sm:p-7">
      <div aria-hidden="true" className="absolute -right-8 -top-16 h-64 w-64 rounded-full border-[32px] border-white/[0.06]" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-100"><FlaskConical size={14} />{t('अनुसन्धान कार्यस्थल', 'RESEARCH WORKSPACE')}</div><h2 className="mt-3 text-2xl font-bold sm:text-3xl">{t('ग्रीनहाउस विज्ञान ड्यासबोर्ड', 'Greenhouse science dashboard')}</h2><p className="mt-2 text-sm leading-relaxed text-emerald-100">{t('लाइभ वातावरण, बालीसँग सम्बन्धित लक्ष्य, तथ्याङ्क गुणस्तर र अनुसन्धान विश्लेषण एउटै दृश्यमा।', 'Live growing conditions, crop-aware ranges, data quality and research analysis in one view.')}</p></div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-56 text-xs font-semibold text-emerald-50">{t('ग्रीनहाउस / उत्पादन इकाई', 'Greenhouse / growing unit')}<select value={unitId} onChange={(event) => chooseUnit(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/20 bg-white px-3 text-sm font-semibold text-emerald-950" disabled={!units.length}>{units.length ? units.map((unit) => <option key={unit.id} value={unit.id}>{lang === 'en' ? unit.name_en : (unit.name_ne || unit.name_en)}{unit.is_simulated ? ' · SIM' : ''}</option>) : <option value="">{t('इकाई छैन', 'No unit available')}</option>}</select></label>
          <button type="button" onClick={refresh} disabled={refreshing || !unitId} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />{t('ताजा गर्नुहोस्', 'Refresh')}</button>
          {unitId && <Link to={`/app/smart-farming/units/${unitId}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-emerald-950 hover:bg-emerald-50">{t('फार्म कन्सोल', 'Farm console')}<ArrowRight size={16} /></Link>}
        </div>
      </div>
      {selectedUnit && <div className="relative mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/15 pt-4 text-xs text-emerald-100"><span className="inline-flex items-center gap-1.5"><Sprout size={14} />{cropLabel(selectedUnit, lang)}</span><span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{selectedUnit.days || 0} {t('दैनिक सारांश', 'daily summaries')}</span><span className="inline-flex items-center gap-1.5"><Activity size={14} />{selectedUnit.is_simulated ? t('सिमुलेटेड इकाई', 'Simulated unit') : t('ग्रीनहाउस मापन', 'Greenhouse measurements')}</span></div>}
    </header>

    {!canSeeLive && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{t('लाइभ सेन्सर र तथ्याङ्कीय इन्जिन हेर्न smart_farming.view अनुमति आवश्यक छ। यसपछि तलका अनुसन्धान उपकरण उपलब्ध छन्।', 'Live sensors and the statistical engine require smart_farming.view permission. The research tools remain available below.')}</div>}
    {unitId && canSeeLive && !live && !liveError && <div role="status" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600"><LoaderCircle size={16} className="animate-spin" />{t('सर्भरबाट सेन्सर डाटा लोड हुँदैछ…', 'Loading sensor data from the server…')}</div>}
    {liveError && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{liveError} {live && t('पछिल्लो प्राप्त डाटा देखाइएको छ।', 'Showing the last received data.')}</div>}
    {unitId && canSeeLive && <>
      <section aria-label={t('मुख्य मापन', 'Key readings')} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {readings.map((reading) => <article key={reading.key} className={`rounded-2xl border bg-white p-4 shadow-sm ${reading.state.key === 'live' ? 'border-emerald-200' : reading.state.key === 'stale' ? 'border-amber-200' : 'border-slate-200'}`}>
          <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{lang === 'en' ? reading.en : reading.ne}</p><span className="mt-1 inline-block text-xl" aria-hidden="true">{reading.icon}</span></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${reading.state.className}`}>{reading.state.label}</span></div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-emerald-950">{reading.value === null || !Number.isFinite(reading.value) ? '—' : reading.value.toLocaleString(lang === 'en' ? 'en-GB' : 'ne-NP', { maximumFractionDigits: 2 })}<span className="ml-1 text-base font-medium text-slate-500">{reading.sensor?.unit || ''}</span></p>
          {reading.trend !== null && <p className="mt-1 text-xs font-medium text-slate-600">{reading.trend > 0 ? '↗' : reading.trend < 0 ? '↘' : '→'} {t('अघिल्लो पठनसँग', 'Since previous sample')}: {reading.trend > 0 ? '+' : ''}{reading.trend.toFixed(2)} {reading.sensor?.unit || ''}</p>}
          <p className="mt-2 min-h-5 text-xs text-slate-600">{reading.sensor?.last_reading_at ? <>{t('अन्तिम प्राप्त', 'Last received')}: {dateOf(reading.sensor.last_reading_at, lang)}</> : t('अहिलेसम्म मापन आएको छैन', 'No measurement received yet')}</p>
          {reading.min != null && reading.max != null ? <p className={`mt-2 text-xs font-medium ${reading.value == null ? 'text-slate-500' : reading.inRange ? 'text-emerald-800' : 'text-amber-800'}`}>{t('बाली लक्ष्य', 'Crop target')}: {reading.min}–{reading.max} {reading.sensor?.unit || ''}{reading.value != null && ` · ${reading.inRange ? t('दायराभित्र', 'in range') : t('दायराबाहिर', 'out of range')}`}</p> : <p className="mt-2 text-xs text-slate-500">{t('कन्फिगर गरिएको लक्ष्य उपलब्ध छैन', 'No configured target available')}</p>}
          {reading.sensor && <p className="mt-1 text-[11px] text-slate-400">{reading.sensor.name}{reading.sensor.age_seconds != null && ` · ${Math.max(0, Math.floor(Number(reading.sensor.age_seconds) / 60))} ${t('मिनेट अघि', 'min ago')}`}</p>}
        </article>)}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-slate-950">{t('लाइभ अवस्था तथा डाटा गुणस्तर', 'Connection & data quality')}</h3><p className="mt-1 text-xs text-slate-500">{t('यन्त्रको स्थिति र आज प्राप्त भएको अपेक्षित १०-मिनेट अवधिको अनुपात', 'Device state and share of expected 10-minute intervals received today')}</p></div><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${online > 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-700'}`}>{online > 0 ? <Wifi size={14} /> : <WifiOff size={14} />}{devices.length ? `${online}/${devices.length} ${t('अनलाइन', 'online')}` : t('यन्त्र दर्ता छैन', 'No device registered')}</span></div>
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{t('२४ घण्टा कभरेज', '24-hour coverage')}</p><p className="mt-1 text-2xl font-bold text-slate-900">{averageCoverage == null ? '—' : `${averageCoverage}%`}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{t('असामान्य अवधि', 'Unusual periods')}</p><p className="mt-1 text-2xl font-bold text-slate-900">{insights ? insights.anomalies?.length || 0 : '—'}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{t('तथ्याङ्कीय मोडेल', 'Statistical models')}</p><p className="mt-1 text-sm font-bold text-slate-900">{insights?.data_status?.models_ready ? t('तयार', 'Ready') : insights ? t('डाटा सिक्दै', 'Learning from data') : '—'}</p></div></div>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500"><Clock3 size={13} />{t('अन्तिम सर्भर जाँच', 'Last server check')}: {live?.server_time ? dateOf(live.server_time, lang) : '—'}</p>
        </section>
        <section className="rounded-2xl border border-emerald-100 bg-emerald-950 p-5 text-white shadow-sm"><div className="flex items-center gap-2 text-emerald-200"><Lightbulb size={18} /><span className="text-xs font-bold uppercase tracking-wide">{t('वैज्ञानिक सन्दर्भ', 'Scientific context')}</span></div><p className="mt-3 text-lg font-bold">{insights ? (lang === 'en' ? insights.digest?.headline?.en : insights.digest?.headline?.ne) : t('विश्लेषण तयार हुँदैछ', 'Preparing analysis')}</p><p className="mt-2 text-sm text-emerald-100">{t('आधार', 'Evidence base')}: {insights?.data_status?.days_of_data ?? selectedUnit?.days ?? 0} {t('दिनको मापन', 'days of measurements')}{insights?.targets?.source && ` · ${t('लक्ष्य स्रोत', 'target source')}: ${insights.targets.source}`}</p>{insights?.data_status?.needs?.length > 0 && <p className="mt-3 rounded-xl bg-white/10 p-3 text-xs leading-relaxed text-emerald-50">{lang === 'en' ? insights.data_status.needs[0].en : insights.data_status.needs[0].ne}</p>}</section>
      </div>

      {insightError && <div role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{insightError}</div>}
      {insights?.digest?.bullets?.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-950">{t('सर्भर विश्लेषण र ध्यान दिनुपर्ने कुरा', 'Server analysis & observations')}</h3><p className="mt-1 text-xs text-slate-500">{t('यस इकाईको सामान्य समयगत ढाँचासँग तुलना गरिएको; सहसम्बन्धले कारण देखाउँदैन।', 'Compared with this unit’s own hourly pattern; association is not causation.')}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">{t('इन्जिन अपडेट', 'Engine updated')} · {dateOf(insights.generated_at, lang)}</span></div><ul className="grid gap-2 md:grid-cols-2">{insights.digest.bullets.slice(0, 4).map((bullet, index) => <li key={`${bullet.level}-${index}`} className={`rounded-xl border-l-4 p-3 text-sm leading-relaxed ${bullet.level === 'warn' ? 'border-amber-500 bg-amber-50 text-amber-950' : bullet.level === 'good' ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-blue-400 bg-blue-50 text-blue-950'}`}>{lang === 'en' ? bullet.en : bullet.ne}</li>)}</ul>{insights.digest.actions?.length > 0 && <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('समीक्षा गर्न मिल्ने कदम', 'Actions to review')}</p><ul className="mt-2 grid gap-2 sm:grid-cols-2">{insights.digest.actions.slice(0, 4).map((action, index) => <li key={index} className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-700" />{lang === 'en' ? action.en : action.ne}</li>)}</ul></div>}</section>}

      {insights && <section><div className="mb-3 flex items-end justify-between gap-3"><div><h3 className="font-bold text-slate-950">{t('६ घण्टे अनुसन्धान पूर्वानुमान', '6-hour research forecasts')}</h3><p className="mt-1 text-xs text-slate-500">{t('इतिहास र दायरा-बाहिरको त्रुटि देखिन्छ; यो नियन्त्रण आदेश होइन।', 'Includes model history and back-test error; this is not a control command.')}</p></div><Link to={`/app/smart-farming/units/${unitId}`} className="text-xs font-semibold text-emerald-900 hover:underline">{t('विस्तृत विश्लेषण', 'Detailed analysis')} →</Link></div><div className="grid gap-3 md:grid-cols-3">{['temperature', 'humidity', 'soil_moisture'].map((key) => { const forecast = insights.forecasts?.[key]; const metric = METRICS.find((item) => item.key === key); const values = forecast?.ready ? forecast.forecast.map((point) => point.v) : []; return <article key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">{lang === 'en' ? metric.en : metric.ne}</p>{forecast?.ready ? <><p className="mt-2 text-2xl font-bold text-slate-900">{Math.min(...values).toFixed(1)}–{Math.max(...values).toFixed(1)} <span className="text-sm font-medium text-slate-500">{forecast.unit}</span></p><p className="mt-1 text-xs text-slate-500">{t('६ घण्टाको back-test RMSE', '6-hour back-test RMSE')}: {forecast.rmse?.[5] == null ? '—' : `±${forecast.rmse[5]} ${forecast.unit}`}</p></> : <p className="mt-3 text-sm text-slate-600">{forecast?.reason === 'stale' ? t('ताजा मापन चाहिन्छ', 'Needs fresh readings') : t('मोडेल सिक्न थप इतिहास चाहिन्छ', 'More history is needed to train the model')}</p>}</article>; })}</div></section>}

      {sensors.length > 0 && <section className="space-y-3"><div><h3 className="font-bold text-slate-950">{t('लाइभ सेन्सर समय-शृङ्खला', 'Live sensor time series')}</h3><p className="mt-1 text-xs text-slate-500">{t('दैनिक जाँच र विस्तारित दायराका लागि सेन्सर तथा अवधि छान्नुहोस्।', 'Choose a sensor and time window for quick checks or longer analysis.')}</p></div><HistoryChart sensors={sensors} parameters={chartParameters} t={t} live /></section>}
    </>}

    {!unitId && <div role="status" className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">{t('तपाईंको खातामा अनुसन्धानका लागि ग्रीनहाउस इकाई उपलब्ध छैन।', 'No greenhouse unit is available to your account for research yet.')}</div>}
    {unitId && canSeeLive && <ScienceAssistant key={unitId} unitId={unitId} live={live} lang={lang} t={t} />}
    {!canSeeLive && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">{t('अनुसन्धान उपकरण', 'Research tools')}</h3><p className="mt-1 text-sm text-slate-600">{t('समय शृङ्खला, तुलना, प्रयोग र डाटा गुणस्तर हेर्नुहोस्।', 'Explore time series, comparisons, experiments and data quality.')}</p></div><span className="inline-flex items-center gap-2 text-sm text-slate-600"><Activity size={16} />{units.length} {t('योग्य इकाई', 'eligible units')}</span></div></section>}

    {feedError && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{feedError}</p>}
    <section className="grid gap-4 lg:grid-cols-2"><FeedSection kind="news" rows={news} loading={feedLoading} lang={lang} t={t} can={can} /><FeedSection kind="blog" rows={articles} loading={feedLoading} lang={lang} t={t} can={can} /></section>
    <p className="text-center text-[11px] text-slate-500">{t('विश्लेषण बालीको सक्रिय चक्र र उपलब्ध सेन्सर डाटामा आधारित हुन्छ। सेन्सर कभरेज, क्यालिब्रेसन र ग्रीनहाउस तहमा भएका दोहोराइ जाँच्नुहोस्।', 'Analysis uses the active crop cycle and available sensor data. Check sensor coverage, calibration and replication at the greenhouse level.')}</p>
  </div>;
}

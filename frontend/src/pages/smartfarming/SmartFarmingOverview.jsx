import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, MapPin, RefreshCw, Search, Sprout, Wifi, WifiOff } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/useAuth';
import FormField, { inputCls } from '../../components/common/FormField';
import { errMsgs } from '../../utils/errors';
import { filterSites, getSiteConnectivity, PRIMARY_METRICS, summarizeSites } from '../../utils/siteOverview';

const empty = { name_en: '', name_ne: '', site_type: 'demonstration', address: '', latitude: '', longitude: '' };
const dateTime = (value, lang) => value
  ? new Date(value).toLocaleString(lang === 'en' ? 'en-GB' : 'ne-NP', { dateStyle: 'medium', timeStyle: 'short' })
  : null;

const CONNECTIVITY = {
  online: { cls: 'border-emerald-200 bg-emerald-50 text-emerald-900', en: 'All devices online', ne: 'सबै यन्त्र अनलाइन', icon: Wifi },
  mixed: { cls: 'border-amber-200 bg-amber-50 text-amber-950', en: 'Some devices need attention', ne: 'केही यन्त्र जाँच्नुहोस्', icon: AlertTriangle },
  offline: { cls: 'border-rose-200 bg-rose-50 text-rose-900', en: 'Devices offline', ne: 'यन्त्र अफलाइन', icon: WifiOff },
  awaiting: { cls: 'border-slate-200 bg-slate-100 text-slate-800', en: 'Awaiting first connection', ne: 'पहिलो जडानको प्रतीक्षामा', icon: Wifi },
  disabled: { cls: 'border-slate-200 bg-slate-100 text-slate-700', en: 'Devices disabled', ne: 'यन्त्र निष्क्रिय', icon: WifiOff },
  unconfigured: { cls: 'border-slate-200 bg-slate-100 text-slate-700', en: 'No devices configured', ne: 'यन्त्र जडान गरिएको छैन', icon: WifiOff },
  unknown: { cls: 'border-slate-200 bg-slate-100 text-slate-700', en: 'Connection unknown', ne: 'जडान अवस्था अज्ञात', icon: WifiOff }
};

function Metric({ metric, reading, lang, t }) {
  const label = lang === 'en' ? metric.en : metric.ne;
  const age = reading?.age_seconds == null ? null : Number(reading.age_seconds);
  const freshness = age == null ? null : age <= 300 ? t('लाइभ', 'Recent') : t('पुरानो डाटा', 'Stale');
  const numericValue = reading?.value == null ? null : Number(reading.value);
  return <div className="min-w-0 rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-emerald-950/5">
    <div className="flex items-center justify-between gap-1"><span className="truncate text-[11px] font-medium text-slate-600">{metric.icon} {label}</span>{freshness && <span className={`shrink-0 text-[10px] font-semibold ${age <= 300 ? 'text-emerald-800' : 'text-amber-800'}`}>{freshness}</span>}</div>
    <p className="mt-1 truncate text-lg font-bold tracking-tight text-slate-900">{numericValue == null || !Number.isFinite(numericValue) ? '—' : numericValue.toFixed(metric.digits)} <span className="text-xs font-medium text-slate-500">{reading?.unit || ''}</span></p>
    <p className="truncate text-[10px] text-slate-500">{reading ? `${reading.name} · ${reading.device_code}` : t('सेन्सर पठन उपलब्ध छैन', 'No sensor reading available')}</p>
  </div>;
}

function StatCard({ label, value, detail, tone = 'green', icon }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-900 ring-emerald-100',
    blue: 'bg-sky-50 text-sky-950 ring-sky-100',
    amber: 'bg-amber-50 text-amber-950 ring-amber-100',
    rose: 'bg-rose-50 text-rose-950 ring-rose-100'
  };
  return <article className={`rounded-2xl p-4 ring-1 ${tones[tone]}`}>
    <div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold opacity-75">{label}</p><span aria-hidden="true" className="text-lg">{icon}</span></div>
    <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
    <p className="mt-1 text-xs opacity-75">{detail}</p>
  </article>;
}

export default function SmartFarmingOverview() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  const t = (ne, en) => lang === 'en' ? en : ne;
  const { can } = useAuth();
  const [sites, setSites] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await api.get('/smart/sites');
      setSites(response.data);
      setUpdatedAt(new Date());
      setError('');
    } catch (e) {
      setError(errMsgs(e)[0]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => load(), 0);
    const timer = window.setInterval(() => load(true), 30000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); };
  }, [load]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setErrors([]);
    try {
      await api.post('/smart/sites', form);
      setForm(empty); setShow(false); load(true);
    } catch (err) { setErrors(errMsgs(err)); }
  };

  const summary = useMemo(() => summarizeSites(sites), [sites]);
  const visibleSites = useMemo(() => filterSites(sites, query, filter, lang), [sites, query, filter, lang]);
  const filterOptions = [
    ['all', t('सबै फार्म', 'All farms')], ['attention', t('ध्यान दिनुपर्ने', 'Needs attention')],
    ['online', t('अनलाइन', 'All online')], ['unconfigured', t('यन्त्र जडान गर्नुपर्ने', 'No devices yet')]
  ];

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 text-white shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-6 sm:px-7 sm:py-7">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-50"><Sprout size={14} /> {t('फार्म सञ्चालन केन्द्र', 'FARM OPERATIONS')}</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{t('स्मार्ट फार्मिङ', 'Smart Farming')}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-emerald-100">{t('सबै फार्म, ग्रीनहाउस र यन्त्रको प्रत्यक्ष अवस्था एउटै ठाउँमा हेर्नुहोस्।', 'Monitor registered farms, growing units, and device health in one place.')}</p>
          <p className="mt-3 text-xs text-emerald-200">{updatedAt ? `${t('सर्भरबाट अद्यावधिक', 'Server data updated')} · ${dateTime(updatedAt, lang)}` : t('सर्भर डाटाको प्रतीक्षामा', 'Waiting for server data')} · {t('हरेक ३० सेकेन्डमा स्वतः अद्यावधिक', 'Auto refresh every 30 seconds')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> {t('ताजा गर्नुहोस्', 'Refresh')}</button>
          {can('smart_farming.create') && <button type="button" onClick={() => setShow((value) => !value)} className="min-h-11 rounded-xl bg-lime-300 px-4 text-sm font-bold text-emerald-950 transition hover:bg-lime-200">+ {t('फार्म थप्नुहोस्', 'Add farm')}</button>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-white/15 sm:grid-cols-4">
        <div className="bg-emerald-950/30 px-5 py-3"><p className="text-xs text-emerald-200">{t('दर्ता भएका फार्म', 'Registered farms')}</p><p className="mt-1 text-2xl font-bold">{summary.sites}</p></div>
        <div className="bg-emerald-950/30 px-5 py-3"><p className="text-xs text-emerald-200">{t('उत्पादन इकाइ', 'Growing units')}</p><p className="mt-1 text-2xl font-bold">{summary.units}</p></div>
        <div className="bg-emerald-950/30 px-5 py-3"><p className="text-xs text-emerald-200">{t('अनलाइन यन्त्र', 'Devices online')}</p><p className="mt-1 text-2xl font-bold">{summary.online}<span className="text-base font-medium text-emerald-200"> / {summary.activeDevices}</span></p></div>
        <div className="bg-emerald-950/30 px-5 py-3"><p className="text-xs text-emerald-200">{t('खुला अलर्ट', 'Open alerts')}</p><p className="mt-1 text-2xl font-bold">{summary.alerts}</p></div>
      </div>
    </header>

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><span>{error}</span><button type="button" onClick={() => load()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 font-semibold ring-1 ring-red-200"><RefreshCw size={15} />{t('फेरि प्रयास', 'Retry')}</button></div>}

    {show && <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:grid-cols-2">
      <div className="sm:col-span-2"><h2 className="font-semibold text-gov-blue">{t('नयाँ फार्म दर्ता', 'Register a farm')}</h2><p className="mt-1 text-xs text-slate-600">{t('स्थान विवरण ऐच्छिक छ र पछि अद्यावधिक गर्न सकिन्छ।', 'Location details are optional and can be added later.')}</p></div>
      {errors.length > 0 && <ul role="alert" className="list-disc rounded-lg bg-red-50 p-3 pl-6 text-sm text-red-700 sm:col-span-2">{errors.map((item, i) => <li key={i}>{item}</li>)}</ul>}
      <FormField label={`${t('फार्मको नाम (अंग्रेजी)', 'Farm name (English)')} *`}><input required value={form.name_en} onChange={set('name_en')} className={inputCls} /></FormField>
      <FormField label={t('फार्मको नाम (नेपाली)', 'Farm name (Nepali)')}><input value={form.name_ne} onChange={set('name_ne')} className={inputCls} /></FormField>
      <FormField label={t('प्रकार', 'Type')}><select value={form.site_type} onChange={set('site_type')} className={inputCls}>{['demonstration', 'farm', 'research', 'other'].map((item) => <option key={item} value={item}>{item}</option>)}</select></FormField>
      <FormField label={t('ठेगाना', 'Address')}><input value={form.address} onChange={set('address')} className={inputCls} /></FormField>
      <FormField label={t('अक्षांश (ऐच्छिक)', 'Latitude (optional)')}><input type="number" step="any" min="-90" max="90" value={form.latitude} onChange={set('latitude')} className={inputCls} /></FormField>
      <FormField label={t('देशान्तर (ऐच्छिक)', 'Longitude (optional)')}><input type="number" step="any" min="-180" max="180" value={form.longitude} onChange={set('longitude')} className={inputCls} /></FormField>
      <div className="flex gap-2 sm:col-span-2"><button className="min-h-10 rounded-lg bg-agri-green px-4 text-sm font-semibold text-white">{t('सुरक्षित गर्नुहोस्', 'Save farm')}</button><button type="button" onClick={() => { setShow(false); setErrors([]); }} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">{t('रद्द', 'Cancel')}</button></div>
    </form>}

    <section aria-label={t('फार्म स्वास्थ्य', 'Farm health summary')} className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard label={t('अनलाइन', 'Online')} value={summary.online} detail={t('पछिल्लो ५ मिनेटमा सम्पर्क', 'Seen in the last 5 minutes')} tone="green" icon="●" />
      <StatCard label={t('अफलाइन', 'Offline')} value={summary.offline} detail={t('अन्तिम सम्पर्क ५ मिनेटभन्दा पुरानो', 'Last contact over 5 minutes ago')} tone={summary.offline ? 'rose' : 'blue'} icon="◌" />
      <StatCard label={t('पहिलो सम्पर्क बाँकी', 'Awaiting connection')} value={summary.awaiting} detail={t('अहिलेसम्म सम्पर्क नभएका यन्त्र', 'Devices with no recorded contact')} tone={summary.awaiting ? 'amber' : 'blue'} icon="⌁" />
      <StatCard label={t('निष्क्रिय यन्त्र', 'Disabled devices')} value={summary.disabled} detail={t('प्रशासनद्वारा बन्द गरिएका', 'Disabled by an administrator')} tone="blue" icon="○" />
      <StatCard label={t('सक्रिय सेन्सर', 'Active sensors')} value={summary.sensors} detail={t('दर्ता भएका भौतिक सेन्सर', 'Registered physical sensors')} tone="blue" icon="⌁" />
      <StatCard label={t('सेन्सर त्रुटि', 'Sensor faults')} value={summary.sensorFaults} detail={t('जाँच आवश्यक भएका सेन्सर', 'Sensors marked as faulty')} tone={summary.sensorFaults ? 'rose' : 'blue'} icon="⚠" />
    </section>

    <section>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div><h2 className="text-xl font-bold text-gov-blue">{t('तपाईंका फार्महरू', 'Your farms')} <span className="text-base font-semibold text-slate-500">({visibleSites.length})</span></h2><p className="mt-1 text-sm text-slate-600">{t('स्थिति र सेन्सर मापन सर्भरमा दर्ता भएका उपकरणबाट आउँछन्।', 'Status and readings come from devices registered with the server.')}</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative"><span className="sr-only">{t('फार्म खोज्नुहोस्', 'Search farms')}</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('नाम वा ठेगाना खोज्नुहोस्', 'Search name or address')} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm sm:w-64" /></label>
          <label><span className="sr-only">{t('स्थिति अनुसार छनोट', 'Filter by status')}</span><select value={filter} onChange={(event) => setFilter(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm sm:w-auto">{filterOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        </div>
      </div>

      {loading && !sites.length ? <div role="status" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((key) => <div key={key} className="h-56 animate-pulse rounded-2xl bg-slate-100" />)}<span className="sr-only">{t('फार्महरू लोड हुँदैछन्…', 'Loading farms…')}</span></div>
        : !sites.length && !error ? <div className="rounded-2xl border border-dashed border-emerald-200 bg-white p-8 text-center"><Sprout className="mx-auto text-emerald-700" size={30} /><p className="mt-3 font-semibold text-slate-900">{t('अहिलेसम्म फार्म दर्ता गरिएको छैन।', 'No farms have been registered yet.')}</p><p className="mt-1 text-sm text-slate-600">{can('smart_farming.create') ? t('सुरु गर्न फार्म साइट थप्नुहोस्।', 'Add a farm site to get started.') : t('प्रवेशका लागि प्रशासकलाई सम्पर्क गर्नुहोस्।', 'Contact an administrator for access.')}</p></div>
          : visibleSites.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center text-sm text-slate-600">{t('यो खोज वा छनोटमा फार्म भेटिएन।', 'No farms match this search and filter.')}</div>
            : <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleSites.map((site) => {
              const state = getSiteConnectivity(site);
              const connectivity = CONNECTIVITY[state];
              const StateIcon = connectivity.icon;
              const address = (lang === 'en' ? site.local_level_en : site.local_level_ne) || site.address;
              const latest = dateTime(site.latest_reading_at, lang);
              const metrics = site.latest_metrics || {};
              return <article key={site.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="h-1.5 bg-gradient-to-r from-emerald-700 via-lime-500 to-teal-500" />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{site.code} · {site.site_type}</p><h3 className="mt-1 truncate text-lg font-bold text-gov-blue">{lang === 'en' ? site.name_en : (site.name_ne || site.name_en)}</h3><p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-600">{address ? <><MapPin size={13} className="shrink-0" />{address}</> : t('स्थान विवरण छैन', 'Location not set')}</p></div>
                    <span className="shrink-0 rounded-lg bg-emerald-50 p-2 text-lg" aria-hidden="true">🌱</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-slate-500">{t('उत्पादन इकाइ', 'Growing units')}</p><p className="mt-0.5 font-bold text-slate-900">{Number(site.unit_count) || 0}</p></div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-slate-500">{t('सक्रिय यन्त्र', 'Active devices')}</p><p className="mt-0.5 font-bold text-slate-900">{Number(site.online_device_count) || 0} <span className="font-medium text-slate-500">/ {Math.max(0, (Number(site.device_count) || 0) - (Number(site.disabled_device_count) || 0))}</span></p></div>
                  </div>
                  <div className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${connectivity.cls}`}><StateIcon size={15} /><span>{lang === 'en' ? connectivity.en : connectivity.ne}</span>{Number(site.open_alert_count) > 0 && <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5">{site.open_alert_count} {t('अलर्ट', 'alerts')}</span>}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">{PRIMARY_METRICS.map((metric) => <Metric key={metric.key} metric={metric} reading={metrics[metric.key]} lang={lang} t={t} />)}</div>
                  <div className="mt-3 flex min-h-8 items-center justify-between gap-2 text-[11px] text-slate-500"><span className="truncate">{latest ? `${t('अन्तिम पठन', 'Last reading')} · ${latest}` : t('अझै सेन्सर डाटा छैन', 'No sensor data received yet')}</span>{site.latitude != null && site.longitude != null && <a className="shrink-0 font-semibold text-emerald-900 underline" href={`https://www.google.com/maps?q=${encodeURIComponent(`${site.latitude},${site.longitude}`)}`} target="_blank" rel="noreferrer">{t('नक्सा', 'Map')}</a>}</div>
                  <Link to={`/app/smart-farming/sites/${site.id}`} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">{t('फार्म खोल्नुहोस्', 'Open farm')} <span aria-hidden="true" className="ml-2">→</span></Link>
                </div>
              </article>;
            })}</div>}
    </section>
  </div>;
}

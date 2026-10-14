import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowUpRight, BarChart3, ClipboardCheck, Database, Download, FlaskConical, Gauge, MapPinned, Microscope, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import useLang from '../../utils/useLang';
import { useAuth } from '../../context/AuthContext';

const box = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const fmt = (n) => new Intl.NumberFormat().format(Number(n || 0));

async function fetchReportData(canDistrict, canResearch) {
  const jobs = [];
  if (canDistrict) jobs.push(['district', api.get('/datacenter/overview')]);
  if (canResearch) { jobs.push(['units', api.get('/research/units')]); jobs.push(['storage', api.get('/research/storage')]); jobs.push(['health', api.get('/research/devices/health')]); }
  const results = await Promise.allSettled(jobs.map((x) => x[1]));
  const next = {};
  let error = '';
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') next[jobs[i][0]] = r.value.data;
    else error ||= r.reason.response?.data?.message || 'Some report data could not be loaded.';
  });
  return { next, error };
}

export default function Reports() {
  const { t } = useLang(); const { can } = useAuth();
  const canDistrict = can('datacenter.view'), canResearch = can('research.view');
  const [data, setData] = useState({}), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { const result = await fetchReportData(canDistrict, canResearch); setData(result.next); setError(result.error); }
    catch { setError(t('केही तथ्याङ्क लिन सकिएन।', 'Report data could not be loaded.')); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let current = true;
    fetchReportData(canDistrict, canResearch).then((result) => { if (current) { setData(result.next); setError(result.error); } })
      .catch(() => { if (current) setError('Report data could not be loaded.'); });
    return () => { current = false; };
  }, [canDistrict, canResearch]);
  const district = data.district, units = data.units || [], storage = data.storage, health = data.health || [];
  const readyUnits = units.filter((u) => Number(u.days) > 0).length;
  const onlineDevices = health.filter((d) => d.live === 'online').length;
  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-900 p-6 text-white shadow-lg sm:p-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[.18em] text-emerald-200">{t('कास्की कृषि अनुसन्धान', 'Kaski agriculture intelligence')}</p><h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{t('वैज्ञानिक प्रतिवेदन', 'Scientific reports')}</h1><p className="mt-2 max-w-3xl text-slate-200">{t('क्षेत्रगत सर्वेक्षण, उत्पादन अभिलेख, ग्रीनहाउस सेन्सर औसत र यन्त्र स्वास्थ्यबाट पुनःउत्पादन गर्न मिल्ने विश्लेषण तयार गर्नुहोस्।', 'Prepare traceable analysis from field surveys, production records, greenhouse sensor averages, and device health.')}</p></div><button onClick={load} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/30 px-4 font-semibold hover:bg-white/10 disabled:opacity-60"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>{t('तथ्याङ्क ताजा गर्नुहोस्', 'Refresh data')}</button></div></header>
    {error && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[{ icon: MapPinned, label: t('सक्रिय कृषक', 'Active farmers'), value: district ? fmt(district.farmers.active) : '—', sub: district ? `${fmt(district.farmers.verified)} ${t('प्रमाणित', 'verified')}` : t('डाटा केन्द्र अनुमति चाहिन्छ', 'Data Center permission required') },
        { icon: Database, label: t('दर्ता फार्म', 'Registered farms'), value: district ? fmt(district.farms.count) : '—', sub: district ? `${fmt(district.farms.with_gps)} ${t('GPS सहित', 'with GPS')}` : '' },
        { icon: Activity, label: t('विश्लेषणयोग्य ग्रीनहाउस', 'Greenhouses with daily data'), value: can('research.view') ? fmt(readyUnits) : '—', sub: can('research.view') ? `${fmt(units.length)} ${t('कुल इकाई', 'total units')}` : t('अनुसन्धान अनुमति चाहिन्छ', 'Research permission required') },
        { icon: Gauge, label: t('अनलाइन यन्त्र', 'Devices online'), value: can('research.view') ? `${fmt(onlineDevices)} / ${fmt(health.length)}` : '—', sub: t('पछिल्लो पाँच मिनेटको heartbeat', 'Heartbeat in the last five minutes') }
      ].map(({ icon: Icon, label, value, sub }) => <article key={label} className={box}><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Icon size={19}/></span><p className="mt-4 text-sm text-slate-600">{label}</p><p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{sub}</p></article>)}
    </section>
    <section className="grid gap-4 lg:grid-cols-3">
      <article className={`${box} lg:col-span-2`}><div className="flex items-center gap-2"><Microscope className="text-emerald-800"/><h2 className="text-xl font-bold text-slate-950">{t('कास्की जिल्ला सर्वेक्षण', 'Kaski district survey')}</h2></div><p className="mt-2 text-sm leading-relaxed text-slate-600">{t('स्थानीय तह र वडा अनुसार कृषक, फार्म, बाली, पशुपालन, उत्पादन र GPS कवरेज हेर्नुहोस्। आयातपछि गुणस्तर नियमले दोहोरिएका, अपूर्ण र समीक्षा आवश्यक अभिलेख देखाउँछ।', 'Explore farmers, farms, crops, livestock, production, and GPS coverage by local level and ward. After import, quality rules flag duplicates, incomplete records, and entries needing review.')}</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{[
        { to: '/app/data-center', icon: BarChart3, title: t('जिल्ला डाटा केन्द्र', 'District Data Center'), desc: t('नक्सा, स्थानीय तह, बाली, उत्पादन र गुणस्तर', 'Maps, local levels, crops, production, and quality') },
        { to: '/app/data-center/survey', icon: ClipboardCheck, title: t('क्षेत्रगत सर्वेक्षण', 'Field survey'), desc: t('अफलाइन मस्यौदा, GPS र अनलाइन सिङ्क', 'Offline drafts, GPS, and online sync') }
      ].map(({ to, icon: Icon, title, desc }) => <Link key={to} to={to} className="group rounded-xl border border-slate-200 p-4 hover:border-emerald-400 hover:bg-emerald-50/50"><span className="flex items-center justify-between"><Icon className="text-emerald-800" size={20}/><ArrowUpRight className="text-slate-400 group-hover:text-emerald-800" size={17}/></span><h3 className="mt-3 font-bold text-slate-950">{title}</h3><p className="mt-1 text-sm text-slate-600">{desc}</p></Link>)}</div></article>
      <article className={box}><div className="flex items-center gap-2"><FlaskConical className="text-purple-800"/><h2 className="text-xl font-bold text-slate-950">{t('ग्रीनहाउस अनुसन्धान', 'Greenhouse research')}</h2></div><p className="mt-2 text-sm leading-relaxed text-slate-600">{t('तापक्रम, आर्द्रता, माटो चिस्यान र प्रकाशको दैनिक/घण्टे औसत, coverage, सहसम्बन्ध, तुलना र प्रयोग विश्लेषण।', 'Daily and hourly temperature, humidity, soil moisture, and light averages with coverage, correlation, comparisons, and experiments.')}</p><Link to="/app/research" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-900 px-4 font-semibold text-white hover:bg-emerald-950">{t('अनुसन्धान प्रयोगशाला खोल्नुहोस्', 'Open Research Lab')}<ArrowUpRight size={16}/></Link><div className="mt-5 rounded-xl bg-slate-50 p-3 text-sm">{storage ? <><p className="font-semibold text-slate-900">{t('दैनिक औसत अवधि', 'Daily average coverage')}</p><p className="mt-1 text-slate-600">{storage.daily_rollups.first_day || '—'} → {storage.daily_rollups.last_day || '—'}</p><p className="mt-1 text-xs text-slate-500">{fmt(storage.daily_rollups.rows)} {t('दिन-इकाई अभिलेख', 'unit-day records')}</p></> : <p className="text-slate-600">{t('दैनिक औसत / भण्डारण मेट्रिक लोड हुँदैछ।', 'Daily average and storage metrics load when research data is available.')}</p>}</div></article>
    </section>
    <section className="grid gap-4 lg:grid-cols-2">
      <article className={box}><h2 className="text-lg font-bold text-slate-950">{t('अनुसन्धान डेटा गुणवत्ता नियम', 'Research data quality rules')}</h2><ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700"><li>• {t('दैनिक औसत बनाउँदा घण्टे मापनलाई नमुना संख्याले तौल दिइन्छ।', 'Daily means weight hourly means by the number of received samples.')}</li><li>• {t('कभरेज ७०% भन्दा कम भएका दिनलाई सामान्यतया मुख्य विश्लेषणबाट हटाउनुहोस्।', 'Usually exclude days with under 70% coverage from primary analysis.')}</li><li>• {t('सहसम्बन्ध सम्बन्ध देखाउँछ, कारण होइन; एउटै ग्रीनहाउसका दिन स्वतन्त्र पुनरावृत्ति होइनन्।', 'Correlation shows association, not causation; days from one greenhouse are not independent replicates.')}</li><li>• {t('कृषकको अनुसन्धान सहमति र प्रमाणित स्थिति भएका फार्मको तथ्याङ्क मात्र अनुसन्धान निर्यातमा समावेश हुन्छ।', 'Farmer-owned units enter research exports only with verified status and research consent.')}</li></ul><Link to="/app/research" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-900 underline"><Download size={16}/>{t('डेटा dictionary र निर्यात विकल्प', 'Data dictionary and export options')}</Link></article>
      <article className={box}><h2 className="text-lg font-bold text-slate-950">{t('भण्डारण तथा स्वचालन अवस्था', 'Storage and automation status')}</h2>{storage ? <><div className="mt-3 flex items-end justify-between gap-3"><span className="text-sm text-slate-600">{t('दैनिक rollup अवधि', 'Daily rollup retention')}</span><strong className="text-lg">{storage.retention_plan.daily_rollups_days} {t('өдөр', 'days')}</strong></div><div className="mt-2 flex items-end justify-between gap-3"><span className="text-sm text-slate-600">{t('कच्चा reading अवधि', 'Raw reading retention')}</span><strong className="text-lg">{storage.retention_plan.raw_readings_days} {t('өдөр', 'days')}</strong></div><p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">{t('Автомат pruning अहिले बन्द छ। दैनिक rollup सुरक्षित भएको पुष्टि र DB backup नीति समीक्षा नगरी डेटा हटाइँदैन।', 'Automatic pruning is currently off. Old readings are not removed until rollup completeness and database backup policy are verified.')}</p></> : <p className="mt-3 text-sm text-slate-600">{t('भण्डारण जानकारीका लागि अनुसन्धान अनुमति चाहिन्छ।', 'Research permission is needed to view storage details.')}</p>}</article>
    </section>
    <footer className="rounded-xl bg-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-600">{t('वैज्ञानिक सावधानी: नतिजा उपलब्ध नमुनाको दायरा, उपकरणको calibration, स्थानको उचाइ/मोहडा र मौसममा निर्भर हुन्छ। जिल्ला-स्तरको निष्कर्षलाई नमुना डिजाइन र गुणस्तर सूचकसँगै प्रस्तुत गर्नुहोस्।', 'Scientific note: findings depend on the sampled locations, sensor calibration, elevation/aspect, and weather. Present district-level conclusions with sampling design and quality indicators.')}</footer>
  </div>;
}

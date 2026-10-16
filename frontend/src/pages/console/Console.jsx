import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import api from '../../services/api';
import useLang from '../../utils/useLang';
import { useAuth } from '../../context/useAuth';
import { ageText, offlineOverview } from '../../utils/console';
import LiveTab from './LiveTab';
import SensorOverviewTab from './SensorOverviewTab';
import InsightsTab from './InsightsTab';
import AutomationTab from './AutomationTab';
import DeviceTab from './DeviceTab';

export default function Console() {
  const { id } = useParams();
  const location = useLocation();
  const { lang, t } = useLang();
  const { can } = useAuth();
  const insideSmartFarming = location.pathname.startsWith('/app/smart-farming/monitoring/');
  const siteId = new URLSearchParams(location.search).get('site');
  const backTo = insideSmartFarming ? (siteId ? `/app/smart-farming/sites/${siteId}` : '/app/smart-farming') : '/app/console';
  const backLabel = insideSmartFarming ? t('स्मार्ट फार्मिङमा फर्कनुहोस्', 'Back to Smart Farming') : t('सबै ग्रीनहाउस', 'All greenhouses');
  const [ov, setOv] = useState(() => offlineOverview(id));
  const [err, setErr] = useState('');
  const [serverHealth, setServerHealth] = useState({ server: 'checking', db: 'checking' });
  const [tab, setTab] = useState('overview');
  const load = useCallback(async () => {
    try {
      const response = await api.get(`/console/units/${id}/overview`);
      setOv({ ...response.data, _at: Date.now(), _offlineFallback: false, _fetchError: false });
      setServerHealth({ server: 'online', db: 'up' });
      setErr('');
    } catch (error) {
      setErr(error.response?.data?.message || 'Could not load live farm data');
      setOv((current) => current?._offlineFallback ? current : { ...current, _fetchError: true });
      let healthData = null;
      try { healthData = (await api.get('/health')).data; }
      catch (healthError) { if (healthError.response) healthData = healthError.response.data; }
      setServerHealth(healthData
        ? { server: 'online', db: healthData.db || 'unknown' }
        : { server: 'offline', db: 'unknown' });
    }
  }, [id]);
  useEffect(() => {
    setOv(offlineOverview(id));
    setErr('');
    setServerHealth({ server: 'checking', db: 'checking' });
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [id, load]);
  const online = ov.devices.some((d) => d.live === 'online');
  const lastSeen = Math.min(...ov.devices.map((d) => (d.age_s === null ? 1e9 : d.age_s)));
  const stale = ov._fetchError || !online || lastSeen > 180;
  const serverLabel = serverHealth.server === 'online' ? t('अनलाइन', 'Online') : serverHealth.server === 'offline' ? t('अफलाइन', 'Offline') : t('जाँच हुँदैछ', 'Checking');
  const dbLabel = serverHealth.db === 'up' ? t('ठीक', 'Up') : serverHealth.db === 'down' ? t('बन्द', 'Down') : t('अज्ञात', 'Unknown');
  const espLabel = ov._fetchError ? t('पुष्टि हुन सकेन', 'Unverified') : ov.devices.length ? (online ? t('अनलाइन', 'Online') : t('अफलाइन', 'Offline')) : ov._offlineFallback ? t('हृदयस्पन्दन डाटा छैन', 'No heartbeat data') : t('दर्ता छैन', 'Not registered');
  const tabs = [['overview', '📊', t('अवलोकन', 'Overview'), true], ['charts', '📈', t('चार्ट र प्रवृत्ति', 'Charts & Trends'), true], ['device', '🔧', t('यन्त्र', 'Devices'), can('devices.view')], ['alerts', '🔔', t('अलर्ट', 'Alerts'), true], ['insights', '🧠', t('एआई विश्लेषण', 'AI insights'), true], ['automation', '⚙️', t('स्वचालन', 'Automation'), can('irrigation_control.view')]].filter((x) => x[3]);
  const props = { id, ov, reload: load, lang, t, can };
  return (
    <div className="gh-console max-w-7xl space-y-5 rounded-2xl bg-[#07160f] p-3 text-white shadow-xl sm:p-5">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-[#103020] to-[#0b1c13] p-4 shadow-lg sm:p-5">
        <div className="min-w-60 flex-1">
          <Link to={backTo} className="text-xs text-emerald-200 underline">← {backLabel}</Link>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">{t('स्मार्ट कृषि · सेन्सर अनुगमन', 'Smart agriculture · sensor monitoring')}</p>
          <h2 className="mt-1 text-2xl font-bold leading-tight text-white">{lang === 'en' ? ov.unit.name_en : (ov.unit.name_ne || ov.unit.name_en)}</h2>
          <p className="text-sm text-emerald-100/65">{lang === 'en' ? ov.unit.site_en : ov.unit.site_ne} · {ov.unit.code}{ov.unit.is_simulated ? ' · SIMULATED' : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`rounded-full border px-3 py-1 font-semibold ${stale ? 'border-amber-300/30 bg-amber-300/10 text-amber-100' : 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'}`}>{stale ? t('अफलाइन / पुरानो डाटा', 'Offline / stale data') : t('अनलाइन', 'Online')}</span>
          <span className={`rounded-full border px-3 py-1 text-xs ${serverHealth.server === 'online' ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-rose-300/30 bg-rose-300/10 text-rose-100'}`}>API: {serverLabel}</span>
          <span className={`rounded-full border px-3 py-1 text-xs ${serverHealth.db === 'up' ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-amber-300/30 bg-amber-300/10 text-amber-100'}`}>DB: {dbLabel}</span>
          <span className={`rounded-full border px-3 py-1 text-xs ${online ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-amber-300/30 bg-amber-300/10 text-amber-100'}`}>ESP32: {espLabel}</span>
          <span className="text-emerald-100/60">{t('अन्तिम सम्पर्क', 'Last contact')}: {ageText(lastSeen >= 1e9 ? null : lastSeen, t)}</span>
          {ov.alerts.length > 0 && <span className="rounded-full border border-rose-300/25 bg-rose-300/10 px-3 py-1 font-semibold text-rose-100">🔔 {ov.alerts.length}</span>}
          <button type="button" onClick={load} className="min-h-10 rounded-lg border border-white/15 px-3 text-sm font-semibold text-white hover:bg-white/10">↻ {t('ताजा गर्नुहोस्', 'Refresh')}</button>
          <button type="button" onClick={() => window.print()} className="min-h-10 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-500">⇩ {t('प्रतिवेदन', 'Print / PDF')}</button>
        </div>
      </div>
      {err && <div role="status" className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">
        <p className="font-semibold">{serverHealth.server === 'online' ? t('सर्भर चलिरहेको छ, तर फार्म डाटा लोड भएन।', 'The server is responding, but farm data did not load.') : t('सर्भरसँग सम्पर्क हुन सकेन।', 'The server could not be reached.')}</p>
        <p className="mt-1">{err} {ov._offlineFallback ? t('देखाइएका ० मानहरू नमुना हुन्, लाइभ सेन्सर पठन होइनन्।', 'The displayed zeroes are placeholders, not live sensor readings.') : t('पछिल्लो सफल मापन देखाइएको छ।', 'Showing the last successful readings.')}</p>
      </div>}
      {stale && <div role="alert" className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">⚠ {ov._fetchError ? t('ड्यासबोर्ड ताजा गर्न सकिएन। अन्तिम सफल अवस्था देखाइएको छ र ताजा डाटा नआएसम्म नियन्त्रण बन्द छ।', 'Could not refresh dashboard data. Showing the last successful state; controls stay disabled until fresh data arrives.') : ov._offlineFallback ? t('ESP32 को हृदयस्पन्दन डाटा उपलब्ध छैन। ० मानहरू नमुना हुन्।', 'ESP32 heartbeat data is unavailable. Zero values are placeholders.') : t('यन्त्रले केही समयदेखि सम्पर्क गरेको छैन — देखिएका मान पुराना हुन सक्छन् र पम्प नियन्त्रण बन्द छ।', 'The device has not reported recently — values may be old and pump control is disabled.')}</div>}
      <div className="flex gap-1 overflow-x-auto border-b border-white/10" role="tablist" aria-label={t('ग्रीनहाउस ड्यासबोर्ड खण्डहरू', 'Greenhouse dashboard sections')}>
        {tabs.map(([k, icon, label]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-11 shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${tab === k ? 'border-emerald-400 text-emerald-300' : 'border-transparent text-emerald-100/55 hover:text-white'}`}>{icon} {label}</button>)}
      </div>
      {tab === 'overview' && <SensorOverviewTab id={id} ov={ov} lang={lang} t={t} />}
      {tab === 'charts' && <LiveTab {...props} offline={stale} />}
      {tab === 'alerts' && <section role="tabpanel" aria-label={t('अलर्ट', 'Alerts')} className="rounded-2xl border border-white/10 bg-[#0d2118] p-4 sm:p-5"><h3 className="font-bold text-white">{t('हालका अलर्ट', 'Recent alerts')}</h3>{ov.alerts.length ? <ul className="mt-3 space-y-2">{ov.alerts.map((alert) => <li key={alert.id} className={`rounded-xl border p-3 text-sm ${alert.severity === 'critical' ? 'border-rose-300/30 bg-rose-300/10 text-rose-100' : alert.severity === 'warning' ? 'border-amber-300/30 bg-amber-300/10 text-amber-100' : 'border-sky-300/25 bg-sky-300/10 text-sky-100'}`}><div className="flex flex-wrap items-center justify-between gap-2"><span>{alert.message}</span><span className="text-xs opacity-70">{new Date(alert.triggered_at).toLocaleString(lang === 'ne' ? 'ne-NP' : 'en-GB')} · {alert.severity}</span></div></li>)}</ul> : <p className="mt-3 rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-emerald-100/55">{t('खुला अलर्ट छैन।', 'No open alerts.')}</p>}</section>}
      {tab === 'insights' && <InsightsTab {...props} />}
      {tab === 'automation' && <AutomationTab {...props} />}
      {tab === 'device' && <DeviceTab {...props} />}
    </div>
  );
}

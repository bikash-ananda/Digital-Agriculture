import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../services/api';
import useLang from '../../utils/useLang';
import { useAuth } from '../../context/useAuth';
import { ageText } from '../../utils/console';
import LiveTab from './LiveTab';
import InsightsTab from './InsightsTab';
import AutomationTab from './AutomationTab';
import DeviceTab from './DeviceTab';

export default function Console() {
  const { id } = useParams();
  const { lang, t } = useLang();
  const { can } = useAuth();
  const [ov, setOv] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('live');
  const load = useCallback(() => api.get(`/console/units/${id}/overview`).then((r) => { setOv({ ...r.data, _at: Date.now() }); setErr(''); }).catch((e) => setErr(e.response?.data?.message || 'Failed to load')), [id]);
  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv); }, [load]);

  if (err && !ov) return <div className="p-4 bg-red-50 text-red-700 rounded">{err}</div>;
  if (!ov) return <p className="text-gray-500">…</p>;
  const online = ov.devices.some((d) => d.live === 'online');
  const lastSeen = Math.min(...ov.devices.map((d) => (d.age_s === null ? 1e9 : d.age_s)));
  const stale = !online || lastSeen > 180;
  const tabs = [['live', '📡', t('प्रत्यक्ष', 'Live'), true], ['insights', '🧠', t('एआई विश्लेषण', 'AI insights'), true], ['automation', '⚙️', t('स्वचालन', 'Automation'), can('irrigation_control.view')], ['device', '🔧', t('यन्त्र', 'Device'), can('devices.view')]].filter((x) => x[3]);
  const props = { id, ov, reload: load, lang, t, can };
  return (
    <div className="space-y-5 max-w-7xl">
      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap items-center gap-4 border-t-4 border-agri-green">
        <div className="min-w-60 flex-1">
          <Link to="/app/console" className="text-xs text-gov-blue underline">← {t('सबै ग्रीनहाउस', 'All greenhouses')}</Link>
          <h2 className="text-2xl font-bold text-terrace-900 leading-tight">{lang === 'en' ? ov.unit.name_en : (ov.unit.name_ne || ov.unit.name_en)}</h2>
          <p className="text-sm text-gray-600">{lang === 'en' ? ov.unit.site_en : ov.unit.site_ne} · {ov.unit.code}{ov.unit.is_simulated ? ' · SIMULATED' : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`px-3 py-1 rounded-full font-semibold ${stale ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{stale ? t('अफलाइन / पुरानो तथ्याङ्क', 'Offline / stale data') : t('अनलाइन', 'Online')}</span>
          <span className="text-gray-600">{t('अन्तिम सम्पर्क', 'Last contact')}: {ageText(lastSeen >= 1e9 ? null : lastSeen, t)}</span>
          {ov.alerts.length > 0 && <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 font-semibold">🔔 {ov.alerts.length}</span>}
        </div>
      </div>
      {stale && <div role="alert" className="p-3 bg-yellow-50 border border-yellow-300 rounded text-sm text-yellow-900">⚠ {t('यन्त्रले केही समयदेखि सम्पर्क गरेको छैन — देखिएका मान पुराना हुन सक्छन् र पम्प नियन्त्रण बन्द छ।', 'The device has not reported recently — values may be old and pump control is disabled.')}</div>}
      {ov.alerts.length > 0 && (
        <ul className="space-y-1">{ov.alerts.map((a) => <li key={a.id} className={`p-2 rounded text-sm ${a.severity === 'critical' ? 'bg-red-50 text-red-800' : 'bg-yellow-50 text-yellow-900'}`}>{a.message}</li>)}</ul>
      )}
      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map(([k, icon, label]) => <button key={k} onClick={() => setTab(k)} className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-agri-green text-agri-green' : 'border-transparent text-gray-600 hover:text-gov-blue'}`}>{icon} {label}</button>)}
      </div>
      {tab === 'live' && <LiveTab {...props} offline={stale} />}
      {tab === 'insights' && <InsightsTab {...props} />}
      {tab === 'automation' && <AutomationTab {...props} />}
      {tab === 'device' && <DeviceTab {...props} />}
    </div>
  );
}

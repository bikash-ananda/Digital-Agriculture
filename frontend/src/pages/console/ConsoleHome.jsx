import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import useLang from '../../utils/useLang';
import { meta, fv } from '../../utils/console';

const ST = { online: 'bg-green-100 text-green-800', offline: 'bg-red-100 text-red-800', registered: 'bg-gray-100 text-gray-700', disabled: 'bg-gray-200 text-gray-600' };

export default function ConsoleHome() {
  const { lang, t } = useLang();
  const [units, setUnits] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    const load = () => api.get('/console/units').then((r) => setUnits(r.data)).catch((e) => setErr(e.response?.data?.message || 'Failed to load'));
    load();
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-terrace-900">{t('ग्रीनहाउस कन्सोल', 'Greenhouse Console')}</h2>
        <p className="text-gray-600">{t('अनुगमन, पम्प नियन्त्रण, स्वचालन र एआई विश्लेषण — एकै ठाउँमा।', 'Monitoring, pump control, automation and AI analysis in one place.')}</p>
      </div>
      {err && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{err}</div>}
      {units && units.length === 0 && <p className="p-4 bg-yellow-50 text-yellow-900 rounded text-sm">{t('कुनै ग्रीनहाउस इकाई छैन।', 'No greenhouse units yet.')}</p>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {(units || []).map((u) => (
          <Link key={u.id} to={`/app/console/${u.id}`} className="bg-white rounded-xl shadow p-5 hover:shadow-md transition border-t-4 border-agri-green">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display font-bold text-terrace-900 text-lg leading-snug">{lang === 'en' ? u.name_en : (u.name_ne || u.name_en)}</p>
                <p className="text-sm text-gray-600">{lang === 'en' ? u.site_en : u.site_ne}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ST[u.status] || ST.registered}`}>{u.status}</span>
            </div>
            <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
              {['temperature', 'humidity', 'soil_moisture', 'light'].map((k) => (
                <div key={k}><dt className="text-lg" title={meta(k)[lang]}>{meta(k).icon}</dt><dd className="font-semibold text-terrace-800">{u.values[k] === undefined ? '—' : fv(u.values[k], meta(k).d)}</dd></div>
              ))}
            </dl>
            <div className="mt-3 flex items-center gap-2 text-xs">
              {u.is_simulated && <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800">SIMULATED</span>}
              {u.open_alerts > 0 && <span className="px-2 py-0.5 rounded bg-red-100 text-red-800">🔔 {u.open_alerts} {t('अलर्ट', 'alerts')}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

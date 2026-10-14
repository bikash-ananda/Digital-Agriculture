import { useEffect, useState } from 'react';
import api from '../../services/api';
import useLang from '../../utils/useLang';
import { useAuth } from '../../context/AuthContext';
import { ymd } from '../../components/research/helpers';
import ExploreTab from './ExploreTab';
import AnalyzeTab from './AnalyzeTab';
import ExperimentsTab from './ExperimentsTab';
import DeviceHealthTab from './DeviceHealthTab';
import AutomationTab from './AutomationTab';
import ResearchExportTab from './ResearchExportTab';

const today = new Date();
const firstDay = new Date(today);
firstDay.setDate(today.getDate() - 29);
const DEFAULT_RANGE = { from: ymd(firstDay), to: ymd(today) };

export default function ResearchLab() {
  const { lang, t } = useLang();
  const { can } = useAuth();
  const [metrics, setMetrics] = useState([]);
  const [units, setUnits] = useState([]);
  const [storage, setStorage] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('explore');
  const [range, setRange] = useState(DEFAULT_RANGE);

  useEffect(() => {
    api.get('/research/metrics').then((r) => setMetrics(r.data)).catch((e) => setErr(e.response?.data?.message || 'Failed to load'));
    api.get('/research/units').then((r) => setUnits(r.data)).catch(() => {});
    api.get('/research/storage').then((r) => setStorage(r.data)).catch(() => {});
  }, []);
  const mm = Object.fromEntries(metrics.map((m) => [m.key, m]));
  const common = { units, metrics, mm, range, lang, t };

  const tabs = [
    ['explore', '📈', t('अन्वेषण', 'Explore'), true], ['analyze', '🔬', t('विश्लेषण', 'Analyze'), true], ['experiments', '🧪', t('प्रयोग', 'Experiments'), true],
    ['devices', '📟', t('यन्त्र तथा क्यालिब्रेसन', 'Devices & calibration'), true], ['automation', '🤖', t('स्वचालन प्रतिक्रिया', 'Automation response'), true], ['export', '📤', t('निर्यात', 'Export'), can('research.export')]
  ].filter((x) => x[3]);

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-lg shadow p-4 border-t-4 border-agri-green">
        <div>
          <h2 className="text-2xl font-bold text-gov-blue">🔬 {t('अनुसन्धान प्रयोगशाला', 'Research Lab')}</h2>
          <p className="text-sm text-gray-600">{t('ग्रीनहाउस सेन्सर तथ्याङ्कको विश्लेषण, प्रयोग र निर्यात', 'Analysis, experiments and export of greenhouse sensor data')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <button onClick={() => window.print()} className="print:hidden border border-gov-blue text-gov-blue hover:bg-blue-50 px-3 py-2 rounded-md font-semibold">🖨️ {t('प्रिन्ट', 'Print view')}</button>
          <label>{t('देखि', 'From')}<input type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} className="block mt-1 border rounded p-2" /></label>
          <label>{t('सम्म', 'To')}<input type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} className="block mt-1 border rounded p-2" /></label>
        </div>
      </div>
      {storage && (
        <section className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex flex-wrap justify-between gap-3 items-center">
            <div>
              <h3 className="font-semibold text-gov-blue">🗃️ {t('डाटा भण्डारण', 'Data storage')}</h3>
              <p className="text-sm text-gray-600">{t('डाटाबेसको हालको आकार', 'Current database footprint')}: <b>{(storage.database_bytes / (1024 ** 3)).toFixed(2)} GB</b> · {t('दैनिक सारांश उपलब्ध', 'daily summaries available')}: {storage.daily_rollups.first_day || '—'} → {storage.daily_rollups.last_day || '—'}</p>
            </div>
            <p className="text-xs text-gray-500 max-w-xl">{t('दैनिक अनुसन्धान CSV र प्रिन्ट दृश्यले ७३० दिनसम्म चयन स्वीकार्छ। कम्प्रेस गरिएको ब्याकअप स्क्रिप्टको सीमा ५ GB (५,०००,०००,००० बाइट) हो; यो डाटाबेस आकारभन्दा अलग हो। Google मौसम डाटा छोटो समय मात्र देखाइन्छ; दीर्घकालीन अनुसन्धानका लागि आफ्नै मौसम सेन्सर प्रयोग गर्नुहोस्।', 'Daily research export and print view accept ranges up to 730 days. The compressed-backup script limit is 5 GB (5,000,000,000 bytes), separate from database size. Google weather is shown temporarily; use your own weather sensor for long-term research.')}</p>
          </div>
        </section>
      )}
      {err && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{err}</div>}
      {units.length === 0 && !err && <p className="p-3 bg-yellow-50 text-yellow-900 rounded text-sm">{t('अहिलेसम्म कुनै ग्रीनहाउस इकाई छैन।', 'No greenhouse units yet.')}</p>}
      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map(([k, icon, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-agri-green text-agri-green' : 'border-transparent text-gray-600 hover:text-gov-blue'}`}>{icon} {label}</button>
        ))}
      </div>
      {tab === 'explore' && <ExploreTab {...common} />}
      {tab === 'analyze' && <AnalyzeTab {...common} />}
      {tab === 'experiments' && <ExperimentsTab {...common} can={can} />}
      {tab === 'devices' && <DeviceHealthTab {...common} can={can} />}
      {tab === 'automation' && <AutomationTab {...common} />}
      {tab === 'export' && <ResearchExportTab {...common} />}
    </div>
  );
}

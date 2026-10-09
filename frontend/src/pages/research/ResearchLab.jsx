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

export default function ResearchLab() {
  const { lang, t } = useLang();
  const { can } = useAuth();
  const [metrics, setMetrics] = useState([]);
  const [units, setUnits] = useState([]);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('explore');
  const [range, setRange] = useState({ from: ymd(new Date(Date.now() - 29 * 86400000)), to: ymd(new Date()) });

  useEffect(() => {
    api.get('/research/metrics').then((r) => setMetrics(r.data)).catch((e) => setErr(e.response?.data?.message || 'Failed to load'));
    api.get('/research/units').then((r) => setUnits(r.data)).catch(() => {});
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
          <label>{t('देखि', 'From')}<input type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} className="block mt-1 border rounded p-2" /></label>
          <label>{t('सम्म', 'To')}<input type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} className="block mt-1 border rounded p-2" /></label>
        </div>
      </div>
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

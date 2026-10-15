import { useEffect, useState } from 'react';
import api from '../../services/api';
import useLang from '../../utils/useLang';
import { useAuth } from '../../context/useAuth';
import { ymd } from '../../components/research/formatters';
import ExploreTab from './ExploreTab';
import AnalyzeTab from './AnalyzeTab';
import ExperimentsTab from './ExperimentsTab';
import DeviceHealthTab from './DeviceHealthTab';
import AutomationTab from './AutomationTab';
import ResearchExportTab from './ResearchExportTab';
import ResearchOverview from './ResearchOverview';

const today = new Date();
const firstDay = new Date(today);
firstDay.setDate(today.getDate() - 29);
const DEFAULT_RANGE = { from: ymd(firstDay), to: ymd(today) };

export default function ResearchLab() {
  const { lang, t } = useLang();
  const { can } = useAuth();
  const [metrics, setMetrics] = useState([]);
  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [unitsError, setUnitsError] = useState('');
  const [storage, setStorage] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('overview');
  const [range, setRange] = useState(DEFAULT_RANGE);

  useEffect(() => {
    let active = true;
    api.get('/research/metrics').then((r) => { if (active) setMetrics(r.data); })
      .catch((e) => { if (active) setErr(e.response?.data?.message || 'Failed to load'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    api.get('/research/units').then((r) => { if (active) setUnits(r.data); })
      .catch((e) => { if (active) setUnitsError(e.response?.data?.message || t('ग्रीनहाउस सूची लोड भएन।', 'Could not load greenhouse units.')); })
      .finally(() => { if (active) setUnitsLoading(false); });
    return () => { active = false; };
  }, [t]);
  useEffect(() => {
    if (tab === 'export' && can('research.export')) api.get('/research/storage').then((r) => setStorage(r.data)).catch(() => {});
  }, [tab, can]);
  const mm = Object.fromEntries(metrics.map((m) => [m.key, m]));
  const common = { units, metrics, mm, range, lang, t };

  const tabs = [
    ['overview', '◉', t('ड्यासबोर्ड', 'Dashboard'), true], ['explore', '📈', t('समय शृङ्खला', 'Time series'), true], ['analyze', '🔬', t('तुलना', 'Compare'), true], ['experiments', '🧪', t('प्रयोग', 'Experiments'), true],
    ['devices', '📟', t('सेन्सर गुणस्तर', 'Sensor quality'), true], ['automation', '🤖', t('स्वचालन अध्ययन', 'Automation study'), true], ['export', '📤', t('निर्यात', 'Export'), can('research.export')]
  ].filter((x) => x[3]);
  const showRange = ['explore', 'analyze', 'export'].includes(tab);

  return (
    <div className="space-y-5 max-w-7xl">
      {tab !== 'overview' && (
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-lg shadow p-4 border-t-4 border-agri-green">
        <div>
          <h2 className="text-2xl font-bold text-gov-blue">🔬 {t('अनुसन्धान प्रयोगशाला', 'Research Lab')}</h2>
          <p className="text-sm text-gray-600">{t('ग्रीनहाउस सेन्सर तथ्याङ्कको विश्लेषण, प्रयोग र निर्यात', 'Analysis, experiments and export of greenhouse sensor data')}</p>
        </div>
        {showRange && <div className="flex flex-wrap items-end gap-3 text-sm">
          <><label>{t('देखि', 'From')}<input type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} className="block mt-1 border rounded p-2" /></label>
          <label>{t('सम्म', 'To')}<input type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} className="block mt-1 border rounded p-2" /></label></>
          <button onClick={() => window.print()} className="print:hidden border border-gov-blue text-gov-blue hover:bg-blue-50 px-3 py-2 rounded-md font-semibold">{t('प्रिन्ट / PDF', 'Print / PDF')}</button>
        </div>}
      </div>)}
      {tab === 'export' && storage && (
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
      {unitsError && <p role="status" className="p-3 bg-red-50 text-red-700 rounded text-sm">{unitsError}</p>}
      {unitsLoading && <p role="status" className="p-3 bg-slate-50 text-slate-600 rounded text-sm">{t('ग्रीनहाउस इकाई लोड हुँदैछन्…', 'Loading greenhouse units…')}</p>}
      {!unitsLoading && !unitsError && units.length === 0 && !err && <p className="p-3 bg-yellow-50 text-yellow-900 rounded text-sm">{t('अहिलेसम्म कुनै ग्रीनहाउस इकाई छैन।', 'No greenhouse units yet.')}</p>}
      <nav aria-label={t('अनुसन्धान खण्डहरू', 'Research sections')} className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {tabs.map(([k, icon, label]) => (
          <button type="button" key={k} onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined} className={`min-h-10 shrink-0 rounded-lg px-3 text-sm font-semibold whitespace-nowrap ${tab === k ? 'bg-emerald-950 text-white' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-950'}`}>{icon} {label}</button>
        ))}
      </nav>
      {tab === 'overview' && !unitsLoading && !unitsError && <ResearchOverview units={units} lang={lang} t={t} can={can} />}
      {tab === 'explore' && <ExploreTab {...common} />}
      {tab === 'analyze' && <AnalyzeTab {...common} />}
      {tab === 'experiments' && <ExperimentsTab {...common} can={can} />}
      {tab === 'devices' && <DeviceHealthTab {...common} can={can} />}
      {tab === 'automation' && <AutomationTab {...common} />}
      {tab === 'export' && <ResearchExportTab {...common} />}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardPlus } from 'lucide-react';
import api from '../../services/api';
import useLang from '../../utils/useLang';
import { useAuth } from '../../context/AuthContext';
import { fiscalYearOf } from '../../utils/dc';
import Overview from './Overview';
import LocalLevelsTab from './LocalLevelsTab';
import CropsTab from './CropsTab';
import LivestockInputsTab from './LivestockInputsTab';
import QualityTab from './QualityTab';
import MapTab from './MapTab';
import ImportTab from './ImportTab';
import ExportTab from './ExportTab';

export default function DataCenter() {
  const { lang, t } = useLang();
  const { can } = useAuth();
  const [fy, setFy] = useState(fiscalYearOf());
  const [ov, setOv] = useState(null);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState('');

  useEffect(() => {
    setOv(null);
    api.get('/datacenter/overview', { params: { fy } })
      .then((r) => { setOv(r.data); setError(''); })
      .catch((e) => setError(e.response?.data?.message || 'Failed to load'));
  }, [fy]);

  const years = Array.from(new Set([fiscalYearOf(), ...(ov ? ov.fiscal_years : [])])).sort().reverse();
  const tabs = [
    ['overview', '📊', t('सिंहावलोकन', 'Overview'), true],
    ['levels', '🏘️', t('स्थानीय तह / वडा', 'Local levels & wards'), true],
    ['map', '🗺️', t('नक्सा', 'Map'), true],
    ['crops', '🌾', t('बाली तथा उत्पादन', 'Crops & production'), true],
    ['livestock', '🐄', t('पशुपालन तथा सामग्री', 'Livestock & inputs'), true],
    ['quality', '✅', t('तथ्याङ्क गुणस्तर', 'Data quality'), true],
    ['import', '📥', t('आयात', 'Import'), can('datacenter.import')],
    ['export', '📤', t('निर्यात', 'Export'), can('datacenter.export')]
  ].filter((x) => x[3]);

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-lg shadow p-4 border-t-4 border-agri-green">
        <div>
          <h2 className="text-2xl font-bold text-gov-blue">🏛️ {t('कास्की कृषि डाटा केन्द्र', 'Kaski Agriculture Data Center')}</h2>
          <p className="text-sm text-gray-600">{t('कृषक, उत्पादन, पशुपालन, यन्त्र र तथ्याङ्क गुणस्तर — एकै ठाउँमा', 'Farmers, production, livestock, devices and data quality in one place')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {can('datacenter.collect') && (
            <Link to="/app/data-center/survey" className="flex items-center gap-2 bg-terrace-800 hover:bg-terrace-900 text-white px-4 py-2 rounded-md font-semibold text-sm"><ClipboardPlus size={16} aria-hidden="true" /> {t('क्षेत्रगत सर्वेक्षण', 'Field survey')}</Link>
          )}
          <label className="text-sm">{t('आर्थिक वर्ष', 'Fiscal year')}:{' '}
            <select value={fy} onChange={(e) => setFy(e.target.value)} className="border rounded p-2 bg-white">{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
          </label>
        </div>
      </div>
      {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map(([k, icon, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-agri-green text-agri-green' : 'border-transparent text-gray-600 hover:text-gov-blue'}`}>{icon} {label}</button>
        ))}
      </div>
      {tab === 'overview' && <Overview ov={ov} lang={lang} t={t} />}
      {tab === 'levels' && <LocalLevelsTab fy={fy} lang={lang} t={t} />}
      {tab === 'map' && <MapTab lang={lang} t={t} />}
      {tab === 'crops' && <CropsTab fy={fy} lang={lang} t={t} />}
      {tab === 'livestock' && <LivestockInputsTab fy={fy} lang={lang} t={t} />}
      {tab === 'quality' && <QualityTab lang={lang} t={t} />}
      {tab === 'import' && <ImportTab lang={lang} t={t} />}
      {tab === 'export' && <ExportTab fy={fy} lang={lang} t={t} />}
    </div>
  );
}

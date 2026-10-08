import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../../services/api';
import useLang from '../../../utils/useLang';
import { useAuth } from '../../../context/AuthContext';
import DynamicForm from '../../../components/dc/DynamicForm';
import RecordsPanel from '../../../components/dc/RecordsPanel';
import FarmsTab from '../../../components/dc/FarmsTab';
import DevicesTab from '../../../components/dc/DevicesTab';
import { PROFILE_FIELDS, PRODUCTION_FIELDS, LIVESTOCK_FIELDS, INPUT_FIELDS, ASSET_FIELDS } from '../../../utils/dcFields';
import { lbl } from '../../../utils/enumLabels';
import { formatLand, nf, val } from '../../../utils/dc';

const VCOLOR = { draft: 'bg-gray-100 text-gray-700', submitted: 'bg-blue-100 text-blue-800', verified: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800' };

const prodCols = [
  { ne: 'आ.व.', en: 'FY', r: (x) => x.fiscal_year }, { ne: 'फार्म', en: 'Farm', r: (x) => x.farm_name },
  { ne: 'बाली', en: 'Crop', r: (x, l) => (l === 'en' ? x.crop_en : x.crop_ne) }, { ne: 'मौसम', en: 'Season', r: (x, l) => lbl(x.season, l) },
  { ne: 'प्रणाली', en: 'System', r: (x, l) => lbl(x.production_system, l) }, { ne: 'क्षेत्रफल', en: 'Area', r: (x, l) => formatLand(x.area_sqm, l) },
  { ne: 'उत्पादन (के.जी.)', en: 'Production (kg)', r: (x) => val(x.production_kg) }, { ne: 'उत्पादकता (के.जी./हे.)', en: 'Yield (kg/ha)', r: (x) => val(x.yield_kg_ha, 0) },
  { ne: 'बिक्री (के.जी.)', en: 'Sold (kg)', r: (x) => val(x.sold_kg) }, { ne: 'मूल्य (रु./के.जी.)', en: 'Price (NPR/kg)', r: (x) => val(x.avg_price_npr_per_kg) }
];
const liveCols = [
  { ne: 'आ.व.', en: 'FY', r: (x) => x.fiscal_year }, { ne: 'फार्म', en: 'Farm', r: (x) => x.farm_name }, { ne: 'प्रकार', en: 'Type', r: (x, l) => lbl(x.animal_type, l) },
  { ne: 'संख्या', en: 'Count', r: (x) => x.head_count }, { ne: 'उद्देश्य', en: 'Purpose', r: (x, l) => (x.purpose ? lbl(x.purpose, l) : '—') },
  { ne: 'वार्षिक उत्पादन', en: 'Annual output', r: (x) => (x.annual_output_qty === null ? '—' : `${nf(x.annual_output_qty, 1)} ${x.output_unit || ''}`) }
];
const inputCols = [
  { ne: 'आ.व.', en: 'FY', r: (x) => x.fiscal_year }, { ne: 'फार्म', en: 'Farm', r: (x) => x.farm_name }, { ne: 'प्रकार', en: 'Type', r: (x, l) => lbl(x.input_type, l) },
  { ne: 'उत्पादन', en: 'Product', r: (x) => x.product_name || '—' }, { ne: 'बाली', en: 'Crop', r: (x, l) => (x.crop_en ? (l === 'en' ? x.crop_en : x.crop_ne) : '—') },
  { ne: 'परिमाण', en: 'Quantity', r: (x, l) => `${nf(x.quantity, 2)} ${lbl(x.unit, l)}` }, { ne: 'लागत (रु.)', en: 'Cost (NPR)', r: (x) => val(x.cost_npr) }
];
const assetCols = [
  { ne: 'फार्म', en: 'Farm', r: (x) => x.farm_name }, { ne: 'सम्पत्ति', en: 'Asset', r: (x, l) => lbl(x.asset_type, l) }, { ne: 'संख्या', en: 'Qty', r: (x) => x.quantity },
  { ne: 'क्षेत्रफल', en: 'Area', r: (x, l) => formatLand(x.area_sqm, l) }, { ne: 'वर्ष', en: 'Year', r: (x) => x.year_installed || '—' },
  { ne: 'अवस्था', en: 'Condition', r: (x, l) => (x.condition_status ? lbl(x.condition_status, l) : '—') }, { ne: 'सहयोग', en: 'Support', r: (x, l) => (x.support_source ? lbl(x.support_source, l) : '—') }
];

export default function FarmerRecord() {
  const { id } = useParams();
  const { lang, t } = useLang();
  const { can } = useAuth();
  const [data, setData] = useState(null);
  const [sum, setSum] = useState(null);
  const [error, setError] = useState('');
  const [crops, setCrops] = useState([]);
  const [levels, setLevels] = useState([]);
  const [tab, setTab] = useState('profile');
  const [msg, setMsg] = useState('');

  const reload = () => {
    api.get(`/farmers/${id}`).then((r) => setData(r.data)).catch((e) => setError(e.response?.data?.message || 'Failed to load'));
    api.get(`/farmers/${id}/summary`).then((r) => setSum(r.data)).catch(() => {});
  };
  useEffect(() => {
    reload();
    api.get('/lookups/crops').then((r) => setCrops(r.data)).catch(() => {});
    api.get('/lookups/local-levels').then((r) => setLevels(r.data)).catch(() => {});
  }, [id]);

  const setStatus = async (status) => {
    let note = '';
    if (status === 'rejected') {
      note = window.prompt(t('अस्वीकृत गर्ने कारण लेख्नुहोस्', 'Enter the reason for rejection')) || '';
      if (!note) return;
    }
    try { await api.post(`/farmers/${id}/verification`, { status, note }); setMsg(''); reload(); }
    catch (e) { setMsg(e.response?.data?.message || 'Failed'); }
  };

  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>;
  if (!data) return <p className="text-gray-500">…</p>;
  const f = data.farmer;
  const farms = data.farms;
  const lookups = { crops, levels, farms };
  const canCollect = can('datacenter.collect');
  const comp = sum ? sum.completeness : 0;
  const compColor = comp >= 90 ? 'bg-green-600' : comp >= 70 ? 'bg-lime-500' : comp >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  const tabs = [
    ['profile', t('प्रोफाइल', 'Profile')], ['farms', t('फार्महरू', 'Farms')], ['production', t('उत्पादन', 'Production')],
    ['livestock', t('पशुपालन / माछा / मौरी', 'Livestock & fish')], ['inputs', t('मल / विषादी / बिउ', 'Inputs')],
    ['assets', t('संरचना / उपकरण', 'Assets')], ['devices', t('आइओटी यन्त्र', 'IoT devices')]
  ];
  const panel = (kind, fields, columns) => (
    <RecordsPanel farmerId={id} farms={farms} kind={kind} fields={fields} columns={columns} lookups={lookups} canEdit={canCollect} lang={lang} t={t} onChanged={reload} />
  );

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="bg-white rounded-lg shadow p-4 border-t-4 border-agri-green">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/app/farmers" className="text-xs text-gov-blue underline">← {t('कृषक सूची', 'Farmers')}</Link>
            <h2 className="text-2xl font-bold text-gov-blue">{f.full_name_ne || f.full_name_en}</h2>
            <p className="text-sm text-gray-600">
              {f.farmer_code}{f.national_farmer_id ? ` · ${t('राष्ट्रिय ID', 'National ID')}: ${f.national_farmer_id}` : ''} · {lbl(f.farmer_type, lang)}{f.farmer_category ? ` · ${lbl(f.farmer_category, lang)}` : ''}
            </p>
            <p className="text-sm text-gray-600">{(lang === 'en' ? f.local_level_en : f.local_level_ne) || '—'}{f.ward_no ? ` - ${f.ward_no}` : ''} · {f.phone || '—'}</p>
          </div>
          <div className="text-right space-y-2">
            <span className={`inline-block px-3 py-1 rounded text-sm font-semibold ${VCOLOR[f.verification_status]}`}>{lbl(f.verification_status, lang)}</span>
            {f.verification_note && <p className="text-xs text-gray-500">{f.verification_note}</p>}
            <div className="flex gap-2 justify-end flex-wrap">
              {canCollect && f.verification_status !== 'submitted' && f.verification_status !== 'verified' && (
                <button onClick={() => setStatus('submitted')} className="px-3 py-1.5 border rounded text-sm">{t('प्रमाणीकरणका लागि पेश', 'Submit for verification')}</button>)}
              {can('datacenter.verify') && f.verification_status !== 'verified' && (
                <button onClick={() => setStatus('verified')} className="px-3 py-1.5 bg-agri-green text-white rounded text-sm">{t('प्रमाणित गर्नुहोस्', 'Verify')}</button>)}
              {can('datacenter.verify') && f.verification_status !== 'rejected' && (
                <button onClick={() => setStatus('rejected')} className="px-3 py-1.5 border border-gov-red text-gov-red rounded text-sm">{t('अस्वीकृत', 'Reject')}</button>)}
            </div>
            {msg && <p className="text-xs text-red-600">{msg}</p>}
          </div>
        </div>
        {sum && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 mb-1"><span>{t('तथ्याङ्क पूर्णता', 'Data completeness')}</span><span className="font-semibold">{comp}%</span></div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full ${compColor}`} style={{ width: `${comp}%` }} /></div>
            {sum.missing.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-xs text-gray-500">{t('अपुग', 'Missing')}:</span>
                {sum.missing.map((m) => <span key={m.key} className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-900 text-xs">{lang === 'en' ? m.en : m.ne}</span>)}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              {t('आ.व.', 'FY')} {sum.fiscal_year}: {nf(sum.production.kg, 1)} {t('के.जी. उत्पादन', 'kg produced')} · {sum.counts.farms} {t('फार्म', 'farms')} · {sum.counts.devices} {t('यन्त्र', 'devices')}
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-agri-green text-agri-green' : 'border-transparent text-gray-600 hover:text-gov-blue'}`}>{label}</button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow divide-y text-sm">
            {[[t('नाम (अंग्रेजी)', 'Name (English)'), f.full_name_en], [t('लिङ्ग', 'Gender'), f.gender ? lbl(f.gender, lang) : '—'], [t('ठेगाना', 'Address'), f.address || '—'],
              [t('समूह', 'Group'), f.group_name || '—'], [t('इमेल', 'Email'), f.email || '—']].map(([k, v]) => (
              <div key={k} className="flex p-3"><span className="w-44 font-medium text-gray-500">{k}</span><span>{v}</span></div>
            ))}
            {can('farmers.update') && <div className="p-3"><Link to={`/app/farmers/${id}/edit`} className="text-gov-blue underline text-sm">{t('आधारभूत विवरण सम्पादन गर्नुहोस्', 'Edit basic details')} →</Link></div>}
          </div>
          {canCollect
            ? <DynamicForm key={`${f.id}-${f.consent_recorded_at}-${f.updated_at}`} fields={PROFILE_FIELDS} initial={f} lang={lang} t={t}
                onSubmit={(v) => api.put(`/farmers/${id}/profile`, v).then((r) => { reload(); return r.data; })} />
            : <p className="text-sm text-gray-500">{t('विस्तृत प्रोफाइल सम्पादन गर्ने अनुमति छैन', 'You do not have permission to edit the extended profile')}</p>}
          {f.consent_recorded_at && <p className="text-xs text-gray-500">{t('सहमति अन्तिम पटक अद्यावधिक', 'Consent last recorded')}: {new Date(f.consent_recorded_at).toLocaleString()}</p>}
        </div>
      )}
      {tab === 'farms' && <FarmsTab farmerId={id} farms={farms} lookups={lookups} canEdit={canCollect} lang={lang} t={t} reload={reload} />}
      {tab === 'production' && panel('production', PRODUCTION_FIELDS, prodCols)}
      {tab === 'livestock' && panel('livestock', LIVESTOCK_FIELDS, liveCols)}
      {tab === 'inputs' && panel('inputs', INPUT_FIELDS, inputCols)}
      {tab === 'assets' && panel('assets', ASSET_FIELDS, assetCols)}
      {tab === 'devices' && <DevicesTab farmerId={id} farms={farms} canCreate={can('devices.create')} lang={lang} t={t} reload={reload} />}
    </div>
  );
}

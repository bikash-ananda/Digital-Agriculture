import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import api from '../../services/api';
import FormField, { inputCls } from '../common/FormField';
import { errMsgs } from '../../utils/errors';

const today = () => new Date().toLocaleDateString('en-CA');
const emptyObs = { obs_type: 'growth', plant_height_cm: '', leaf_count: '', ph_value: '', ec_value: '', yield_kg: '', pest_disease: '', severity: '', fertilizer: '', notes: '' };
const OBS_TYPES = { growth: ['वृद्धि', 'Growth'], pest_disease: ['रोग/कीरा', 'Pest/Disease'], nutrition: ['पोषण', 'Nutrition'], water: ['पानी', 'Water'], harvest: ['उत्पादन', 'Harvest'], note: ['टिप्पणी', 'Note'] };

export default function CropPanel({ unitId, analysis, can, onChanged, lang, t }) {
  const cycle = analysis ? analysis.cycle : null;
  const [crops, setCrops] = useState([]);
  const [form, setForm] = useState({ crop_id: '', variety: '', planted_on: today(), plant_count: '', expected_harvest_on: '', notes: '' });
  const [obs, setObs] = useState([]);
  const [of, setOf] = useState(emptyObs);
  const [errs, setErrs] = useState([]);
  const [ok, setOk] = useState('');

  useEffect(() => { api.get('/lookups/crops').then((r) => setCrops(r.data)).catch(() => {}); }, []);
  const loadObs = () => (cycle ? api.get(`/smart/cycles/${cycle.id}/observations`).then((r) => setObs(r.data)).catch(() => setObs([])) : setObs([]));
  useEffect(() => { loadObs(); }, [cycle && cycle.id]);

  const createCycle = async (e) => {
    e.preventDefault(); setErrs([]);
    try { await api.post(`/smart/units/${unitId}/cycles`, form); onChanged(); }
    catch (err) { setErrs(errMsgs(err)); }
  };
  const closeCycle = async (status) => {
    if (!window.confirm(t('बाली चक्र बन्द गर्ने?', 'Close this crop cycle?'))) return;
    try { await api.put(`/smart/cycles/${cycle.id}`, { status }); onChanged(); }
    catch (err) { setErrs(errMsgs(err)); }
  };
  const addObs = async (e) => {
    e.preventDefault(); setErrs([]); setOk('');
    try { await api.post(`/smart/cycles/${cycle.id}/observations`, of); setOf(emptyObs); setOk(t('अवलोकन सुरक्षित भयो', 'Observation saved')); loadObs(); onChanged(); }
    catch (err) { setErrs(errMsgs(err)); }
  };
  const so = (k) => (e) => setOf({ ...of, [k]: e.target.value });
  const sf = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const growth = obs.filter((o) => o.plant_height_cm !== null).slice().reverse().map((o) => ({ d: new Date(o.observed_at).toLocaleDateString(), h: Number(o.plant_height_cm) }));

  const errorMessage = errs.length > 0 && <ul className="mb-3 p-3 bg-red-50 text-red-700 rounded text-sm list-disc pl-6">{errs.map((x, i) => <li key={i}>{x}</li>)}</ul>;

  if (!analysis) return <p className="text-gray-500">{t('विश्लेषण उपलब्ध छैन', 'Analysis not available')}</p>;

  if (!cycle) {
    return (
      <div className="bg-white rounded-lg shadow p-5 max-w-3xl">
        <h3 className="font-semibold text-gov-blue mb-1">🌱 {t('नयाँ बाली चक्र दर्ता', 'Register a crop cycle')}</h3>
        <p className="text-sm text-gray-600 mb-4">{t('बाली दर्ता गरेपछि बिरुवाको विवरण, चरण र लक्ष्य दायरा स्वतः लागू हुन्छ।', 'Once registered, the plant description, growth stage and target ranges apply automatically.')}</p>
        {errorMessage}
        {!can('crop_cycles.create') ? <p className="text-sm text-gray-500">{t('तपाईंलाई अनुमति छैन', 'You do not have permission')}</p> : (
          <form onSubmit={createCycle} className="grid sm:grid-cols-2 gap-3">
            <FormField label={`${t('बाली', 'Crop')} *`}>
              <select required value={form.crop_id} onChange={sf('crop_id')} className={inputCls}>
                <option value="">-</option>
                {crops.map((c) => <option key={c.id} value={c.id}>{lang === 'en' ? c.name_en : c.name_ne}</option>)}
              </select>
            </FormField>
            <FormField label={t('जात', 'Variety')}><input value={form.variety} onChange={sf('variety')} className={inputCls} /></FormField>
            <FormField label={`${t('रोपेको मिति', 'Planting date')} *`}><input required type="date" value={form.planted_on} onChange={sf('planted_on')} className={inputCls} /></FormField>
            <FormField label={t('बिरुवा संख्या', 'Plant count')}><input type="number" min="1" value={form.plant_count} onChange={sf('plant_count')} className={inputCls} /></FormField>
            <FormField label={t('अनुमानित टिप्ने मिति', 'Expected harvest')}><input type="date" value={form.expected_harvest_on} onChange={sf('expected_harvest_on')} className={inputCls} /></FormField>
            <FormField label={t('टिप्पणी', 'Notes')}><input value={form.notes} onChange={sf('notes')} className={inputCls} /></FormField>
            <div className="sm:col-span-2"><button className="bg-agri-green text-white px-4 py-2 rounded text-sm font-semibold">{t('दर्ता गर्नुहोस्', 'Register')}</button></div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">{cycle.batch_code}</p>
          <p className="text-lg font-semibold text-gov-blue">{lang === 'en' ? cycle.crop_en : cycle.crop_ne}{cycle.variety ? ` — ${cycle.variety}` : ''}</p>
          <p className="text-sm text-gray-600">{t('रोपेको', 'Planted')}: {cycle.planted_on} · {t('दिन', 'Day')} {cycle.days_since}{cycle.plant_count ? ` · ${cycle.plant_count} ${t('बिरुवा', 'plants')}` : ''}{cycle.expected_harvest_on ? ` · ${t('टिप्ने', 'harvest')}: ${cycle.expected_harvest_on}` : ''}</p>
        </div>
        {can('crop_cycles.update') && (
          <div className="flex gap-2">
            <button onClick={() => closeCycle('harvested')} className="px-3 py-1.5 border rounded text-sm">{t('टिपियो / सकियो', 'Mark harvested')}</button>
            <button onClick={() => closeCycle('failed')} className="px-3 py-1.5 border border-gov-red text-gov-red rounded text-sm">{t('असफल', 'Failed')}</button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {can('observations.create') && (
          <form onSubmit={addObs} className="bg-white rounded-lg shadow p-4 grid grid-cols-2 gap-3">
            <h3 className="col-span-2 font-semibold text-gov-blue">✍️ {t('हातले अवलोकन थप्नुहोस्', 'Add manual observation')}</h3>
            <div className="col-span-2">{errorMessage}{ok && <p className="mb-2 p-2 bg-green-50 text-green-700 rounded text-sm">{ok}</p>}</div>
            <FormField label={t('प्रकार', 'Type')} className="col-span-2">
              <select value={of.obs_type} onChange={so('obs_type')} className={inputCls}>
                {Object.entries(OBS_TYPES).map(([k, v]) => <option key={k} value={k}>{lang === 'en' ? v[1] : v[0]}</option>)}
              </select>
            </FormField>
            <FormField label={t('उचाइ (से.मि.)', 'Height (cm)')}><input type="number" step="0.1" value={of.plant_height_cm} onChange={so('plant_height_cm')} className={inputCls} /></FormField>
            <FormField label={t('पात संख्या', 'Leaf count')}><input type="number" value={of.leaf_count} onChange={so('leaf_count')} className={inputCls} /></FormField>
            <FormField label="pH"><input type="number" step="0.01" value={of.ph_value} onChange={so('ph_value')} className={inputCls} /></FormField>
            <FormField label="EC (mS/cm)"><input type="number" step="0.01" value={of.ec_value} onChange={so('ec_value')} className={inputCls} /></FormField>
            <FormField label={t('उत्पादन (के.जी.)', 'Yield (kg)')}><input type="number" step="0.01" value={of.yield_kg} onChange={so('yield_kg')} className={inputCls} /></FormField>
            <FormField label={t('मल', 'Fertilizer')}><input value={of.fertilizer} onChange={so('fertilizer')} className={inputCls} /></FormField>
            <FormField label={t('रोग / कीरा', 'Pest / disease')}><input value={of.pest_disease} onChange={so('pest_disease')} className={inputCls} /></FormField>
            <FormField label={t('गम्भीरता', 'Severity')}>
              <select value={of.severity} onChange={so('severity')} className={inputCls}>
                <option value="">-</option>{['none', 'low', 'medium', 'high'].map((x) => <option key={x}>{x}</option>)}
              </select>
            </FormField>
            <FormField label={t('टिप्पणी', 'Notes')} className="col-span-2"><input value={of.notes} onChange={so('notes')} className={inputCls} /></FormField>
            <div className="col-span-2"><button className="bg-agri-green text-white px-4 py-2 rounded text-sm font-semibold">{t('सुरक्षित गर्नुहोस्', 'Save')}</button></div>
          </form>
        )}

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-gov-blue mb-2">📈 {t('बिरुवाको उचाइ', 'Plant height over time')}</h3>
          {growth.length < 2 ? <p className="text-sm text-gray-500 py-10 text-center">{t('कम्तीमा दुई अवलोकन चाहिन्छ', 'Needs at least two height observations')}</p> : (
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={growth}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="d" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} width={40} /><Tooltip />
                  <Line type="monotone" dataKey="h" name="cm" stroke="#15803d" strokeWidth={2.5} /></LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left"><tr>
            {[t('मिति', 'Date'), t('प्रकार', 'Type'), t('उचाइ', 'Height'), t('पात', 'Leaves'), 'pH', 'EC', t('उत्पादन', 'Yield'), t('रोग/कीरा', 'Pest/Disease'), t('टिप्पणी', 'Notes'), t('दर्ता गर्ने', 'By')].map((h, i) => <th key={i} className="p-3 whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {obs.length === 0 && <tr><td colSpan="10" className="p-4 text-center text-gray-500">{t('अवलोकन छैन', 'No observations yet')}</td></tr>}
            {obs.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-3 whitespace-nowrap">{new Date(o.observed_at).toLocaleDateString()}</td>
                <td className="p-3">{OBS_TYPES[o.obs_type] ? OBS_TYPES[o.obs_type][lang === 'en' ? 1 : 0] : o.obs_type}</td>
                <td className="p-3">{o.plant_height_cm ?? '-'}</td><td className="p-3">{o.leaf_count ?? '-'}</td><td className="p-3">{o.ph_value ?? '-'}</td><td className="p-3">{o.ec_value ?? '-'}</td>
                <td className="p-3">{o.yield_kg ?? '-'}</td><td className="p-3">{o.pest_disease ? `${o.pest_disease}${o.severity ? ` (${o.severity})` : ''}` : '-'}</td>
                <td className="p-3">{o.notes || '-'}</td><td className="p-3">{o.observer || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

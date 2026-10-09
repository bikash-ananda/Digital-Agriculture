import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import api from '../../services/api';
import UnitPicker from '../../components/research/UnitPicker';
import { Caveats, f, fmtP, mname } from '../../components/research/helpers';
import { errMsgs } from '../../utils/errors';

const COLORS = ['#15803d', '#2563eb', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];
const testLine = (x, t) => (!x ? t('परीक्षणका लागि पर्याप्त तथ्याङ्क छैन', 'Not enough data for a test')
  : x.test === 'welch_t' ? `Welch t = ${f(x.t)}, df = ${f(x.df, 1)}, p = ${fmtP(x.p)}; Δ = ${f(x.mean_diff)} (95% CI ${f(x.ci95[0])} … ${f(x.ci95[1])}); d = ${f(x.cohens_d)}`
    : `ANOVA F(${x.df1}, ${x.df2}) = ${f(x.F)}, p = ${fmtP(x.p)}, η² = ${f(x.eta2, 3)}`);

export default function ExperimentsTab({ units, metrics, mm, lang, t, can }) {
  const [list, setList] = useState([]);
  const [view, setView] = useState('list');
  const [an, setAn] = useState(null);
  const [errs, setErrs] = useState([]);
  const today = new Date().toLocaleDateString('en-CA');
  const [form, setForm] = useState({ title: '', hypothesis: '', metric: 'soil_moisture_avg', start_date: today, end_date: today, groups: [{ name: 'Control', description: '', unit_ids: [] }, { name: 'Treatment', description: '', unit_ids: [] }] });

  const load = () => api.get('/research/experiments').then((r) => setList(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  const open = async (id) => { setErrs([]); try { const r = await api.get(`/research/experiments/${id}/analysis`); setAn(r.data); setView('detail'); } catch (e) { setErrs(errMsgs(e)); } };
  const setGroup = (i, k, v) => setForm({ ...form, groups: form.groups.map((g, j) => (j === i ? { ...g, [k]: v } : g)) });
  const taken = (i) => form.groups.flatMap((g, j) => (j === i ? [] : g.unit_ids));
  const create = async (e) => {
    e.preventDefault(); setErrs([]);
    try { await api.post('/research/experiments', { ...form, status: 'running' }); setView('list'); load(); }
    catch (err) { setErrs(errMsgs(err)); }
  };
  const setStatus = async (id, status) => { try { await api.put(`/research/experiments/${id}/status`, { status }); load(); if (an) open(id); } catch (e) { setErrs(errMsgs(e)); } };

  if (view === 'new') {
    return (
      <form onSubmit={create} className="bg-white rounded-lg shadow p-5 space-y-4 max-w-4xl">
        <h3 className="font-semibold text-gov-blue text-lg">{t('नयाँ प्रयोग', 'New experiment')}</h3>
        {errs.length > 0 && <ul className="p-3 bg-red-50 text-red-700 rounded text-sm list-disc pl-6">{errs.map((x, i) => <li key={i}>{x}</li>)}</ul>}
        <label className="block text-sm">{t('शीर्षक', 'Title')} *<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
        <label className="block text-sm">{t('परिकल्पना (परिणाम हेर्नुअघि लेख्नुहोस्)', 'Hypothesis (write it before looking at results)')}<textarea value={form.hypothesis} onChange={(e) => setForm({ ...form, hypothesis: e.target.value })} rows={2} className="mt-1 w-full border rounded p-2" /></label>
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <label>{t('मुख्य मापक', 'Primary metric')} *<select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} className="mt-1 w-full border rounded p-2 bg-white">{metrics.map((m) => <option key={m.key} value={m.key}>{lang === 'en' ? m.en : m.ne}</option>)}</select></label>
          <label>{t('सुरु', 'Start')} *<input type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
          <label>{t('अन्त्य', 'End')} *<input type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
        </div>
        <div className="space-y-4">
          {form.groups.map((g, i) => (
            <div key={i} className="border rounded p-3 space-y-2">
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <label>{t('समूहको नाम', 'Group name')} *<input required value={g.name} onChange={(e) => setGroup(i, 'name', e.target.value)} className="mt-1 w-full border rounded p-2" /></label>
                <label>{t('उपचार / विवरण', 'Treatment / description')}<input value={g.description} onChange={(e) => setGroup(i, 'description', e.target.value)} className="mt-1 w-full border rounded p-2" /></label>
              </div>
              <UnitPicker units={units} value={g.unit_ids} onChange={(v) => setGroup(i, 'unit_ids', v)} lang={lang} disabled={taken(i)} />
              {form.groups.length > 2 && <button type="button" onClick={() => setForm({ ...form, groups: form.groups.filter((_, j) => j !== i) })} className="text-gov-red text-xs underline">{t('समूह हटाउनुहोस्', 'Remove group')}</button>}
            </div>
          ))}
          {form.groups.length < 6 && <button type="button" onClick={() => setForm({ ...form, groups: [...form.groups, { name: `Group ${form.groups.length + 1}`, description: '', unit_ids: [] }] })} className="border px-3 py-1.5 rounded text-sm">+ {t('समूह थप्नुहोस्', 'Add group')}</button>}
        </div>
        <p className="text-xs text-gray-500">{t('वैध तुलनाका लागि प्रत्येक समूहमा कम्तीमा २ ग्रीनहाउस राख्नुहोस्।', 'For a valid comparison, put at least 2 greenhouses in every group.')}</p>
        <div className="flex gap-3"><button className="bg-agri-green text-white px-5 py-2 rounded font-semibold">{t('प्रयोग सुरु गर्नुहोस्', 'Start experiment')}</button><button type="button" onClick={() => setView('list')} className="px-4 py-2 border rounded">{t('रद्द', 'Cancel')}</button></div>
      </form>
    );
  }

  if (view === 'detail' && an) {
    const e = an.experiment;
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => { setView('list'); setAn(null); }} className="text-sm text-gov-blue underline">← {t('प्रयोग सूची', 'Experiments')}</button>
          {can('research.manage') && e.status === 'running' && <button onClick={() => setStatus(e.id, 'completed')} className="ml-auto border px-3 py-1.5 rounded text-sm">{t('सम्पन्न चिन्ह लगाउनुहोस्', 'Mark completed')}</button>}
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">{e.code} · {e.status} · {e.start_date} → {e.end_date}</p>
          <h3 className="text-xl font-bold text-terrace-900">{e.title}</h3>
          {e.hypothesis && <p className="mt-1 text-sm text-gray-700">{e.hypothesis}</p>}
          <p className="mt-2 text-sm">{t('मुख्य मापक', 'Primary metric')}: <b>{mname(mm, an.metric.key, lang)}</b> ({an.metric.unit})</p>
        </div>
        {errs.length > 0 && <ul className="p-3 bg-red-50 text-red-700 rounded text-sm list-disc pl-6">{errs.map((x, i) => <li key={i}>{x}</li>)}</ul>}
        <div className="bg-white rounded-lg shadow p-4">
          <h4 className="font-semibold text-gov-blue mb-2">{t('समूह अनुसार दैनिक औसत', 'Daily mean by group')}</h4>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={an.series}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="day" tick={{ fontSize: 11 }} /><YAxis width={48} tick={{ fontSize: 12 }} /><Tooltip /><Legend />
                {an.groups.map((g, i) => <Line key={g.group_id} type="monotone" dataKey={`g${g.group_id}`} name={g.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={false} connectNulls />)}</LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left"><tr><th className="p-3">{t('समूह', 'Group')}</th><th className="p-3">{t('ग्रीनहाउस (डाटा सहित)', 'Greenhouses (with data)')}</th><th className="p-3">{t('दिनका मान', 'Daily values')}</th><th className="p-3">{t('औसत', 'Mean')}</th><th className="p-3">SD</th></tr></thead>
            <tbody>{an.groups.map((g) => <tr key={g.group_id} className="border-t"><td className="p-3 font-medium">{g.name}</td><td className="p-3">{g.n_units} ({g.n_units_with_data})</td><td className="p-3">{g.n_days_values}</td><td className="p-3">{f(g.mean)}</td><td className="p-3">{f(g.sd)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="grid lg:grid-cols-2 gap-5">
          <div className={`rounded-lg p-4 text-sm border ${an.replicated ? 'bg-terrace-50 border-agri-green' : 'bg-gray-50'}`}>
            <p className="font-semibold">{t('मुख्य परीक्षण (ग्रीनहाउस स्तर)', 'Primary test (greenhouse level)')}</p>
            <p className="mt-1">{an.replicated ? testLine(an.primary, t) : t('उपलब्ध छैन — प्रत्येक समूहमा कम्तीमा २ ग्रीनहाउस चाहिन्छ।', 'Not available — every group needs at least 2 greenhouses with data.')}</p>
          </div>
          <div className="rounded-lg p-4 text-sm border bg-yellow-50 border-yellow-200">
            <p className="font-semibold">{t('अन्वेषणात्मक परीक्षण (दैनिक मान)', 'Exploratory test (daily values)')}</p>
            <p className="mt-1">{testLine(an.exploratory, t)}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-sm">
          <p className="font-semibold text-gov-blue mb-1">{t('उत्पादकता (किलो/हे.)', 'Yield (kg/ha)')}</p>
          <ul className="list-disc pl-5">{an.yield.groups.map((g) => <li key={g.group_id}>{g.name}: n = {g.n}, {t('औसत', 'mean')} {f(g.mean, 0)}</li>)}</ul>
          <p className="mt-1">{testLine(an.yield.test, t)}</p>
          <p className="text-xs text-gray-500 mt-1">{an.yield.note}</p>
        </div>
        <Caveats list={an.caveats} t={t} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {can('research.manage') && <button onClick={() => { setErrs([]); setView('new'); }} className="bg-agri-green text-white px-4 py-2 rounded font-semibold text-sm">+ {t('नयाँ प्रयोग', 'New experiment')}</button>}
      {errs.length > 0 && <ul className="p-3 bg-red-50 text-red-700 rounded text-sm list-disc pl-6">{errs.map((x, i) => <li key={i}>{x}</li>)}</ul>}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left"><tr><th className="p-3">{t('कोड', 'Code')}</th><th className="p-3">{t('शीर्षक', 'Title')}</th><th className="p-3">{t('मापक', 'Metric')}</th><th className="p-3">{t('अवधि', 'Dates')}</th><th className="p-3">{t('समूह / इकाई', 'Groups / units')}</th><th className="p-3">{t('अवस्था', 'Status')}</th><th className="p-3" /></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan="7" className="p-4 text-center text-gray-500">{t('कुनै प्रयोग छैन', 'No experiments yet')}</td></tr>}
            {list.map((x) => (
              <tr key={x.id} className="border-t"><td className="p-3 whitespace-nowrap">{x.code}</td><td className="p-3 font-medium">{x.title}</td><td className="p-3">{mname(mm, x.metric, lang)}</td><td className="p-3 whitespace-nowrap">{x.start_date} → {x.end_date}</td>
                <td className="p-3">{x.group_count} / {x.units}</td><td className="p-3">{x.status}</td><td className="p-3"><button onClick={() => open(x.id)} className="text-gov-blue underline">{t('विश्लेषण', 'Analysis')}</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

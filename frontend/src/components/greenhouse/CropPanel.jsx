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
  const [tasks, setTasks] = useState([]);
  const [taskForm, setTaskForm] = useState({ title: '', due_on: '', priority: 'normal', notes: '' });
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [taskOk, setTaskOk] = useState('');
  const [taskSavingId, setTaskSavingId] = useState(null);
  const [of, setOf] = useState(emptyObs);
  const [errs, setErrs] = useState([]);
  const [ok, setOk] = useState('');

  useEffect(() => { api.get('/lookups/crops').then((r) => setCrops(r.data)).catch(() => {}); }, []);
  const loadObs = async (cycleId = cycle?.id) => {
    if (!cycleId) return;
    try { const response = await api.get(`/smart/cycles/${cycleId}/observations`); setObs(response.data); }
    catch { setObs([]); }
  };
  useEffect(() => {
    const cycleId = cycle?.id;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!cycleId) { setObs([]); return; }
      api.get(`/smart/cycles/${cycleId}/observations`).then((response) => {
        if (active) setObs(response.data);
      }).catch(() => { if (active) setObs([]); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [cycle?.id]);
  const loadTasks = async (cycleId = cycle?.id) => {
    if (!cycleId) return;
    try { const response = await api.get(`/smart/cycles/${cycleId}/tasks`); setTasks(response.data); setTaskError(''); }
    catch (error) { setTaskError(errMsgs(error)[0]); }
  };
  useEffect(() => {
    if (!cycle?.id) {
      const clear = window.setTimeout(() => setTasks([]), 0);
      return () => window.clearTimeout(clear);
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setTaskLoading(true);
      api.get(`/smart/cycles/${cycle.id}/tasks`).then((response) => {
        if (active) { setTasks(response.data); setTaskError(''); }
      }).catch((error) => {
        if (active) setTaskError(errMsgs(error)[0]);
      }).finally(() => { if (active) setTaskLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [cycle?.id]);

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
    try { await api.post(`/smart/cycles/${cycle.id}/observations`, of); setOf(emptyObs); setOk(t('अवलोकन सुरक्षित भयो', 'Observation saved')); await loadObs(cycle.id); onChanged(); }
    catch (err) { setErrs(errMsgs(err)); }
  };
  const addTask = async (e) => {
    e.preventDefault(); setTaskError(''); setTaskOk('');
    try {
      await api.post(`/smart/cycles/${cycle.id}/tasks`, taskForm);
      setTaskForm({ title: '', due_on: '', priority: 'normal', notes: '' });
      setTaskOk(t('काम थपियो', 'Task added'));
      await loadTasks(cycle.id);
    } catch (err) { setTaskError(errMsgs(err)[0]); }
  };
  const updateTask = async (task, status) => {
    setTaskSavingId(task.id); setTaskError('');
    try { await api.put(`/smart/tasks/${task.id}`, { status }); await loadTasks(cycle.id); }
    catch (err) { setTaskError(errMsgs(err)[0]); }
    finally { setTaskSavingId(null); }
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

      <section aria-labelledby="crop-tasks-title" className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 id="crop-tasks-title" className="font-semibold text-gov-blue">✅ {t('बालीका कामहरू', 'Crop tasks')}</h3><p className="mt-1 text-xs text-slate-600">{t('तपाईंले तय गरेका काम र मितिहरू। स्वचालित सिफारिस होइन।', 'Tasks and dates entered by your team; no automatic schedule is assumed.')}</p></div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">{tasks.filter((task) => task.status === 'done').length}/{tasks.length} {t('पूरा', 'done')}</span>
        </div>
        {taskError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{taskError}</p>}
        {taskOk && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{taskOk}</p>}
        {taskLoading ? <p role="status" className="mt-3 text-sm text-slate-500">{t('कामहरू लोड हुँदैछन्…', 'Loading tasks…')}</p>
          : tasks.length === 0 ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{t('अहिलेसम्म कुनै काम दर्ता छैन।', 'No tasks recorded for this crop cycle yet.')}</p>
            : <ul className="mt-3 divide-y divide-slate-100">{tasks.map((task) => {
              const overdue = task.status === 'open' && task.due_on && String(task.due_on).slice(0, 10) < today();
              const nextStatus = task.status === 'open' ? 'done' : 'open';
              return <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-start gap-3"><span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${task.status === 'done' ? 'bg-emerald-100 text-emerald-900' : task.status === 'skipped' ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-950'}`}>{task.status === 'done' ? '✓' : task.status === 'skipped' ? '–' : '!'}</span><div className="min-w-0"><p className={`font-medium ${task.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{task.title}</p>{task.notes && <p className="mt-0.5 text-sm text-slate-600">{task.notes}</p>}<p className={`mt-1 text-xs ${overdue ? 'font-semibold text-rose-800' : 'text-slate-500'}`}>{task.due_on ? `${t('Хुने मिति', 'Due')} · ${String(task.due_on).slice(0, 10)}` : t('मिति तोकिएको छैन', 'No due date')}{overdue ? ` · ${t('बाँकी', 'overdue')}` : ''} · {t('प्राथमिकता', 'priority')}: {task.priority}</p></div></div>
                {can('crop_cycles.update') && <button type="button" disabled={taskSavingId === task.id} onClick={() => updateTask(task, nextStatus)} className="min-h-10 shrink-0 rounded-lg border border-emerald-800 px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50">{task.status === 'done' ? t('फेरि खोल्नुहोस्', 'Reopen') : t('पूरा भयो', 'Mark done')}</button>}
              </li>;
            })}</ul>}
        {can('crop_cycles.update') && <form onSubmit={addTask} className="mt-3 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label={`${t('काम', 'Task')} *`} className="sm:col-span-2"><input required maxLength="200" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} className={inputCls} placeholder={t('जस्तै: ग्रीनहाउस जाँच गर्नुहोस्', 'e.g. Inspect greenhouse')} /></FormField>
          <FormField label={t('हुनुपर्ने मिति', 'Due date')}><input type="date" value={taskForm.due_on} onChange={(e) => setTaskForm({ ...taskForm, due_on: e.target.value })} className={inputCls} /></FormField>
          <FormField label={t('प्राथमिकता', 'Priority')}><select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })} className={inputCls}>{[['low', t('कम', 'Low')], ['normal', t('सामान्य', 'Normal')], ['high', t('उच्च', 'High')]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
          <FormField label={t('टिप्पणी', 'Notes')} className="sm:col-span-2 lg:col-span-3"><input maxLength="2000" value={taskForm.notes} onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })} className={inputCls} /></FormField>
          <div className="self-end"><button className="min-h-10 rounded-lg bg-agri-green px-4 text-sm font-semibold text-white">+ {t('काम थप्नुहोस्', 'Add task')}</button></div>
        </form>}
      </section>

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

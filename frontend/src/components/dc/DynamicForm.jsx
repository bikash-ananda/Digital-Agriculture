import { useState } from 'react';
import FormField, { inputCls } from '../common/FormField';
import LandInput from './LandInput';
import { lbl } from '../../utils/enumLabels';
import { errMsgs } from '../../utils/errors';

export default function DynamicForm({ fields, initial = {}, onSubmit, submitLabel, lookups = {}, lang, t, resetOnSuccess = false }) {
  const blank = () => Object.fromEntries(fields.map((f) => {
    const x = initial[f.k];
    if (f.type === 'checkbox') return [f.k, x === undefined ? !!f.def : !!x];
    if (x === null || x === undefined) return [f.k, f.def ?? ''];
    return [f.k, f.type === 'date' ? String(x).slice(0, 10) : x];
  }));
  const [v, setV] = useState(blank);
  const [errs, setErrs] = useState([]);
  const [warn, setWarn] = useState([]);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rk, setRk] = useState(0);
  const set = (k, x) => setV((p) => ({ ...p, [k]: x }));
  const label = (f) => `${lang === 'en' ? f.en : f.ne}${f.req ? ' *' : ''}`;

  const submit = async (e) => {
    e.preventDefault();
    setErrs([]); setWarn([]); setOk(false); setBusy(true);
    try {
      const out = await onSubmit(v);
      if (out && out.warnings) setWarn(out.warnings);
      setOk(true);
      if (resetOnSuccess) { setV(blank()); setRk((x) => x + 1); }
    } catch (err) { setErrs(errMsgs(err)); } finally { setBusy(false); }
  };

  const control = (f) => {
    if (f.type === 'select') {
      return (
        <select value={v[f.k]} onChange={(e) => set(f.k, e.target.value)} required={f.req} className={inputCls}>
          <option value="">-</option>
          {f.options.map((o) => <option key={o} value={o}>{lbl(o, lang)}</option>)}
        </select>
      );
    }
    if (f.type === 'crop' || f.type === 'level' || f.type === 'farm') {
      const list = f.type === 'crop' ? (lookups.crops || []) : f.type === 'level' ? (lookups.levels || []) : (lookups.farms || []);
      return (
        <select value={v[f.k]} onChange={(e) => set(f.k, e.target.value)} required={f.req} className={inputCls}>
          <option value="">-</option>
          {list.map((o) => <option key={o.id} value={o.id}>{f.type === 'farm' ? o.name : (lang === 'en' ? o.name_en : o.name_ne)}</option>)}
        </select>
      );
    }
    return <input type={f.type || 'text'} value={v[f.k]} min={f.min} max={f.max} step={f.step} required={f.req} onChange={(e) => set(f.k, e.target.value)} className={inputCls} />;
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-lg shadow p-4">
      {errs.length > 0 && <ul role="alert" className="mb-3 p-3 bg-red-50 text-red-700 rounded text-sm list-disc pl-6">{errs.map((x, i) => <li key={i}>{x}</li>)}</ul>}
      {warn.length > 0 && <ul className="mb-3 p-3 bg-yellow-50 text-yellow-900 rounded text-sm list-disc pl-6">{warn.map((x, i) => <li key={i}>⚠ {x}</li>)}</ul>}
      {ok && errs.length === 0 && <p className="mb-3 p-2 bg-green-50 text-green-700 rounded text-sm">✓ {t('सुरक्षित भयो', 'Saved')}</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {fields.filter((f) => !f.showIf || f.showIf(v)).map((f) => {
          if (f.type === 'checkbox') {
            return (
              <label key={f.k} className={`flex items-start gap-2 text-sm ${f.wide ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
                <input type="checkbox" checked={!!v[f.k]} onChange={(e) => set(f.k, e.target.checked)} className="mt-1" /> <span>{label(f)}</span>
              </label>
            );
          }
          if (f.type === 'land') {
            return (
              <div key={f.k} className="text-sm sm:col-span-2">
                <span className="font-medium">{label(f)}</span>
                <LandInput key={`${f.k}-${rk}`} value={v[f.k]} onChange={(x) => set(f.k, x)} lang={lang} />
              </div>
            );
          }
          return <FormField key={f.k} label={label(f)} className={f.wide ? 'sm:col-span-2 lg:col-span-3' : ''}>{control(f)}</FormField>;
        })}
      </div>
      <button disabled={busy} className="mt-4 bg-agri-green hover:bg-green-800 text-white px-5 py-2 rounded text-sm font-semibold disabled:opacity-60">{submitLabel || t('सुरक्षित गर्नुहोस्', 'Save')}</button>
    </form>
  );
}

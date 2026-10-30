import { useEffect, useState } from 'react';
import { Save, Plus, Trash2, RotateCcw } from 'lucide-react';
import api from '../../services/api';
import useLang from '../../utils/useLang';
import { errMsgs } from '../../utils/errors';
import { getDefaults, applyContent, resetKey, loadSiteContent } from '../../data/siteContent';
import { office, officers, staff, usefulLinks } from '../../data/office';

const clone = (v) => JSON.parse(JSON.stringify(v));
const input = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terrace-800 focus:outline-none';
const btn = 'inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold';

function Field({ label, children }) { return <label className="block"><span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>{children}</label>; }
function Text({ label, value, onChange, ...p }) { return <Field label={label}><input className={input} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...p} /></Field>; }
function Area({ label, value, onChange, rows = 3 }) { return <Field label={label}><textarea rows={rows} className={input} value={value ?? ''} onChange={(e) => onChange(e.target.value)} /></Field>; }
const toLines = (a) => (a || []).join('\n');
const fromLines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);

function Bi({ label, value, onChange }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <Text label={`${label} (नेपाली)`} value={value?.ne} onChange={(v) => onChange({ ...value, ne: v })} />
    <Text label={`${label} (English)`} value={value?.en} onChange={(v) => onChange({ ...value, en: v })} />
  </div>;
}
function BiLines({ label, value, onChange, rows = 4 }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <Area rows={rows} label={`${label} (नेपाली) – one per line`} value={toLines(value?.ne)} onChange={(v) => onChange({ ...value, ne: fromLines(v) })} />
    <Area rows={rows} label={`${label} (English) – one per line`} value={toLines(value?.en)} onChange={(v) => onChange({ ...value, en: fromLines(v) })} />
  </div>;
}
function Pairs({ label, value = [], onChange }) {
  const set = (i, j, v) => onChange(value.map((p, k) => (k === i ? p.map((x, m) => (m === j ? v : x)) : p)));
  return <div><p className="mb-2 text-sm font-semibold text-gray-800">{label}</p>
    {value.map((p, i) => <div key={i} className="mb-2 grid gap-2 rounded-md border border-gray-200 p-3 sm:grid-cols-[1fr_2fr_auto]">
      <input aria-label="Heading" className={input} value={p[0]} onChange={(e) => set(i, 0, e.target.value)} placeholder="Heading" />
      <input aria-label="Description" className={input} value={p[1]} onChange={(e) => set(i, 1, e.target.value)} placeholder="Description" />
      <button type="button" aria-label="Remove" onClick={() => onChange(value.filter((_, k) => k !== i))} className="text-red-700"><Trash2 size={16} /></button>
    </div>)}
    <button type="button" onClick={() => onChange([...value, ['', '']])} className={`${btn} border border-gray-300 text-gray-700`}><Plus size={16} />Add</button>
  </div>;
}

function OfficeForm({ v, set }) {
  const up = (k) => (x) => set({ ...v, [k]: x });
  return <div className="space-y-5">
    <Bi label="Office name" value={v.name} onChange={up('name')} />
    <Bi label="Province" value={v.province} onChange={up('province')} />
    <Bi label="Ministry" value={v.ministry} onChange={up('ministry')} />
    <Bi label="City" value={v.city} onChange={up('city')} />
    <div className="grid gap-3 sm:grid-cols-2">
      <Text label="Phone" value={v.phone} onChange={up('phone')} />
      <Text label="Email" value={v.email} onChange={up('email')} />
      <Text label="Website (https://…)" value={v.website} onChange={up('website')} />
      <Text label="Facebook page (https://…)" value={v.facebook} onChange={up('facebook')} />
      <Text label="Map latitude" type="number" step="any" value={v.lat} onChange={(x) => up('lat')(x === '' ? undefined : Number(x))} />
      <Text label="Map longitude" type="number" step="any" value={v.lng} onChange={(x) => up('lng')(x === '' ? undefined : Number(x))} />
    </div>
    <BiLines label="Office hours" value={v.hours} onChange={up('hours')} />
    <BiLines label="About / introduction" value={v.intro} onChange={up('intro')} rows={5} />
    <Bi label="Work area" value={v.workArea} onChange={up('workArea')} />
    <Pairs label="What we do (नेपाली)" value={v.responsibilities?.ne} onChange={(x) => up('responsibilities')({ ...v.responsibilities, ne: x })} />
    <Pairs label="What we do (English)" value={v.responsibilities?.en} onChange={(x) => up('responsibilities')({ ...v.responsibilities, en: x })} />
  </div>;
}

function ListForm({ v, set, blank, fields }) {
  const upd = (i, k, x) => set(v.map((r, j) => (j === i ? { ...r, [k]: x } : r)));
  return <div className="space-y-3">
    {v.map((r, i) => <div key={i} className="rounded-md border border-gray-200 p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(([k, label, bi]) => bi
          ? <div key={k} className="sm:col-span-2 lg:col-span-3"><Bi label={label} value={r[k]} onChange={(x) => upd(i, k, x)} /></div>
          : <Text key={k} label={label} value={r[k]} onChange={(x) => upd(i, k, x)} />)}
      </div>
      <button type="button" onClick={() => set(v.filter((_, j) => j !== i))} className="mt-3 inline-flex items-center gap-1 text-sm text-red-700"><Trash2 size={14} />Remove</button>
    </div>)}
    <button type="button" onClick={() => set([...v, clone(blank)])} className={`${btn} border border-gray-300 text-gray-700`}><Plus size={16} />Add</button>
  </div>;
}

function LinksForm({ v, set }) {
  const upd = (i, j, x) => set(v.map((r, k) => (k === i ? r.map((c, m) => (m === j ? x : c)) : r)));
  return <div className="space-y-2">
    {v.map((r, i) => <div key={i} className="grid gap-2 sm:grid-cols-[2fr_2fr_auto]">
      <input aria-label="Link name" className={input} value={r[0]} onChange={(e) => upd(i, 0, e.target.value)} placeholder="Name" />
      <input aria-label="Link URL" className={input} value={r[1]} onChange={(e) => upd(i, 1, e.target.value)} placeholder="https://…" />
      <button type="button" aria-label="Remove" onClick={() => set(v.filter((_, k) => k !== i))} className="text-red-700"><Trash2 size={16} /></button>
    </div>)}
    <button type="button" onClick={() => set([...v, ['', 'https://']])} className={`${btn} border border-gray-300 text-gray-700`}><Plus size={16} />Add</button>
  </div>;
}

const SECTIONS = [
  { key: 'office', label: ['कार्यालय विवरण', 'Office info'] },
  { key: 'officers', label: ['सम्पर्क अधिकारी', 'Contact officers'] },
  { key: 'staff', label: ['कर्मचारी', 'Staff'] },
  { key: 'usefulLinks', label: ['उपयोगी लिङ्क', 'Useful links'] }
];

export default function SiteContentEditor() {
  const { t } = useLang();
  const [tab, setTab] = useState('office');
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  useEffect(() => { loadSiteContent().then(() => setData(clone({ office, officers, staff, usefulLinks }))); }, []);
  if (!data) return <p role="status" className="p-6">Loading…</p>;

  const setKey = (v) => setData((d) => ({ ...d, [tab]: v }));
  const save = async () => {
    setBusy(true); setMsg(''); setErr('');
    try {
      const { data: r } = await api.put(`/site-content/${tab}`, { value: data[tab] });
      applyContent({ [tab]: r.value }); setData((d) => ({ ...d, [tab]: clone(r.value) }));
      setMsg(t('सुरक्षित गरियो। सार्वजनिक पृष्ठमा तुरुन्त देखिनेछ।', 'Saved. The public site shows it right away.'));
    } catch (e) { setErr(errMsgs(e)[0]); } finally { setBusy(false); }
  };
  const reset = async () => {
    if (!window.confirm(t('यो खण्ड सुरुको मानमा फर्काउने?', 'Restore this section to its original content?'))) return;
    setBusy(true); setMsg(''); setErr('');
    try { await api.delete(`/site-content/${tab}`); resetKey(tab); setData((d) => ({ ...d, [tab]: clone(getDefaults()[tab]) })); setMsg(t('सुरुको मानमा फर्कियो।', 'Restored to the original content.')); }
    catch (e) { setErr(errMsgs(e)[0]); } finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-5xl space-y-5">
    <header><h1 className="font-display text-3xl font-bold text-terrace-900">{t('सार्वजनिक पृष्ठ सम्पादन', 'Edit public site')}</h1>
      <p className="mt-1 text-gray-600">{t('गृहपृष्ठ, सम्पर्क र कर्मचारी पृष्ठमा देखिने जानकारी यहाँबाट परिवर्तन गर्नुहोस्।', 'Change the information shown on the home, contact and staff pages.')}</p></header>
    <div role="tablist" className="flex flex-wrap gap-2 border-b border-gray-200">
      {SECTIONS.map((s) => <button key={s.key} role="tab" aria-selected={tab === s.key} onClick={() => { setTab(s.key); setMsg(''); setErr(''); }}
        className={`px-4 py-2 text-sm font-semibold ${tab === s.key ? 'border-b-2 border-terrace-800 text-terrace-900' : 'text-gray-500'}`}>{t(...s.label)}</button>)}
    </div>
    {msg && <p role="status" className="rounded-md bg-green-50 p-3 text-green-800">{msg}</p>}
    {err && <p role="alert" className="rounded-md bg-red-50 p-3 text-red-700">{err}</p>}
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      {tab === 'office' && <OfficeForm v={data.office} set={setKey} />}
      {tab === 'officers' && <ListForm v={data.officers} set={setKey} blank={{ role: { ne: '', en: '' }, name: '', post: '', phone: '', email: '' }}
        fields={[['role', 'Role', true], ['name', 'Name'], ['post', 'Post'], ['phone', 'Phone'], ['email', 'Email']]} />}
      {tab === 'staff' && <ListForm v={data.staff} set={setKey} blank={{ name: '', post: '', group: '', phone: '', email: '' }}
        fields={[['name', 'Name'], ['post', 'Post'], ['group', 'Group'], ['phone', 'Phone'], ['email', 'Email']]} />}
      {tab === 'usefulLinks' && <LinksForm v={data.usefulLinks} set={setKey} />}
    </div>
    <div className="flex flex-wrap gap-3">
      <button onClick={save} disabled={busy} className={`${btn} bg-terrace-800 text-white disabled:opacity-60`}><Save size={16} />{t('सुरक्षित गर्नुहोस्', 'Save')}</button>
      <button onClick={reset} disabled={busy} className={`${btn} border border-gray-300 text-gray-700`}><RotateCcw size={16} />{t('सुरुको मानमा फर्काउनुहोस्', 'Restore original')}</button>
    </div>
  </div>;
}

import { useMemo, useState } from 'react';
import { CalendarCheck2, Check, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Callout, PublicPage } from './common';
import { copy, field, surface } from './helpers';

const STORAGE_KEY = 'da.public-smart-farming.tasks.v1';
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const blank = { crop: '', title: '', date: today() };

function readTasks() {
  try {
    const rows = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(rows) ? rows.filter((row) => row && typeof row.id === 'string' && typeof row.title === 'string') : [];
  } catch { return []; }
}

export default function SeasonalPlanner() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  const [tasks, setTasks] = useState(readTasks);
  const [form, setForm] = useState(blank);
  const [filter, setFilter] = useState('open');
  const [saveError, setSaveError] = useState(false);
  const saveTasks = (next) => {
    setTasks(next);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setSaveError(false); }
    catch { setSaveError(true); }
  };
  const ordered = useMemo(() => [...tasks].filter((task) => filter === 'all' || (filter === 'done' ? task.done : !task.done)).sort((a, b) => a.date.localeCompare(b.date)), [filter, tasks]);
  const addTask = (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.date) return;
    saveTasks([...tasks, { id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, crop: form.crop.trim(), title: form.title.trim(), date: form.date, done: false, createdAt: new Date().toISOString() }]);
    setForm(blank);
  };
  const toggleTask = (id) => saveTasks(tasks.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  const removeTask = (id) => saveTasks(tasks.filter((task) => task.id !== id));
  return <PublicPage eyebrow={copy(lang, 'FIELD PLANNER', 'खेत कार्ययोजना')} title={copy(lang, 'Plan work around your farm', 'आफ्नो खेतअनुसार काम योजना गर्नुहोस्')} intro={copy(lang, 'Add scouting, irrigation checks, nursery work or harvest reminders. Tasks are saved in this browser on this device; they are not synced to a personal account.', 'बाली निरीक्षण, सिँचाइ जाँच, नर्सरी वा कटानी सम्झना थप्नुहोस्। कामहरू यस उपकरणको ब्राउजरमा सुरक्षित हुन्छन्, व्यक्तिगत खातासँग समक्रमण हुँदैनन्।')}>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,.9fr)]">
      <section className={`${surface} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{copy(lang, 'YOUR TASKS', 'तपाईंका काम')}</p><h2 className="mt-1 text-xl font-bold text-slate-950">{copy(lang, `${tasks.filter((task) => !task.done).length} open`, `${tasks.filter((task) => !task.done).length} बाँकी`)}</h2></div><label><span className="sr-only">{copy(lang, 'Task filter', 'काम छान्नुहोस्')}</span><select className={`${field} w-auto min-w-36`} value={filter} onChange={(event) => setFilter(event.target.value)}><option value="open">{copy(lang, 'Open tasks', 'बाँकी काम')}</option><option value="done">{copy(lang, 'Completed', 'पूरा भएका')}</option><option value="all">{copy(lang, 'All tasks', 'सबै काम')}</option></select></label></div>
        <form onSubmit={addTask} className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">{copy(lang, 'Task', 'काम')}<input required maxLength={120} className={`${field} mt-1`} value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} placeholder={copy(lang, 'e.g. Scout for leaf damage', 'जस्तै: पातमा क्षति निरीक्षण')} /></label>
          <label className="text-xs font-semibold text-slate-700">{copy(lang, 'Crop (optional)', 'बाली (वैकल्पिक)')}<input maxLength={80} className={`${field} mt-1`} value={form.crop} onChange={(event) => setForm((old) => ({ ...old, crop: event.target.value }))} placeholder={copy(lang, 'e.g. Tomato', 'जस्तै: गोलभेडा')} /></label>
          <label className="text-xs font-semibold text-slate-700">{copy(lang, 'Due date', 'मिति')}<input required type="date" className={`${field} mt-1`} value={form.date} onChange={(event) => setForm((old) => ({ ...old, date: event.target.value }))} /></label>
          <button type="submit" className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white hover:bg-emerald-800"><Plus size={17} aria-hidden="true" />{copy(lang, 'Add task', 'काम थप्नुहोस्')}</button>
        </form>
        <div className="mt-5 space-y-2" aria-live="polite">{ordered.map((task) => {
          const overdue = !task.done && task.date < today();
          return <article key={task.id} className={`flex items-start gap-3 rounded-xl border p-3 ${overdue ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'}`}><button type="button" onClick={() => toggleTask(task.id)} aria-label={task.done ? copy(lang, 'Mark task open', 'काम बाँकी बनाउनुहोस्') : copy(lang, 'Mark task complete', 'काम पूरा गर्नुहोस्')} aria-pressed={task.done} className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${task.done ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 bg-white text-transparent hover:border-emerald-700'}`}><Check size={14} aria-hidden="true" /></button><div className="min-w-0 flex-1"><p className={`font-semibold ${task.done ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{task.title}</p><p className="mt-1 text-xs text-slate-600">{task.crop && <>{task.crop} · </>}<time dateTime={task.date}>{new Date(`${task.date}T00:00:00`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ne-NP', { dateStyle: 'medium' })}</time>{overdue && <span className="ml-2 font-bold text-rose-800">{copy(lang, 'Overdue', 'म्याद नाघेको')}</span>}</p></div><button type="button" onClick={() => removeTask(task.id)} aria-label={copy(lang, `Delete ${task.title}`, `${task.title} मेटाउनुहोस्`)} className="grid min-h-10 min-w-10 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-800"><Trash2 size={17} aria-hidden="true" /></button></article>;
        })}{!ordered.length && <div className="rounded-xl border border-dashed border-slate-300 p-7 text-center"><CalendarCheck2 className="mx-auto text-emerald-800" aria-hidden="true" /><p className="mt-2 text-sm font-semibold text-slate-800">{copy(lang, 'No tasks in this view yet.', 'यस सूचीमा अहिले कुनै काम छैन।')}</p><p className="mt-1 text-xs text-slate-600">{copy(lang, 'Add a task above to get started.', 'सुरु गर्न माथि काम थप्नुहोस्।')}</p></div>}</div>
        {saveError && <p role="status" className="mt-3 text-sm text-rose-800">{copy(lang, 'This browser could not save tasks. Check local storage settings.', 'ब्राउजरले काम सुरक्षित गर्न सकेन। स्थानीय भण्डारण सेटिङ जाँच गर्नुहोस्।')}</p>}
      </section>
      <div className="space-y-4"><Callout title={copy(lang, 'Use local conditions', 'स्थानीय अवस्था विचार गर्नुहोस्')} tone="amber">{copy(lang, 'Kaski’s elevation and microclimates vary. Set dates using your own crop, variety, water supply and advice from a local technician. This planner does not generate a crop calendar or send notifications.', 'कास्कीमा उचाइ र सूक्ष्म जलवायु फरक हुन्छन्। बाली, जात, पानी र स्थानीय प्राविधिकको सल्लाहअनुसार मिति राख्नुहोस्। यो योजनाकार बाली पात्रो बनाउँदैन वा सूचना पठाउँदैन।')}</Callout><aside className={`${surface} p-5`}><h2 className="font-bold text-slate-900">{copy(lang, 'Examples of tasks to track', 'राख्न सकिने कामका उदाहरण')}</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">{(lang === 'en' ? ['Check seedlings before transplanting', 'Scout a field for crop symptoms', 'Review irrigation and drainage', 'Record harvest quantity'] : ['बेर्ना सार्नुअघि जाँच गर्ने', 'बालीका लक्षण खेतमा निरीक्षण गर्ने', 'सिँचाइ र निकास जाँच्ने', 'कटानी परिमाण टिप्ने']).map((item) => <li key={item} className="flex gap-2"><span className="font-bold text-emerald-700">•</span>{item}</li>)}</ul></aside><p className="px-1 text-xs leading-5 text-slate-500">{copy(lang, 'Saved locally on this device. Clearing site data or changing browsers may remove these tasks.', 'यस उपकरणमा मात्र सुरक्षित हुन्छ। साइट डाटा मेटाउँदा वा ब्राउजर बदल्दा काम हराउन सक्छ।')}</p></div>
    </div>
  </PublicPage>;
}

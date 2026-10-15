import { useEffect, useState } from 'react';
import { Bell, CalendarClock, ExternalLink, Megaphone, Plus } from 'lucide-react';
import api from '../../services/api';
import useLang from '../../utils/useLang';
import { useAuth } from '../../context/useAuth';
import { errMsgs } from '../../utils/errors';

const blank = { category: 'notice', title_en: '', title_ne: '', body: '', file_path: '', deadline_date: '' };
const categoryLabel = (category, t) => ({ notice: t('सूचना', 'Notice'), news: t('समाचार', 'News'), press_release: t('प्रेस विज्ञप्ति', 'Press release'), program: t('कार्यक्रम', 'Program'), training: t('तालिम', 'Training') }[category] || category);

export default function Notices() {
  const { t, lang } = useLang(); const { can } = useAuth();
  const [rows, setRows] = useState([]), [form, setForm] = useState(blank), [show, setShow] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const load = () => api.get('/content/notices').then((r) => setRows(r.data)).catch((e) => setError(errMsgs(e)[0]));
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setError(''); setMessage('');
    try {
      const published = can('notices.publish');
      await api.post('/content/notices', { ...form, title_ne: form.title_ne || form.title_en, is_published: published });
      setForm(blank); setShow(false); setMessage(published ? t('सूचना प्रकाशित भयो।', 'Notice published.') : t('सूचना मस्यौदा सुरक्षित भयो।', 'Notice saved as a draft.')); await load();
    } catch (e2) { setError(errMsgs(e2)[0]); }
  };
  const publish = async (row) => {
    try { await api.put(`/content/notices/${row.id}`, { is_published: !row.is_published }); await load(); }
    catch (e) { setError(errMsgs(e)[0]); }
  };
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-950 via-slate-900 to-emerald-950 p-6 text-white shadow-lg sm:p-8"><div className="absolute -right-10 -top-12 h-48 w-48 rounded-full border-[24px] border-white/5"/><div className="relative flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[.18em] text-sky-200">{t('कास्की कृषि कार्यालय', 'Kaski agriculture office')}</p><h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{t('सूचना तथा अवसर', 'Notices and opportunities')}</h1><p className="mt-2 max-w-2xl text-slate-200">{t('कृषि सूचना, कार्यक्रम, तालिम र समयसीमाको द्विभाषिक अभिलेख।', 'A bilingual record of agriculture announcements, programs, training, and deadlines.')}</p></div>{can('notices.create') && <button onClick={() => setShow((v) => !v)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 font-semibold text-blue-950"><Plus size={18}/>{t('सूचना लेख्नुहोस्', 'Write a notice')}</button>}</div></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}{message && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {show && <form onSubmit={submit} className="grid gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:grid-cols-2"><h2 className="text-lg font-bold sm:col-span-2">{t('नयाँ सूचना', 'New notice')}</h2>
      <label className="text-sm font-medium">{t('वर्ग', 'Category')}<select value={form.category} onChange={set('category')} className="mt-1 w-full rounded-xl border p-3">{['notice', 'news', 'press_release', 'program', 'training'].map((x) => <option key={x} value={x}>{categoryLabel(x, t)}</option>)}</select></label>
      <label className="text-sm font-medium">{t('अन्तिम मिति', 'Deadline')}<input type="date" value={form.deadline_date} onChange={set('deadline_date')} className="mt-1 w-full rounded-xl border p-3"/></label>
      <label className="text-sm font-medium">{t('शीर्षक *', 'Title *')}<input required value={form.title_en} onChange={set('title_en')} className="mt-1 w-full rounded-xl border p-3"/></label>
      <label className="text-sm font-medium">{t('नेपाली शीर्षक', 'Nepali title')}<input value={form.title_ne} onChange={set('title_ne')} className="mt-1 w-full rounded-xl border p-3"/></label>
      <label className="text-sm font-medium sm:col-span-2">{t('विवरण', 'Details')}<textarea rows="5" value={form.body} onChange={set('body')} className="mt-1 w-full rounded-xl border p-3"/></label>
      <label className="text-sm font-medium sm:col-span-2">{t('सम्बन्धित वेब लिङ्क (वैकल्पिक)', 'Related web link (optional)')}<input type="url" value={form.file_path} onChange={set('file_path')} placeholder="https://" className="mt-1 w-full rounded-xl border p-3"/></label>
      <div className="flex gap-2 sm:col-span-2"><button className="min-h-11 rounded-xl bg-terrace-800 px-5 font-semibold text-white">{can('notices.publish') ? t('प्रकाशित गर्नुहोस्', 'Publish') : t('मस्यौदा सुरक्षित गर्नुहोस्', 'Save draft')}</button><button type="button" onClick={() => setShow(false)} className="min-h-11 rounded-xl border px-5">{t('रद्द', 'Cancel')}</button></div>
    </form>}
    {rows.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><Bell className="mx-auto text-slate-400"/><h2 className="mt-3 font-bold text-slate-900">{t('हाल कुनै सूचना छैन', 'No notices yet')}</h2><p className="mt-1 text-sm text-slate-600">{t('नयाँ सूचना प्रकाशित भएपछि यहाँ देखिनेछ।', 'Published notices will appear here.')}</p></div> : <section className="grid gap-4 lg:grid-cols-2">{rows.map((n) => <article key={n.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900"><Megaphone size={14}/>{categoryLabel(n.category, t)}</span>{!n.is_published && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">{t('मस्यौदा', 'Draft')}</span>}</div><h2 className="mt-3 text-xl font-bold text-slate-950">{lang === 'ne' ? n.title_ne : (n.title_en || n.title_ne)}</h2>{n.body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{n.body}</p>}<div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><CalendarClock size={14}/>{n.deadline_date ? `${t('अन्तिम मिति', 'Deadline')}: ${new Date(n.deadline_date).toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-GB')}` : new Date(n.published_at || n.created_at).toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-GB')}</span>{n.file_path && <a href={n.file_path} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-800 underline">{t('थप विवरण', 'More details')}<ExternalLink size={13}/></a>}</div>{can('notices.publish') && <button onClick={() => publish(n)} className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">{n.is_published ? t('मस्यौदामा लैजानुहोस्', 'Unpublish') : t('प्रकाशित गर्नुहोस्', 'Publish')}</button>}</article>)}</section>}
  </div>;
}

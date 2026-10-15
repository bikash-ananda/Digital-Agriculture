import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BadgeCheck, BookOpen, Check, Clock3, FileText, FlaskConical, GraduationCap, Lightbulb, MessageCircle, Plus, Search, Send, ShieldCheck, X } from 'lucide-react';
import api from '../../services/api';
import useLang from '../../utils/useLang';
import { useAuth } from '../../context/AuthContext';
import { AgriculturePageHero } from '../../components/layout/AgricultureShowcase';

const Documents = lazy(() => import('./Documents'));
const ResearchLab = lazy(() => import('../research/ResearchLab'));
const AgriInnovationCenter = lazy(() => import('./AgriInnovationCenter'));
const GamesHub = lazy(() => import('../../games/GamesHub'));
const MyFarmGame = lazy(() => import('../../games/MyFarmGame'));

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const input = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100';
const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50';
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50';
const SOURCES = [
  { key: 'soil', icon: '🧪', title: { ne: 'राष्ट्रिय माटो नक्सा', en: 'National Soil Map' }, body: { ne: 'माटोको pH, जैविक पदार्थ, पोषक तत्त्व र बनावटका नक्सा तह हेर्नुहोस्।', en: 'Explore map layers for soil pH, organic matter, nutrients and texture.' }, url: 'https://soil.narc.gov.np/soil/soilmap/', label: 'NARC · NSSRC' },
  { key: 'ado', icon: '🏛️', title: { ne: 'कृषि विकास कार्यालय, कास्की', en: 'Agriculture Development Office, Kaski' }, body: { ne: 'आधिकारिक सूचना, फारम, प्रकाशन र कृषि-मौसम सल्लाहका स्रोत।', en: 'Official notices, forms, publications and agro-weather bulletins.' }, url: 'https://kaski.ado.gov.np/', label: 'ADO Kaski' },
  { key: 'pokhara', icon: '🌾', title: { ne: 'पोखरा कृषि पोर्टल', en: 'Pokhara Agriculture Portal' }, body: { ne: 'महानगरका कृषि सूचना, कार्यक्रम र प्राविधिक प्रकाशन हेर्नुहोस्।', en: 'Browse municipal agriculture notices, programs and technical publications.' }, url: 'https://www.pokharakrishi.com/', label: 'Pokhara Krishi' },
  { key: 'apms', icon: '🧑‍🌾', title: { ne: 'कृषि योजना तथा आवेदन', en: 'Production plans & applications' }, body: { ne: 'पोखरा कृषि पोर्टलको वार्षिक उत्पादन योजना र कार्यक्रम आवेदन सेवामा जानुहोस्। व्यक्तिगत कृषक विवरण यहाँ प्रतिलिपि गरिँदैन।', en: 'Open Pokhara Krishi’s annual production-plan and program-application services. This site does not copy personal farmer records.' }, url: 'https://apms.pokharakrishi.com/', label: 'Pokhara Krishi · APMS' }
];
const TOPICS = ['soil', 'crop production', 'climate', 'plant protection', 'irrigation', 'post-harvest', 'other'];

function safeHref(value) {
  if (!value || typeof value !== 'string') return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return '';
}

export default function KnowledgeCenter() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const can = useCallback((permission) => !!user?.permissions?.includes(permission), [user?.permissions]);
  const location = useLocation();
  const isInternal = location.pathname.startsWith('/app/');
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'discover';
  const tabKeys = ['discover', 'training', 'innovation', 'library', ...(isInternal && can('research.view') ? ['research'] : []), 'papers', ...(can('knowledge.discuss') ? ['forum'] : []), ...(can('knowledge.create') ? ['submit'] : []), ...(can('knowledge.publish') ? ['review'] : [])];
  const tab = requestedTab === 'games' ? 'training' : tabKeys.includes(requestedTab) ? requestedTab : 'discover';
  const showFarmGame = searchParams.get('game') === 'my-farm';
  const [articles, setArticles] = useState([]);
  const [papers, setPapers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [library, setLibrary] = useState({ documents: [], resources: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [activePaper, setActivePaper] = useState(null);
  const [comments, setComments] = useState({});
  const [commentForm, setCommentForm] = useState({ display_name: '', body: '' });
  const [courseId, setCourseId] = useState(null);
  const [courseDetail, setCourseDetail] = useState(null);
  const [discussions, setDiscussions] = useState([]);
  const [activeDiscussion, setActiveDiscussion] = useState(null);
  const [messages, setMessages] = useState([]);
  const [paperQueue, setPaperQueue] = useState([]);
  const [commentQueue, setCommentQueue] = useState([]);
  const [paperForm, setPaperForm] = useState({ title: '', author_names: '', affiliation: '', abstract: '', keywords: '', topic: '', publication_year: '', doi: '', full_text_url: '' });
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseForm, setCourseForm] = useState({ title_en: '', title_ne: '', description: '', level: 'beginner' });
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [lessonForm, setLessonForm] = useState({ title_en: '', title_ne: '', body: '', duration_minutes: '' });
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [resourceForm, setResourceForm] = useState({ title_en: '', title_ne: '', resource_type: 'manual', url: '', description: '' });
  const [discussionForm, setDiscussionForm] = useState({ title: '', topic: '' });
  const [messageBody, setMessageBody] = useState('');
  const [busy, setBusy] = useState(false);

  const titleFor = (obj) => lang === 'en' ? (obj?.title_en || obj?.title_ne || obj?.title) : (obj?.title_ne || obj?.title_en || obj?.title);
  const labelFor = (obj) => lang === 'en' ? (obj?.title_en || obj?.title_ne) : (obj?.title_ne || obj?.title_en);
  const dateFor = (value) => value ? new Date(value).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ne-NP', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  const filtered = (rows, ...keys) => rows.filter((row) => keys.some((key) => String(row[key] || '').toLowerCase().includes(query.trim().toLowerCase())));

  useEffect(() => {
    let current = true;
    async function load() {
      const courseRequest = can('learning.view') ? api.get('/content/learning') : api.get('/content/public/training');
      const results = await Promise.allSettled([
        api.get('/content/public/articles'), api.get('/content/public/papers'), courseRequest, api.get('/content/public/library')
      ]);
      if (!current) return;
      const [articleResult, paperResult, courseResult, libraryResult] = results;
      if (articleResult.status === 'fulfilled') setArticles(articleResult.value.data);
      if (paperResult.status === 'fulfilled') setPapers(paperResult.value.data);
      if (courseResult.status === 'fulfilled') setCourses(Array.isArray(courseResult.value.data) ? courseResult.value.data : (courseResult.value.data.courses || []));
      if (libraryResult.status === 'fulfilled') setLibrary(libraryResult.value.data);
      if (results.every((result) => result.status === 'rejected')) setError(t('ज्ञान सामग्री अहिले लोड भएन। केहीबेरपछि फेरि प्रयास गर्नुहोस्।', 'Knowledge content could not load right now. Please try again shortly.'));
      setLoading(false);
    }
    load();
    return () => { current = false; };
  }, [can, lang, t]);

  useEffect(() => {
    if (!activePaper) return undefined;
    let current = true;
    api.get(`/content/public/papers/${activePaper}/comments`).then((r) => { if (current) setComments((all) => ({ ...all, [activePaper]: r.data })); }).catch(() => {});
    return () => { current = false; };
  }, [activePaper]);

  useEffect(() => {
    if (!courseId) return undefined;
    let current = true;
    const path = can('learning.view') ? `/content/learning/courses/${courseId}` : `/content/public/training/${courseId}`;
    api.get(path).then((r) => { if (current) setCourseDetail(r.data); }).catch((e) => { if (current) setError(e.response?.data?.message || t('पाठ्यक्रम लोड भएन।', 'Could not load this course.')); });
    return () => { current = false; };
  }, [courseId, can, lang, t]);

  useEffect(() => {
    if (tab !== 'forum' || !can('knowledge.discuss')) return undefined;
    let current = true;
    api.get('/content/discussions').then((r) => { if (current) setDiscussions(r.data); }).catch((e) => { if (current) setError(e.response?.data?.message || t('कर्मचारी छलफल लोड भएन।', 'Could not load staff discussions.')); });
    return () => { current = false; };
  }, [tab, can, lang, t]);

  useEffect(() => {
    if (!activeDiscussion || tab !== 'forum') return undefined;
    let current = true;
    api.get(`/content/discussions/${activeDiscussion}/messages`).then((r) => { if (current) setMessages(r.data); }).catch(() => {});
    return () => { current = false; };
  }, [activeDiscussion, tab]);

  useEffect(() => {
    if (tab !== 'review' || !can('knowledge.publish')) return undefined;
    let current = true;
    Promise.allSettled([api.get('/content/papers/manage'), api.get('/content/moderation/comments')]).then(([p, c]) => {
      if (!current) return;
      if (p.status === 'fulfilled') setPaperQueue(p.value.data);
      if (c.status === 'fulfilled') setCommentQueue(c.value.data);
      if (p.status === 'rejected' && c.status === 'rejected') setError(t('समीक्षा सूची लोड भएन।', 'Could not load the review queue.'));
    });
    return () => { current = false; };
  }, [tab, can, lang, t]);

  const setTab = (next) => { setSearchParams((old) => { const updated = new URLSearchParams(old); if (next === 'discover') updated.delete('tab'); else updated.set('tab', next); updated.delete('game'); return updated; }); setError(''); setNotice(''); };
  const openFarmGame = () => setSearchParams((old) => { const updated = new URLSearchParams(old); updated.set('tab', 'training'); updated.set('game', 'my-farm'); return updated; });
  const closeFarmGame = () => setSearchParams((old) => { const updated = new URLSearchParams(old); updated.set('tab', 'training'); updated.delete('game'); return updated; });
  const paperCount = papers.length;
  const courseCount = courses.length;
  const resourceCount = library.documents.length + library.resources.length;

  const submitPaper = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/content/papers', { ...paperForm, publication_year: paperForm.publication_year || undefined });
      setPaperForm({ title: '', author_names: '', affiliation: '', abstract: '', keywords: '', topic: '', publication_year: '', doi: '', full_text_url: '' });
      setNotice(t('लेख समीक्षा सूचीमा पठाइयो। प्रकाशित भएपछि सार्वजनिक देखिनेछ।', 'Paper submitted for review. It will appear publicly after editorial approval.'));
    } catch (e) { setError(e.response?.data?.message || t('लेख पठाउन सकेन।', 'Could not submit the paper.')); }
    finally { setBusy(false); }
  };

  const submitComment = async (event, paper) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await api.post(`/content/public/papers/${paper.id}/comments`, commentForm);
      setCommentForm({ display_name: '', body: '' });
      setNotice(t('टिप्पणी प्राप्त भयो। सार्वजनिक हुनुअघि संयोजकले जाँच गर्नेछन्।', 'Comment received. A moderator will review it before publication.'));
    } catch (e) { setError(e.response?.data?.message || t('टिप्पणी पठाउन सकेन।', 'Could not submit your comment.')); }
    finally { setBusy(false); }
  };

  const reviewPaper = async (paper, status) => {
    setBusy(true); setError('');
    try { await api.put(`/content/papers/${paper.id}/review`, { status }); setPaperQueue((rows) => rows.filter((row) => row.id !== paper.id)); if (status === 'published') setPapers((rows) => [{ ...paper, published_at: new Date().toISOString() }, ...rows]); setNotice(t('लेखको समीक्षा सुरक्षित भयो।', 'Paper decision saved.')); }
    catch (e) { setError(e.response?.data?.message || t('समीक्षा सुरक्षित भएन।', 'Review could not be saved.')); }
    finally { setBusy(false); }
  };
  const moderateComment = async (comment, status) => {
    setBusy(true); setError('');
    try { await api.put(`/content/moderation/comments/${comment.id}`, { status }); setCommentQueue((rows) => rows.filter((row) => row.id !== comment.id)); setNotice(t('टिप्पणी जाँच गरियो।', 'Comment moderated.')); }
    catch (e) { setError(e.response?.data?.message || t('टिप्पणी जाँच भएन।', 'Comment moderation failed.')); }
    finally { setBusy(false); }
  };

  const openCourse = async (course) => { setCourseId(course.id); setCourseDetail(null); setError(''); };
  const refreshCourses = async () => {
    const r = await api.get(can('learning.view') ? '/content/learning' : '/content/public/training');
    setCourses(Array.isArray(r.data) ? r.data : (r.data.courses || []));
  };
  const createCourse = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const r = await api.post('/content/learning/courses', { ...courseForm, status: 'draft' });
      setCourseForm({ title_en: '', title_ne: '', description: '', level: 'beginner' }); setShowCourseForm(false);
      await refreshCourses(); setCourseId(r.data.id); setCourseDetail(null); setNotice(t('पाठ्यक्रमको मस्यौदा बन्यो। अब पाठ थप्नुहोस्।', 'Course draft created. Add lessons to continue.'));
    } catch (e) { setError(e.response?.data?.message || t('पाठ्यक्रम बनाउन सकेन।', 'Could not create the course.')); }
    finally { setBusy(false); }
  };
  const addLesson = async (event) => {
    event.preventDefault(); if (!courseId) return; setBusy(true); setError('');
    try {
      await api.post(`/content/learning/courses/${courseId}/lessons`, { ...lessonForm, duration_minutes: lessonForm.duration_minutes || undefined });
      setLessonForm({ title_en: '', title_ne: '', body: '', duration_minutes: '' }); setShowLessonForm(false);
      const r = await api.get(`/content/learning/courses/${courseId}`); setCourseDetail(r.data); setNotice(t('पाठ सुरक्षित भयो।', 'Lesson saved.'));
    } catch (e) { setError(e.response?.data?.message || t('पाठ सुरक्षित भएन।', 'Could not save the lesson.')); }
    finally { setBusy(false); }
  };
  const publishCourse = async () => {
    if (!courseId) return; setBusy(true); setError('');
    try {
      await api.put(`/content/learning/courses/${courseId}`, { status: 'published' });
      const r = await api.get(`/content/learning/courses/${courseId}`); setCourseDetail(r.data); await refreshCourses();
      setNotice(t('पाठ्यक्रम प्रकाशित भयो।', 'Course published.'));
    } catch (e) { setError(e.response?.data?.message || t('पाठ्यक्रम प्रकाशित भएन।', 'Could not publish the course.')); }
    finally { setBusy(false); }
  };
  const createResource = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api.post('/content/learning/resources', { ...resourceForm, status: can('learning.publish') ? 'published' : 'draft' });
      setResourceForm({ title_en: '', title_ne: '', resource_type: 'manual', url: '', description: '' }); setShowResourceForm(false);
      const r = await api.get('/content/public/library'); setLibrary(r.data); setNotice(t('स्रोत सुरक्षित भयो।', 'Resource saved.'));
    } catch (e) { setError(e.response?.data?.message || t('स्रोत सुरक्षित भएन।', 'Could not save the resource.')); }
    finally { setBusy(false); }
  };
  const enroll = async () => {
    if (!courseId || !can('learning.view')) return;
    setBusy(true);
    try { await api.post(`/content/learning/courses/${courseId}/enroll`); const r = await api.get(`/content/learning/courses/${courseId}`); setCourseDetail(r.data); setNotice(t('सिकाइ सुरु भयो।', 'You are enrolled.')); }
    catch (e) { setError(e.response?.data?.message || t('दर्ता गर्न सकेन।', 'Could not enroll.')); }
    finally { setBusy(false); }
  };
  const completeLesson = async (index) => {
    if (!courseDetail?.enrollment || !courseDetail.lessons.length) return;
    const progress = Math.round(((index + 1) / courseDetail.lessons.length) * 100);
    setBusy(true);
    try { const r = await api.put(`/content/learning/courses/${courseId}/progress`, { progress_percent: progress }); setCourseDetail((d) => ({ ...d, enrollment: { ...d.enrollment, progress_percent: r.data.progress_percent, status: r.data.progress_percent === 100 ? 'completed' : 'enrolled' } })); }
    catch (e) { setError(e.response?.data?.message || t('प्रगति सुरक्षित भएन।', 'Progress was not saved.')); }
    finally { setBusy(false); }
  };

  const createDiscussion = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { const r = await api.post('/content/discussions', discussionForm); setDiscussionForm({ title: '', topic: '' }); const list = await api.get('/content/discussions'); setDiscussions(list.data); setActiveDiscussion(r.data.id); }
    catch (e) { setError(e.response?.data?.message || t('छलफल सुरु गर्न सकेन।', 'Could not start the discussion.')); }
    finally { setBusy(false); }
  };
  const sendMessage = async (event) => {
    event.preventDefault(); if (!activeDiscussion) return; setBusy(true); setError('');
    try { await api.post(`/content/discussions/${activeDiscussion}/messages`, { body: messageBody }); setMessageBody(''); const r = await api.get(`/content/discussions/${activeDiscussion}/messages`); setMessages(r.data); const list = await api.get('/content/discussions'); setDiscussions(list.data); }
    catch (e) { setError(e.response?.data?.message || t('सन्देश पठाउन सकेन।', 'Could not send the message.')); }
    finally { setBusy(false); }
  };

  const tabNames = {
    discover: [t('खोज तथा स्रोत', 'Explore & sources'), Search],
    papers: [t('अनुसन्धान लेख', 'Research papers'), FileText],
    training: [t('सिकाइ केन्द्र', 'Learning Center'), GraduationCap],
    innovation: [t('कृषि नवप्रवर्तन केन्द्र', 'Agri Innovation Center'), Lightbulb],
    library: [t('डिजिटल पुस्तकालय', 'Digital Library'), BookOpen],
    research: [t('अनुसन्धान केन्द्र', 'Research Center'), FlaskConical],
    forum: [t('प्राविधिक छलफल', 'Officer forum'), MessageCircle],
    submit: [t('लेख पठाउनुहोस्', 'Submit a paper'), Plus],
    review: [t('समीक्षा कक्ष', 'Review desk'), ShieldCheck]
  };

  return (
    <main className="pb-10">
      <AgriculturePageHero
        title={t('कृषि ज्ञान केन्द्र', 'Agriculture Knowledge Center')}
        intro={t('स्थानीय अनुसन्धान, किसानमैत्री सिकाइ र आधिकारिक कृषि स्रोत एउटै ठाउँमा। प्रमाण पढ्नुहोस्, प्रश्न राख्नुहोस् र नयाँ अध्ययन साझा गर्नुहोस्।', 'Local research, practical learning and trusted agriculture sources in one place. Explore evidence, ask questions and share new studies.')}
        eyebrow={t('कास्की कृषि ज्ञान सञ्जाल', 'Kaski agriculture knowledge network')}
      />
      <div className="mx-auto max-w-7xl space-y-5 px-4 pt-5">
      <section aria-label={t('ज्ञान केन्द्रको तथ्याङ्क', 'Knowledge Center statistics')} className="grid grid-cols-3 gap-3 text-center">
        {[[paperCount, t('प्रकाशित लेख', 'papers')], [courseCount, t('पाठ्यक्रम', 'courses')], [resourceCount, t('स्रोत', 'resources')]].map(([n, label]) => <div key={label} className="rounded-xl border border-terrace-100 bg-white p-3 shadow-sm"><strong className="block text-xl text-terrace-900">{loading ? '—' : n}</strong><span className="text-xs text-gray-600">{label}</span></div>)}
      </section>

      <nav aria-label={t('ज्ञान केन्द्रका खण्ड', 'Knowledge Center sections')} className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {tabKeys.map((key) => { const [label, Icon] = tabNames[key]; return <button key={key} onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition sm:px-4 ${tab === key ? 'bg-emerald-900 text-white shadow' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-900'}`}><Icon size={16}/>{label}</button>; })}
      </nav>

      {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>{error}</span><button aria-label={t('बन्द गर्नुहोस्', 'Dismiss')} onClick={() => setError('')}><X size={17}/></button></div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</div>}

      {tab === 'discover' && <div className="space-y-5">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {SOURCES.map((source) => <a key={source.key} href={source.url} target="_blank" rel="noreferrer" className={`${card} group flex min-h-48 flex-col transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-md`}><span className="text-2xl" aria-hidden="true">{source.icon}</span><span className="mt-3 text-[11px] font-bold uppercase tracking-wider text-emerald-800">{source.label}</span><h2 className="mt-1 text-lg font-bold text-slate-950">{t(source.title.ne, source.title.en)}</h2><p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{t(source.body.ne, source.body.en)}</p><span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-900">{t('आधिकारिक स्रोत खोल्नुहोस्', 'Visit source')} <ArrowUpRight size={15}/></span></a>)}
        </section>
        <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <article className={`${card} border-emerald-100 bg-gradient-to-br from-white to-emerald-50/60`}>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('स्थानीय अनुसन्धान पढ्ने तरिका', 'How to read local evidence')}</p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">{t('मापन, स्थान र सिजनलाई सँगै हेर्नुहोस्', 'Read measurements with place and season')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{t('कास्कीमा उचाइ, मोहडा, माटो र संरक्षित खेतीका अवस्था फरक हुन्छन्। सिफारिस प्रयोग गर्दा अध्ययनको नमुना, समयावधि र सीमाहरू जाँच्नुहोस्; आफ्नो खेतमा सानो दोहोरिएको परीक्षणबाट नतिजा पुष्टि गर्नुहोस्।', 'Kaski farms vary in elevation, aspect, soil and protected-cropping conditions. Before applying a recommendation, check its sample, season and limits, then validate it with a small replicated field trial.')}</p>
            <div className="mt-4 flex flex-wrap gap-2"><button className={secondary} onClick={() => setTab('papers')}><FileText size={16}/>{t('अनुसन्धान लेख हेर्नुहोस्', 'Browse research papers')}</button><button className={secondary} onClick={() => setTab('training')}><GraduationCap size={16}/>{t('पाठ सिक्नुहोस्', 'Study a course')}</button></div>
          </article>
          <article className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-lime-300">{t('खुला अध्ययनका विषय', 'Open study themes')}</p>
            <ul className="mt-3 space-y-3 text-sm text-slate-100">{[
              [t('माटो स्वास्थ्य', 'Soil health'), t('नक्सा तहसँग खेतको परीक्षण नतिजा तुलना गर्नुहोस्।', 'Compare field tests with mapped soil layers.')],
              [t('कृषि-मौसम', 'Agro-weather'), t('आधिकारिक बुलेटिन र खेतको स्थानीय मापन सँगै राख्नुहोस्।', 'Read official bulletins alongside local field readings.')],
              [t('बाली व्यवस्थापन', 'Crop management'), t('बाली, सिजन र स्थानअनुसार अध्ययन खोज्नुहोस्।', 'Find evidence by crop, season and location.')]
            ].map(([heading, body]) => <li key={heading} className="border-b border-white/10 pb-3 last:border-0"><strong className="block text-white">{heading}</strong><span className="mt-1 block text-slate-300">{body}</span></li>)}</ul>
          </article>
        </section>
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('सम्पादित सामग्री', 'Editorial resources')}</p><h2 className="mt-1 text-xl font-bold text-slate-950">{t('प्रकाशित ज्ञान लेख', 'Published knowledge notes')}</h2></div><button onClick={() => setTab('library')} className="text-sm font-semibold text-emerald-900 underline">{t('सबै स्रोत', 'All resources')}</button></div>
          {articles.length ? <div className="grid gap-3 md:grid-cols-2">{filtered(articles, 'title_ne', 'title_en', 'body', 'topic', 'crop_en').map((article) => <article key={article.id} className={card}><div className="flex items-center gap-2 text-xs font-semibold uppercase text-emerald-800"><span>{article.topic}</span>{article.crop_en && <><span aria-hidden="true">·</span><span>{lang === 'en' ? article.crop_en : article.crop_ne}</span></>}</div><h3 className="mt-2 text-lg font-bold text-slate-950">{labelFor(article)}</h3><p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">{article.body}</p><p className="mt-3 text-xs text-slate-500">{dateFor(article.created_at)}</p></article>)}</div> : <div className={card}><p className="text-sm text-slate-600">{loading ? t('प्रकाशित सामग्री खोज्दै…', 'Loading published notes…') : t('सम्पादित ज्ञान लेख छिट्टै यहाँ देखिनेछन्।', 'Reviewed knowledge notes will appear here.')}</p></div>}
        </section>
      </div>}

      {tab === 'papers' && <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('सार्वजनिक अध्ययन', 'Open research')}</p><h2 className="mt-1 text-2xl font-bold text-slate-950">{t('अनुसन्धान लेख तथा छलफल', 'Research papers & discussion')}</h2></div><label className="relative w-full sm:max-w-xs"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input className={`${input} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('शीर्षक वा विषय खोज्नुहोस्', 'Search title or topic')}/></label></div>
        {filtered(papers, 'title', 'author_names', 'abstract', 'keywords', 'topic').length ? filtered(papers, 'title', 'author_names', 'abstract', 'keywords', 'topic').map((paper) => <article key={paper.id} className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold capitalize text-emerald-900">{paper.topic || t('कृषि', 'Agriculture')}</span>{paper.publication_year && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{paper.publication_year}</span>}</div><h3 className="mt-3 text-xl font-bold text-slate-950">{paper.title}</h3><p className="mt-1 text-sm text-slate-600">{paper.author_names}{paper.affiliation ? ` · ${paper.affiliation}` : ''}</p></div><BadgeCheck className="shrink-0 text-emerald-700" aria-label={t('सम्पादकद्वारा प्रकाशित', 'Editorially published')}/></div>
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">{paper.abstract}</p>{paper.keywords && <p className="mt-3 text-xs text-slate-500">{t('शब्दसूची', 'Keywords')}: {paper.keywords}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">{paper.doi && <span className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">DOI: {paper.doi}</span>}{safeHref(paper.full_text_url) && <a className={secondary} href={safeHref(paper.full_text_url)} target="_blank" rel="noreferrer"><FileText size={15}/>{t('पूरा लेख', 'Full paper')} <ArrowUpRight size={14}/></a>}<button className={secondary} onClick={() => setActivePaper(activePaper === paper.id ? null : paper.id)}><MessageCircle size={15}/>{t('पढ्नुहोस् र टिप्पणी गर्नुहोस्', 'Read & comment')} ({comments[paper.id]?.length || 0})</button></div>
          {activePaper === paper.id && <div className="mt-5 grid gap-5 border-t border-slate-200 pt-5 lg:grid-cols-[1fr_.9fr]">
            <div><h4 className="font-bold text-slate-900">{t('सार्वजनिक टिप्पणी', 'Public discussion')}</h4><div className="mt-3 space-y-3">{(comments[paper.id] || []).length ? comments[paper.id].map((comment) => <blockquote key={comment.id} className="rounded-xl bg-slate-50 p-3"><p className="text-sm leading-relaxed text-slate-700">{comment.body}</p><footer className="mt-2 text-xs font-semibold text-slate-500">{comment.display_name} · {dateFor(comment.created_at)}</footer></blockquote>) : <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{t('अहिलेसम्म स्वीकृत टिप्पणी छैन। तपाईं पहिलो बन्नुहोस्।', 'No approved comments yet. Start the conversation.')}</p>}</div></div>
            <form onSubmit={(e) => submitComment(e, paper)} className="space-y-3"><h4 className="font-bold text-slate-900">{t('आफ्नो विचार लेख्नुहोस्', 'Share a comment')}</h4><input className={input} maxLength="100" placeholder={t('नाम (वैकल्पिक)', 'Name (optional)')} value={commentForm.display_name} onChange={(e) => setCommentForm((f) => ({ ...f, display_name: e.target.value }))}/><textarea required minLength="10" maxLength="3000" rows="4" className={input} placeholder={t('विषयसँग सम्बन्धित र सम्मानजनक टिप्पणी लेख्नुहोस्…', 'Write a respectful, on-topic comment…')} value={commentForm.body} onChange={(e) => setCommentForm((f) => ({ ...f, body: e.target.value }))}/><p className="text-xs text-slate-500">{t('टिप्पणी संयोजकको स्वीकृतिपछि मात्र देखिन्छ।', 'Comments appear after moderator approval.')}</p><button className={primary} disabled={busy}><Send size={15}/>{t('टिप्पणी पठाउनुहोस्', 'Submit comment')}</button></form>
          </div>}
        </article>) : <div className={card}><p className="font-semibold text-slate-900">{loading ? t('अनुसन्धान खोज्दै…', 'Loading research…') : t('प्रकाशित अनुसन्धान लेख थपिँदैछन्।', 'Published research papers will appear here.')}</p><p className="mt-1 text-sm text-slate-600">{t('प्राविधिक अधिकृत वा अनुसन्धानकर्ताले समीक्षा प्रक्रियामार्फत लेख पठाउन सक्छन्।', 'Technical officers and researchers can submit papers for editorial review.')}</p></div>}
      </section>}

      {tab === 'training' && <section className="space-y-4">
        <div className="space-y-4">
          {showFarmGame
            ? <Suspense fallback={<p role="status" className={`${card} text-sm text-slate-600`}>{t('खेल लोड हुँदैछ…', 'Loading game…')}</p>}><MyFarmGame onBack={closeFarmGame}/></Suspense>
            : <Suspense fallback={<p role="status" className={`${card} text-sm text-slate-600`}>{t('खेल सूची लोड हुँदैछ…', 'Loading Game Hub…')}</p>}><GamesHub onPlay={openFarmGame}/></Suspense>}
        </div>
        {!showFarmGame && !courseDetail && can('learning.create') && <CourseAuthoring canCreate={can('learning.create')} showing={showCourseForm} setShowing={setShowCourseForm} form={courseForm} setForm={setCourseForm} onSubmit={createCourse} busy={busy} t={t}/>}
        {!showFarmGame && courseDetail && <div className="grid gap-3 md:grid-cols-2">{(can('learning.update') || can('learning.publish')) && <CourseLessonAuthoring canEdit={can('learning.update')} canPublish={can('learning.publish')} published={courseDetail.course.status === 'published'} showing={showLessonForm} setShowing={setShowLessonForm} form={lessonForm} setForm={setLessonForm} onSubmit={addLesson} onPublish={publishCourse} busy={busy} t={t}/>}</div>}
        {!showFarmGame && (courseDetail ? <><button onClick={() => { setCourseId(null); setCourseDetail(null); }} className={secondary}><ArrowLeft size={16}/>{t('पाठ्यक्रम सूची', 'Course list')}</button><header className="rounded-3xl bg-gradient-to-br from-sky-950 to-emerald-900 p-6 text-white"><p className="text-xs font-bold uppercase tracking-wider text-sky-200">{courseDetail.course.level} · {courseDetail.lessons.length} {t('पाठ', 'lessons')}</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">{titleFor(courseDetail.course)}</h2><p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-white/85">{courseDetail.course.description}</p>{can('learning.view') && (courseDetail.enrollment ? <div className="mt-4 flex items-center gap-3"><span>{courseDetail.enrollment.progress_percent}% {t('पूरा', 'complete')}</span><div className="h-2 w-40 overflow-hidden rounded bg-white/20"><div className="h-full bg-lime-300" style={{ width: `${courseDetail.enrollment.progress_percent}%` }}/></div></div> : <button onClick={enroll} disabled={busy} className="mt-4 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-950">{t('सिकाइमा दर्ता हुनुहोस्', 'Enroll in course')}</button>)}</header><div className="space-y-3">{courseDetail.lessons.map((lesson, index) => { const done = courseDetail.enrollment && courseDetail.enrollment.progress_percent >= Math.round(((index + 1) / courseDetail.lessons.length) * 100); const href = safeHref(lesson.content_url); return <article key={lesson.id} className={card}><div className="flex flex-wrap items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 font-bold text-emerald-900">{done ? <Check size={18}/> : index + 1}</span><div className="min-w-0 flex-1"><h3 className="font-bold text-slate-950">{labelFor(lesson)}</h3>{lesson.duration_minutes && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Clock3 size={13}/>{lesson.duration_minutes} {t('मिनेट', 'min')}</p>}{lesson.body && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{lesson.body}</p>}{href && <a href={href} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-900 underline">{t('पाठ सामग्री खोल्नुहोस्', 'Open lesson material')} <ArrowUpRight size={14}/></a>}</div>{courseDetail.enrollment && <button className={secondary} disabled={busy || done} onClick={() => completeLesson(index)}>{done ? t('पूरा भयो', 'Done') : t('पूरा भएको चिन्ह', 'Mark complete')}</button>}</div></article>; })}</div></> : <><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('आफ्नो गतिमा अध्ययन', 'Learn at your own pace')}</p><h2 className="mt-1 text-2xl font-bold text-slate-950">{t('अनलाइन पाठ्यक्रम तथा तालिम', 'Online courses & training')}</h2></div><label className="relative w-full sm:max-w-xs"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input className={`${input} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('पाठ्यक्रम खोज्नुहोस्', 'Search courses')}/></label></div>{filtered(courses, 'title_ne', 'title_en', 'description', 'level').length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered(courses, 'title_ne', 'title_en', 'description', 'level').map((course) => <button key={course.id} onClick={() => openCourse(course)} className={`${card} group text-left transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-md`}><div className="flex items-center justify-between"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold capitalize text-emerald-900">{course.level}</span><GraduationCap className="text-emerald-800"/></div><h3 className="mt-4 text-lg font-bold text-slate-950 group-hover:text-emerald-900">{titleFor(course)}</h3><p className="mt-2 line-clamp-3 min-h-[4rem] text-sm leading-relaxed text-slate-600">{course.description}</p><span className="mt-4 flex items-center justify-between text-sm font-semibold text-emerald-900"><span>{course.lesson_count} {t('पाठ', 'lessons')}</span><span>{t('सुरु गर्नुहोस्', 'Start learning')} →</span></span></button>)}</div> : <div className={card}><p className="font-semibold text-slate-900">{loading ? t('पाठ्यक्रम खोज्दै…', 'Loading courses…') : t('प्रकाशित पाठ्यक्रम तयारी हुँदैछन्।', 'Published courses are being prepared.')}</p><p className="mt-1 text-sm text-slate-600">{t('नयाँ पाठ्यक्रम प्रकाशित भएपछि यहीँ पढ्न र प्रगति राख्न सकिन्छ।', 'New courses will appear here for study and progress tracking.')}</p></div>}</>)}
      </section>}

      {tab === 'innovation' && <Suspense fallback={<p role="status" className={`${card} text-sm text-slate-600`}>{t('नवप्रवर्तन केन्द्र लोड हुँदैछ…', 'Loading innovation center…')}</p>}><AgriInnovationCenter/></Suspense>}

      {tab === 'library' && <section className="space-y-5">
        {isInternal && can('documents.view') && <div className="space-y-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('कार्यालय अभिलेख', 'Office archive')}</p><h2 className="mt-1 text-xl font-bold text-slate-950">{t('कागजात तथा प्रकाशन', 'Documents and publications')}</h2></div><Suspense fallback={<p role="status" className={`${card} text-sm text-slate-600`}>{t('डिजिटल पुस्तकालय लोड हुँदैछ…', 'Loading digital library…')}</p>}><Documents embedded/></Suspense></div>}
        {can('learning.create') && <ResourceAuthoring showing={showResourceForm} setShowing={setShowResourceForm} form={resourceForm} setForm={setResourceForm} onSubmit={createResource} busy={busy} canPublish={can('learning.publish')} t={t}/>}
        <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('सन्दर्भ सामग्री', 'Reference materials')}</p><h2 className="mt-1 text-2xl font-bold text-slate-950">{t('डिजिटल पुस्तकालय', 'Digital library')}</h2><p className="mt-2 max-w-3xl text-sm text-slate-600">{t('ऐन, फारम, कृषि बुलेटिन, पुस्तिका, भिडियो र प्रशिक्षण स्रोतहरू।', 'Acts, forms, agro-weather bulletins, manuals, videos and learning resources.')}</p></div>
        <div className="grid gap-5 lg:grid-cols-2"><section><h3 className="mb-3 flex items-center gap-2 font-bold"><FileText size={18} className="text-emerald-800"/>{t('सरकारी तथा प्राविधिक कागजात', 'Official & technical documents')}</h3><div className="space-y-3">{library.documents.map((doc) => { const href = safeHref(doc.file_path); return <article key={`doc-${doc.id}`} className={card}><div className="flex items-start justify-between gap-3"><div><span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">{doc.category}{doc.fiscal_year ? ` · ${doc.fiscal_year}` : ''}</span><h4 className="mt-1 font-bold text-slate-950">{labelFor(doc)}</h4></div>{href && <a aria-label={t('कागजात खोल्नुहोस्', 'Open document')} href={href} target="_blank" rel="noreferrer" className={secondary}><ArrowUpRight size={15}/></a>}</div></article>; })}{!library.documents.length && <p className={`${card} text-sm text-slate-600`}>{loading ? t('कागजात लोड हुँदैछन्…', 'Loading documents…') : t('सार्वजनिक कागजात थपिँदैछन्।', 'Public documents will appear here.')}</p>}</div></section>
        <section><h3 className="mb-3 flex items-center gap-2 font-bold"><BookOpen size={18} className="text-emerald-800"/>{t('अध्ययन तथा मल्टिमिडिया', 'Study & multimedia')}</h3><div className="space-y-3">{library.resources.map((resource) => { const href = safeHref(resource.url || resource.file_path); return <article key={`res-${resource.id}`} className={card}><span className="text-[11px] font-bold uppercase tracking-wider text-sky-800">{resource.resource_type}</span><h4 className="mt-1 font-bold text-slate-950">{labelFor(resource)}</h4>{resource.description && <p className="mt-2 text-sm leading-relaxed text-slate-600">{resource.description}</p>}{href && <a href={href} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-900 underline">{t('स्रोत खोल्नुहोस्', 'Open resource')} <ArrowUpRight size={14}/></a>}</article>; })}{!library.resources.length && <p className={`${card} text-sm text-slate-600`}>{loading ? t('सिकाइ स्रोत लोड हुँदैछन्…', 'Loading learning resources…') : t('प्रकाशित अध्ययन स्रोत थपिँदैछन्।', 'Published learning resources will appear here.')}</p>}</div></section></div>
        <aside className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-relaxed text-sky-950"><strong>{t('स्रोतको श्रेय', 'Source credit')}</strong><p className="mt-1">{t('बाह्य सरकारी तथा अनुसन्धान साइटका सामग्री तिनकै मूल पृष्ठमा खुल्छन्। लेखको लेखक र मूल प्रकाशनलाई श्रेय दिनुहोस्।', 'External government and research materials open at their original source. Credit each author and original publication.')}</p></aside>
      </section>}

      {tab === 'research' && isInternal && can('research.view') && <section className="space-y-4">
        <Suspense fallback={<p role="status" className={`${card} text-sm text-slate-600`}>{t('अनुसन्धान केन्द्र लोड हुँदैछ…', 'Loading research center…')}</p>}><ResearchLab/></Suspense>
      </section>}

      {tab === 'forum' && can('knowledge.discuss') && <section className="space-y-4">
        <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('कास्की कृषि प्राविधिक सञ्जाल', 'Kaski technical network')}</p><h2 className="mt-1 text-2xl font-bold text-slate-950">{t('अधिकृत छलफल तथा सन्देश', 'Officer discussions & chat')}</h2><p className="mt-2 text-sm text-slate-600">{t('यो खण्ड कृषि कार्यालयका अधिकृत तथा प्राविधिक प्रयोगकर्ताका लागि हो। कृषकको व्यक्तिगत विवरण वा गोप्य लगइन सूचना पोस्ट नगर्नुहोस्।', 'This space is for authorized agriculture officers and technicians. Do not post farmers’ personal data or confidential login details.')}</p></div>
        <div className="grid gap-4 lg:grid-cols-[.75fr_1.25fr]">
          <div className="space-y-3"><form onSubmit={createDiscussion} className={`${card} space-y-3`}><h3 className="font-bold">{t('नयाँ प्राविधिक छलफल', 'Start a technical discussion')}</h3><input className={input} required maxLength="255" placeholder={t('विषय शीर्षक', 'Discussion title')} value={discussionForm.title} onChange={(e) => setDiscussionForm((f) => ({ ...f, title: e.target.value }))}/><input className={input} maxLength="100" placeholder={t('विषय वर्ग (जस्तै: माटो)', 'Topic (e.g. soil)')} value={discussionForm.topic} onChange={(e) => setDiscussionForm((f) => ({ ...f, topic: e.target.value }))}/><button className={primary} disabled={busy}><Plus size={16}/>{t('छलफल सुरु गर्नुहोस्', 'Start discussion')}</button></form>
            <div className="space-y-2">{discussions.map((d) => <button key={d.id} onClick={() => setActiveDiscussion(d.id)} className={`w-full rounded-xl border p-3 text-left transition ${activeDiscussion === d.id ? 'border-emerald-700 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300'}`}><span className="flex items-center justify-between gap-2"><strong className="text-sm text-slate-950">{d.title}</strong><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${d.status === 'open' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'}`}>{d.status}</span></span><span className="mt-1 block text-xs text-slate-500">{d.topic || t('सामान्य', 'General')} · {d.message_count} {t('सन्देश', 'messages')}</span></button>)}{!discussions.length && <p className={`${card} text-sm text-slate-600`}>{t('कुनै छलफल सुरु भएको छैन।', 'No discussions yet.')}</p>}</div>
          </div>
          <article className={`${card} flex min-h-[420px] flex-col`}>
            {activeDiscussion ? <><div className="border-b border-slate-200 pb-3"><h3 className="font-bold text-slate-950">{discussions.find((d) => d.id === activeDiscussion)?.title}</h3><p className="mt-1 text-xs text-slate-500">{t('सन्देश केवल अधिकृत छलफल समूहमा देखिन्छन्।', 'Messages are visible to authorized staff only.')}</p></div><div className="flex-1 space-y-3 overflow-y-auto py-4">{messages.map((message) => <div key={message.id} className={`max-w-[92%] rounded-2xl p-3 ${message.sender_id === user?.id ? 'ml-auto bg-emerald-100 text-emerald-950' : 'bg-slate-100 text-slate-800'}`}><p className="text-xs font-bold">{message.sender_name}</p><p className="mt-1 whitespace-pre-line text-sm">{message.body}</p><p className="mt-2 text-right text-[10px] opacity-60">{dateFor(message.created_at)}</p></div>)}{!messages.length && <p className="text-sm text-slate-500">{t('सुरक्षित सन्देशहरू यहाँ देखिनेछन्।', 'Staff messages will appear here.')}</p>}</div><form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-200 pt-3"><textarea className={`${input} min-h-11 resize-y`} rows="2" required maxLength="5000" placeholder={t('सन्देश लेख्नुहोस्…', 'Write a message…')} value={messageBody} onChange={(e) => setMessageBody(e.target.value)}/><button aria-label={t('सन्देश पठाउनुहोस्', 'Send message')} className={primary} disabled={busy}><Send size={17}/></button></form></> : <div className="m-auto max-w-sm text-center text-slate-500"><MessageCircle className="mx-auto text-emerald-800" size={32}/><h3 className="mt-3 font-bold text-slate-800">{t('छलफल छान्नुहोस्', 'Select a discussion')}</h3><p className="mt-1 text-sm">{t('कुनै विषय छान्नुहोस् वा नयाँ प्राविधिक छलफल सुरु गर्नुहोस्।', 'Choose a thread or start a new technical discussion.')}</p></div>}
          </article>
        </div>
      </section>}

      {tab === 'submit' && can('knowledge.create') && <section className="mx-auto max-w-4xl space-y-4">
        <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('ज्ञान साझा गर्नुहोस्', 'Contribute evidence')}</p><h2 className="mt-1 text-2xl font-bold text-slate-950">{t('अनुसन्धान लेख बुझाउनुहोस्', 'Submit a research paper')}</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">{t('शीर्षक, लेखक र सारांश भर्नुहोस्। सम्पादकले जाँच गरेपछि मात्र लेख सार्वजनिक हुनेछ; प्रकाशनको स्रोत वा DOI दिनुहोस्।', 'Add the title, authors and abstract. An editor must review it before publication; include the original source or DOI when available.')}</p></div>
        <form onSubmit={submitPaper} className={`${card} grid gap-4 sm:grid-cols-2`}><label className="space-y-1 text-sm font-semibold sm:col-span-2">{t('लेख शीर्षक', 'Paper title')}<input required maxLength="300" className={input} value={paperForm.title} onChange={(e) => setPaperForm((f) => ({ ...f, title: e.target.value }))}/></label><label className="space-y-1 text-sm font-semibold">{t('लेखकको नाम', 'Author names')}<input required maxLength="500" className={input} value={paperForm.author_names} onChange={(e) => setPaperForm((f) => ({ ...f, author_names: e.target.value }))}/></label><label className="space-y-1 text-sm font-semibold">{t('संस्था वा आबद्धता', 'Affiliation')}<input maxLength="300" className={input} value={paperForm.affiliation} onChange={(e) => setPaperForm((f) => ({ ...f, affiliation: e.target.value }))}/></label><label className="space-y-1 text-sm font-semibold">{t('विषय', 'Topic')}<select className={input} value={paperForm.topic} onChange={(e) => setPaperForm((f) => ({ ...f, topic: e.target.value }))}><option value="">{t('विषय छान्नुहोस्', 'Select a topic')}</option>{TOPICS.map((topic) => <option key={topic} value={topic}>{topic}</option>)}</select></label><label className="space-y-1 text-sm font-semibold">{t('प्रकाशन वर्ष', 'Publication year')}<input type="number" min="1900" max="2100" className={input} value={paperForm.publication_year} onChange={(e) => setPaperForm((f) => ({ ...f, publication_year: e.target.value }))}/></label><label className="space-y-1 text-sm font-semibold sm:col-span-2">{t('सारांश', 'Abstract')}<textarea required minLength="30" maxLength="10000" rows="6" className={input} value={paperForm.abstract} onChange={(e) => setPaperForm((f) => ({ ...f, abstract: e.target.value }))}/></label><label className="space-y-1 text-sm font-semibold">DOI<input maxLength="150" className={input} placeholder="10.xxxx/xxxxx" value={paperForm.doi} onChange={(e) => setPaperForm((f) => ({ ...f, doi: e.target.value }))}/></label><label className="space-y-1 text-sm font-semibold">{t('शब्दसूची', 'Keywords')}<input maxLength="500" className={input} value={paperForm.keywords} onChange={(e) => setPaperForm((f) => ({ ...f, keywords: e.target.value }))}/></label><label className="space-y-1 text-sm font-semibold sm:col-span-2">{t('पूरा लेख वा मूल स्रोतको URL', 'Full text or original source URL')}<input type="url" maxLength="500" className={input} placeholder="https://" value={paperForm.full_text_url} onChange={(e) => setPaperForm((f) => ({ ...f, full_text_url: e.target.value }))}/></label><div className="sm:col-span-2"><button className={primary} disabled={busy}><Send size={16}/>{t('सम्पादकीय समीक्षामा पठाउनुहोस्', 'Submit for editorial review')}</button></div></form>
        {can('knowledge.view') && <section className="space-y-2"><h3 className="font-bold">{t('मेरो लेखको अवस्था', 'My submissions')}</h3><MyPaperList t={t} dateFor={dateFor}/></section>}
      </section>}

      {tab === 'review' && can('knowledge.publish') && <section className="space-y-6">
        <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('सम्पादकीय जिम्मेवारी', 'Editorial workspace')}</p><h2 className="mt-1 text-2xl font-bold text-slate-950">{t('लेख र टिप्पणी समीक्षा', 'Review papers & comments')}</h2><p className="mt-2 text-sm text-slate-600">{t('स्रोत र दाबी जाँचेर प्रकाशित गर्नुहोस्। अनुपयुक्त सामग्री अस्वीकार गर्दा आवश्यक भए कारण लेख्नुहोस्।', 'Check sources and claims before publishing. Add a reason when returning unsuitable material.')}</p></div>
        <div className="space-y-3"><h3 className="flex items-center gap-2 text-lg font-bold"><FileText size={18}/>{t('प्रकाशनका लागि लेख', 'Papers awaiting review')} <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{paperQueue.length}</span></h3>{paperQueue.map((paper) => <article key={paper.id} className={card}><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-lg font-bold">{paper.title}</h4><p className="mt-1 text-sm text-slate-600">{paper.author_names}{paper.affiliation ? ` · ${paper.affiliation}` : ''} · {dateFor(paper.created_at)}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">{t('समीक्षा बाँकी', 'Pending')}</span></div><p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{paper.abstract}</p>{paper.doi && <p className="mt-2 text-xs">DOI: {paper.doi}</p>}{safeHref(paper.full_text_url) && <a className="mt-2 inline-flex text-sm font-semibold text-emerald-900 underline" href={safeHref(paper.full_text_url)} target="_blank" rel="noreferrer">{t('मूल लेख जाँच्नुहोस्', 'Check source')} ↗</a>}<div className="mt-4 flex flex-wrap gap-2"><button className={primary} disabled={busy} onClick={() => reviewPaper(paper, 'published')}><Check size={16}/>{t('प्रकाशित गर्नुहोस्', 'Publish')}</button><button className={secondary} disabled={busy} onClick={() => reviewPaper(paper, 'rejected')}><X size={16}/>{t('अस्वीकार गर्नुहोस्', 'Reject')}</button></div></article>)}{!paperQueue.length && <p className={`${card} text-sm text-slate-600`}>{t('समीक्षाका लागि लेख छैन।', 'No papers are awaiting review.')}</p>}</div>
        <div className="space-y-3"><h3 className="flex items-center gap-2 text-lg font-bold"><MessageCircle size={18}/>{t('स्वीकृतिका लागि टिप्पणी', 'Comments awaiting moderation')} <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{commentQueue.length}</span></h3>{commentQueue.map((comment) => <article key={comment.id} className={card}><p className="text-xs font-bold uppercase text-emerald-800">{comment.paper_title}</p><blockquote className="mt-2 text-sm leading-relaxed text-slate-800">“{comment.body}”</blockquote><p className="mt-2 text-xs text-slate-500">{comment.display_name} · {dateFor(comment.created_at)}</p><div className="mt-3 flex gap-2"><button className={primary} disabled={busy} onClick={() => moderateComment(comment, 'approved')}><Check size={15}/>{t('स्वीकृत', 'Approve')}</button><button className={secondary} disabled={busy} onClick={() => moderateComment(comment, 'rejected')}><X size={15}/>{t('अस्वीकार', 'Reject')}</button></div></article>)}{!commentQueue.length && <p className={`${card} text-sm text-slate-600`}>{t('जाँच गर्न बाँकी टिप्पणी छैन।', 'No comments awaiting moderation.')}</p>}</div>
      </section>}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><ShieldCheck size={14}/>{t('टिप्पणी संयोजन र कर्मचारी पहुँच सुरक्षित', 'Moderated comments · staff-only forum')}</span><span>{t('मूल स्रोत र अध्ययन सीमालाई सधैँ श्रेय दिनुहोस्।', 'Always credit original sources and note study limitations.')}</span></footer>
      </div>
    </main>
  );
}

function MyPaperList({ t, dateFor }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let current = true;
    api.get('/content/papers/mine').then((r) => { if (current) setRows(r.data); }).catch(() => {});
    return () => { current = false; };
  }, []);
  if (!rows.length) return <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">{t('अहिलेसम्म लेख पठाइएको छैन।', 'No submissions yet.')}</p>;
  return <div className="space-y-2">{rows.map((paper) => <article key={paper.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{paper.title}</strong><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize">{paper.status}</span></div><p className="mt-1 text-xs text-slate-500">{dateFor(paper.created_at)}{paper.review_note ? ` · ${paper.review_note}` : ''}</p></article>)}</div>;
}

function CourseAuthoring({ canCreate, showing, setShowing, form, setForm, onSubmit, busy, t }) {
  if (!canCreate) return null;
  return <article className={card}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-950">{t('नयाँ अनलाइन पाठ्यक्रम', 'Create an online course')}</h3><p className="mt-1 text-sm text-slate-600">{t('पाठ तयार गरेपछि सम्पादकीय स्वीकृतिबाट प्रकाशित गर्नुहोस्।', 'Add lessons, then publish the course for learners.')}</p></div><button className={secondary} onClick={() => setShowing((v) => !v)}><Plus size={16}/>{showing ? t('बन्द गर्नुहोस्', 'Close') : t('पाठ्यक्रम बनाउनुहोस्', 'New course')}</button></div>{showing && <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2"><input className={input} required maxLength="255" placeholder={t('शीर्षक (अंग्रेजी)', 'Title')} value={form.title_en} onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}/><input className={input} maxLength="255" placeholder={t('नेपाली शीर्षक', 'Nepali title')} value={form.title_ne} onChange={(e) => setForm((f) => ({ ...f, title_ne: e.target.value }))}/><select className={input} value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}>{['beginner', 'intermediate', 'advanced'].map((level) => <option key={level} value={level}>{level}</option>)}</select><textarea className={`${input} sm:col-span-2`} rows="3" maxLength="5000" placeholder={t('छोटो पाठ्यक्रम विवरण', 'Short course description')} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}/><button className={`${primary} w-fit`} disabled={busy}>{t('मस्यौदा सुरक्षित गर्नुहोस्', 'Save course draft')}</button></form>}</article>;
}

function CourseLessonAuthoring({ canEdit, canPublish, published, showing, setShowing, form, setForm, onSubmit, onPublish, busy, t }) {
  return <article className={`${card} space-y-3`}><div className="flex flex-wrap gap-2"><button className={secondary} onClick={() => setShowing((v) => !v)} disabled={!canEdit}><Plus size={15}/>{showing ? t('पाठ फारम बन्द', 'Close lesson form') : t('पाठ थप्नुहोस्', 'Add lesson')}</button>{canPublish && !published && <button className={primary} disabled={busy} onClick={onPublish}><BadgeCheck size={15}/>{t('पाठ्यक्रम प्रकाशित गर्नुहोस्', 'Publish course')}</button>}{published && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900"><BadgeCheck size={15}/>{t('प्रकाशित', 'Published')}</span>}</div>{showing && canEdit && <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2"><input required maxLength="255" className={input} placeholder={t('पाठ शीर्षक', 'Lesson title')} value={form.title_en} onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}/><input maxLength="255" className={input} placeholder={t('नेपाली शीर्षक', 'Nepali title')} value={form.title_ne} onChange={(e) => setForm((f) => ({ ...f, title_ne: e.target.value }))}/><textarea required maxLength="10000" rows="4" className={`${input} sm:col-span-2`} placeholder={t('पाठ सामग्री', 'Lesson content')} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}/><input type="number" min="1" max="65535" className={input} placeholder={t('समय (मिनेट)', 'Duration in minutes')} value={form.duration_minutes} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}/><button className={`${primary} w-fit`} disabled={busy}>{t('पाठ सुरक्षित गर्नुहोस्', 'Save lesson')}</button></form>}</article>;
}

function ResourceAuthoring({ showing, setShowing, form, setForm, onSubmit, busy, canPublish, t }) {
  return <article className={card}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-950">{t('पुस्तकालयमा स्रोत थप्नुहोस्', 'Add a library resource')}</h3><p className="mt-1 text-sm text-slate-600">{t('पुस्तिका, भिडियो वा आधिकारिक सामग्रीको मूल लिंक राख्नुहोस्।', 'Add an original link to a manual, video or official resource.')}</p></div><button className={secondary} onClick={() => setShowing((v) => !v)}><Plus size={16}/>{showing ? t('बन्द गर्नुहोस्', 'Close') : t('स्रोत थप्नुहोस्', 'Add resource')}</button></div>{showing && <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2"><input required maxLength="255" className={input} placeholder={t('स्रोत शीर्षक', 'Resource title')} value={form.title_en} onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}/><input maxLength="255" className={input} placeholder={t('नेपाली शीर्षक', 'Nepali title')} value={form.title_ne} onChange={(e) => setForm((f) => ({ ...f, title_ne: e.target.value }))}/><select className={input} value={form.resource_type} onChange={(e) => setForm((f) => ({ ...f, resource_type: e.target.value }))}>{['video', 'manual', 'faq', 'material', 'other'].map((type) => <option key={type} value={type}>{type}</option>)}</select><input type="url" maxLength="500" className={input} placeholder="https://" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}/><textarea className={`${input} sm:col-span-2`} rows="2" maxLength="5000" placeholder={t('छोटो विवरण', 'Short description')} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}/><button className={`${primary} w-fit`} disabled={busy}>{canPublish ? t('स्रोत प्रकाशित गर्नुहोस्', 'Publish resource') : t('स्रोत समीक्षा लागि सुरक्षित गर्नुहोस्', 'Save for review')}</button></form>}</article>;
}

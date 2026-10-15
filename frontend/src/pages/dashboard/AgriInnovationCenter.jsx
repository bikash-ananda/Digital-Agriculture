import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Beaker, CheckCircle2, CloudSun, Cpu, Droplets, Leaf, Lightbulb, MapPin, Send, ShieldCheck, Sprout, Tractor } from 'lucide-react';
import api from '../../services/api';
import useLang from '../../utils/useLang';
import { useAuth } from '../../context/useAuth';

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const field = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100';
const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50';
const tracks = [
  { id: 'climate_smart', icon: CloudSun, ne: 'जलवायु-स्मार्ट खेती', en: 'Climate-smart farming', bodyNe: 'बदलिँदो मौसममा बालीको जोखिम घटाउने स्थानीय उपाय।', bodyEn: 'Local ways to reduce crop risk as weather patterns shift.' },
  { id: 'water_soil', icon: Droplets, ne: 'माटो र पानी', en: 'Soil and water', bodyNe: 'सिँचाइ, माटोको स्वास्थ्य र पोषक तत्त्वको प्रभावकारी व्यवस्थापन।', bodyEn: 'Better irrigation, soil health and nutrient management.' },
  { id: 'crop_health', icon: Leaf, ne: 'बाली स्वास्थ्य', en: 'Crop health', bodyNe: 'एकीकृत रोगकिरा व्यवस्थापन र सुरक्षित उत्पादन अभ्यास।', bodyEn: 'Integrated pest management and safer production practices.' },
  { id: 'post_harvest', icon: Tractor, ne: 'बालीपछिको मूल्य', en: 'Post-harvest value', bodyNe: 'भण्डारण, प्रशोधन र बजारसम्म उत्पादन पुर्‍याउने नयाँ तरिका।', bodyEn: 'New approaches to storage, processing and getting produce to market.' },
  { id: 'digital', icon: Cpu, ne: 'डिजिटल कृषि', en: 'Digital agriculture', bodyNe: 'कृषकलाई उपयोगी बनाउने डाटा, सेन्सर र डिजिटल सेवा।', bodyEn: 'Useful data, sensors and digital services designed around farmers.' },
  { id: 'other', icon: Beaker, ne: 'अन्य नवीन सोच', en: 'Other new ideas', bodyNe: 'कास्कीको खेती प्रणाली सुधार्ने कुनै पनि परीक्षणयोग्य सोच।', bodyEn: 'Any practical, testable idea that can improve farming in Kaski.' }
];

const statusKeys = ['submitted', 'reviewing', 'pilot', 'showcase', 'declined'];
const statusLabel = (status, t) => ({
  submitted: t('पेश गरिएको', 'Submitted'),
  reviewing: t('Хянагдаж байна', 'Under review'),
  pilot: t('मैदानी परीक्षण', 'Field pilot'),
  showcase: t('नवप्रवर्तन प्रदर्शनी', 'Featured innovation'),
  declined: t('यस चरणमा छनोट भएन', 'Not selected this round')
}[status] || status);

export default function AgriInnovationCenter() {
  const { t } = useLang();
  const { user } = useAuth();
  const permissions = user?.permissions || [];
  const canView = permissions.includes('knowledge.view');
  const canSubmit = canView;
  const canReview = permissions.includes('knowledge.publish');
  const formRef = useRef(null);
  const [showcases, setShowcases] = useState([]);
  const [myIdeas, setMyIdeas] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewStatuses, setReviewStatuses] = useState({});
  const [reviewNotes, setReviewNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ title: '', category: 'climate_smart', problem: '', solution: '', crops: '', location: '', expected_impact: '' });

  const loadData = useCallback(async () => {
    const requests = [api.get('/content/public/innovations')];
    if (canView) requests.push(api.get('/content/innovations/mine'));
    if (canReview) requests.push(api.get('/content/innovations/manage'));
    const results = await Promise.allSettled(requests);
    let index = 0;
    if (results[index].status === 'fulfilled') setShowcases(results[index].value.data);
    else setError(t('नवप्रवर्तनका सार्वजनिक सामग्री लोड भएन।', 'Could not load featured innovations.'));
    index += 1;
    if (canView) {
      if (results[index].status === 'fulfilled') setMyIdeas(results[index].value.data);
      index += 1;
    }
    if (canReview && results[index]?.status === 'fulfilled') setReviewQueue(results[index].value.data);
    setLoading(false);
  }, [canReview, canView, t]);

  useEffect(() => {
    let active = true;
    loadData().catch(() => { if (active) setError(t('नवप्रवर्तन केन्द्र लोड भएन।', 'The innovation center could not load.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadData]);

  const submitIdea = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post('/content/innovations', form);
      setForm({ title: '', category: 'climate_smart', problem: '', solution: '', crops: '', location: '', expected_impact: '' });
      await loadData();
      setNotice(t('तपाईंको विचार प्राविधिक समीक्षाका लागि पठाइयो।', 'Your idea was submitted for technical review.'));
    } catch (e) {
      setError(e.response?.data?.message || t('विचार पठाउन सकेन। फेरि प्रयास गर्नुहोस्।', 'Could not submit your idea. Please try again.'));
    } finally { setBusy(false); }
  };

  const reviewIdea = async (idea) => {
    setBusy(true);
    setError('');
    setNotice('');
    const status = reviewStatuses[idea.id] || idea.status;
    try {
      await api.put(`/content/innovations/${idea.id}/review`, { status, review_note: reviewNotes[idea.id] || '' });
      await loadData();
      setNotice(t('नवप्रवर्तनको समीक्षा सुरक्षित भयो।', 'Innovation review saved.'));
    } catch (e) {
      setError(e.response?.data?.message || t('समीक्षा सुरक्षित भएन।', 'Could not save the review.'));
    } finally { setBusy(false); }
  };

  const statusTone = (status) => status === 'showcase' ? 'bg-emerald-100 text-emerald-900' : status === 'declined' ? 'bg-slate-100 text-slate-700' : status === 'pilot' ? 'bg-sky-100 text-sky-900' : 'bg-amber-100 text-amber-900';
  const categoryLabel = (category) => {
    const track = tracks.find((item) => item.id === category);
    return track ? t(track.ne, track.en) : category;
  };

  return <div className="mx-auto max-w-7xl space-y-6 pb-8">
    <header className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-emerald-950 to-teal-800 p-6 text-white shadow-lg sm:p-8">
      <div className="pointer-events-none absolute -right-10 -top-16 -z-10 h-64 w-64 rounded-full border-[38px] border-white/5" />
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[.16em] text-lime-100"><Lightbulb size={15}/>{t('नयाँ सोच, स्थानीय समाधान', 'New ideas, local solutions')}</p>
          <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{t('कृषि नवप्रवर्तन केन्द्र', 'Agri Innovation Center')}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-emerald-50 sm:text-base">{t('कास्कीका खेतका चुनौतीलाई उपयोगी, परीक्षणयोग्य समाधानमा बदल्नुहोस्। विचार साझा गर्नुहोस्, प्राविधिक प्रतिक्रिया पाउनुहोस् र सम्भावित मैदानी परीक्षणको बाटो खोल्नुहोस्।', 'Turn real farming challenges in Kaski into practical, testable solutions. Share an idea, receive technical feedback and explore a path to a field pilot.')}</p>
        </div>
        <button type="button" onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 font-bold text-emerald-950 shadow-sm transition hover:bg-lime-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-emerald-950"><Lightbulb size={17}/>{t('आफ्नो विचार पठाउनुहोस्', 'Submit an idea')}<ArrowRight size={16}/></button>
      </div>
    </header>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

    <section aria-labelledby="innovation-pathways" className="space-y-3">
      <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('कास्कीका प्राथमिकता', 'Focus areas')}</p><h3 id="innovation-pathways" className="mt-1 text-xl font-bold text-slate-950">{t('कहाँबाट सुरु गर्ने?', 'Where could your idea help?')}</h3></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{tracks.map(({ id, icon: Icon, ne, en, bodyNe, bodyEn }) => <article key={id} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Icon size={20}/></span><h4 className="mt-3 font-bold text-slate-950">{t(ne, en)}</h4><p className="mt-1 text-sm leading-relaxed text-slate-600">{t(bodyNe, bodyEn)}</p></article>)}</div>
    </section>

    <section className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <aside className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <div className="flex items-center gap-2"><ShieldCheck size={19} className="text-sky-800"/><h3 className="font-bold text-sky-950">{t('विचारदेखि परीक्षणसम्म', 'From idea to field pilot')}</h3></div>
        <ol className="mt-4 space-y-4">{[
          [t('१. समस्या पहिचान', '1. Identify a problem'), t('कुन बाली, स्थान र सिजनमा चुनौती देखिन्छ भनेर स्पष्ट लेख्नुहोस्।', 'Describe the crop, place and season where the challenge occurs.')],
          [t('२. समाधान प्रस्ताव', '2. Propose a solution'), t('कसरी काम गर्छ र कुन स्रोत चाहिन्छ भन्ने व्यावहारिक विवरण दिनुहोस्।', 'Explain how it could work and what resources it may need.')],
          [t('३. प्राविधिक समीक्षा', '3. Technical review'), t('कार्यालयको प्राविधिक टोलीले सम्भाव्यता र सुरक्षा हेर्नेछ।', 'The technical team can assess feasibility and safety.')],
          [t('४. परीक्षण र सिकाइ', '4. Pilot and learn'), t('उपयुक्त ठहरिएका विचारलाई सानो मैदानी परीक्षणबाट मूल्याङ्कन गरिन्छ।', 'Suitable ideas can be evaluated through a small field pilot.')]
        ].map(([heading, body]) => <li key={heading} className="border-l-2 border-sky-300 pl-3"><strong className="text-sm text-sky-950">{heading}</strong><p className="mt-1 text-sm leading-relaxed text-sky-900/80">{body}</p></li>)}</ol>
        <p className="mt-4 rounded-xl bg-white/80 p-3 text-xs leading-relaxed text-sky-950">{t('पेश गरिएको विचार सार्वजनिक हुँदैन। समीक्षा टोलीले “प्रदर्शनी” मा राखेपछि मात्र शीर्षक र समाधान सार्वजनिक देखिनेछन्।', 'Submitted ideas stay private. Only ideas marked “Featured innovation” by reviewers appear publicly.')}</p>
      </aside>

      <div ref={formRef} className="scroll-mt-6">
        {canSubmit ? <form onSubmit={submitIdea} className={`${card} space-y-4`}>
          <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('आफ्नो अनुभव साझा गर्नुहोस्', 'Share your experience')}</p><h3 className="mt-1 text-xl font-bold text-slate-950">{t('नवप्रवर्तन प्रस्ताव', 'Innovation proposal')}</h3><p className="mt-1 text-sm text-slate-600">{t('विचार छोटो, स्पष्ट र खेतमा परीक्षण गर्न सकिने गरी लेख्नुहोस्।', 'Keep your idea clear, practical and testable in the field.')}</p></div>
          <label className="block space-y-1.5"><span className="text-sm font-semibold text-slate-800">{t('विचारको शीर्षक', 'Idea title')} *</span><input className={field} required maxLength="255" value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder={t('उदाहरण: कम पानीमा तरकारी सिँचाइ', 'e.g. Low-water irrigation for vegetables')}/></label>
          <label className="block space-y-1.5"><span className="text-sm font-semibold text-slate-800">{t('नवप्रवर्तन क्षेत्र', 'Innovation area')}</span><select className={field} value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))}>{tracks.map((track) => <option key={track.id} value={track.id}>{t(track.ne, track.en)}</option>)}</select></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-1.5"><span className="text-sm font-semibold text-slate-800">{t('समस्या वा आवश्यकता', 'Problem or need')} *</span><textarea className={field} required minLength="20" maxLength="4000" rows="4" value={form.problem} onChange={(e) => setForm((current) => ({ ...current, problem: e.target.value }))} placeholder={t('खेतमा देखिएको समस्या र यसले कसलाई असर गर्छ?', 'What is happening in the field, and who is affected?')}/></label><label className="block space-y-1.5"><span className="text-sm font-semibold text-slate-800">{t('प्रस्तावित समाधान', 'Proposed solution')} *</span><textarea className={field} required minLength="20" maxLength="4000" rows="4" value={form.solution} onChange={(e) => setForm((current) => ({ ...current, solution: e.target.value }))} placeholder={t('तपाईंको उपाय कसरी काम गर्छ?', 'How would your approach work?')}/></label></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-1.5"><span className="text-sm font-semibold text-slate-800">{t('बाली वा उत्पादन', 'Crop or product')}</span><input className={field} maxLength="300" value={form.crops} onChange={(e) => setForm((current) => ({ ...current, crops: e.target.value }))} placeholder={t('जस्तै: गोलभेँडा, कफी', 'e.g. tomato, coffee')}/></label><label className="block space-y-1.5"><span className="text-sm font-semibold text-slate-800">{t('स्थान', 'Location')}</span><span className="relative block"><MapPin size={16} className="absolute left-3 top-3 text-slate-400"/><input className={`${field} pl-9`} maxLength="180" value={form.location} onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))} placeholder={t('पालिका / वडा', 'Municipality / ward')}/></span></label></div>
          <label className="block space-y-1.5"><span className="text-sm font-semibold text-slate-800">{t('अपेक्षित लाभ', 'Expected benefit')}</span><textarea className={field} maxLength="2000" rows="2" value={form.expected_impact} onChange={(e) => setForm((current) => ({ ...current, expected_impact: e.target.value }))} placeholder={t('उत्पादन, लागत, श्रम वा वातावरणमा के सुधार आउन सक्छ?', 'What might improve for yields, cost, labor or the environment?')}/></label>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-xs text-slate-500">{t('यो प्रस्ताव समीक्षा टोली र तपाईंलाई मात्र देखिन्छ।', 'This proposal is visible to you and the review team.')}</p><button className={primary} disabled={busy}><Send size={16}/>{busy ? t('पठाउँदै…', 'Submitting…') : t('समीक्षाका लागि पठाउनुहोस्', 'Submit for review')}</button></div>
        </form> : <div className={`${card} flex h-full flex-col justify-center`}><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Lightbulb size={21}/></span><h3 className="mt-4 text-xl font-bold text-slate-950">{t('आफ्नो नवप्रवर्तन प्रस्ताव गर्नुहोस्', 'Propose an innovation')}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{user ? t('तपाईंको हालको भूमिका प्रस्ताव पेश गर्न अनुमति छैन। कृषि ज्ञान केन्द्र सामग्री व्यवस्थापकसँग पहुँच माग्नुहोस्।', 'Your current role cannot submit proposals. Ask a Knowledge Center content manager for access.') : t('खेतमा उपयोगी समाधानको प्रस्ताव पेश गर्न लगइन गर्नुहोस्।', 'Sign in to propose a solution that could help local farms.')}</p>{!user && <Link className={`${primary} mt-4 w-fit`} to="/login">{t('लगइन गर्नुहोस्', 'Sign in')}<ArrowRight size={16}/></Link>}</div>}
      </div>
    </section>

    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('प्राविधिक समीक्षापछि', 'After technical review')}</p><h3 className="mt-1 text-xl font-bold text-slate-950">{t('प्रदर्शित नवप्रवर्तन', 'Featured innovations')}</h3></div><span className="inline-flex items-center gap-1 text-xs text-slate-500"><CheckCircle2 size={14}/>{t('समीक्षा स्वीकृत भएपछि मात्र सार्वजनिक', 'Published after review')}</span></div>
      {showcases.length ? <div className="grid gap-4 md:grid-cols-2">{showcases.map((idea) => <article key={idea.id} className={card}><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">{categoryLabel(idea.category)}</span><h4 className="mt-3 text-lg font-bold text-slate-950">{idea.title}</h4><p className="mt-2 text-sm leading-relaxed text-slate-700">{idea.solution}</p><div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">{idea.crops && <span className="inline-flex items-center gap-1"><Sprout size={14}/>{idea.crops}</span>}{idea.location && <span className="inline-flex items-center gap-1"><MapPin size={14}/>{idea.location}</span>}</div></article>)}</div> : <div className={card}><p className="font-semibold text-slate-900">{loading ? t('नवप्रवर्तन खोज्दै…', 'Loading innovations…') : t('अहिलेसम्म सार्वजनिक नवप्रवर्तन छैन।', 'No featured innovations yet.')}</p><p className="mt-1 text-sm text-slate-600">{t('प्राविधिक समीक्षापछि स्वीकृत स्थानीय समाधान यहाँ देखिनेछन्।', 'Local solutions will appear here after technical review.')}</p></div>}
    </section>

    {canView && <section className="space-y-3">
      <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('तपाईंका प्रस्ताव', 'Your submissions')}</p><h3 className="mt-1 text-xl font-bold text-slate-950">{t('विचारको प्रगति', 'Idea progress')}</h3></div>
      {myIdeas.length ? <div className="space-y-3">{myIdeas.map((idea) => <article key={idea.id} className={`${card} flex flex-wrap items-start justify-between gap-4`}><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-bold text-slate-950">{idea.title}</h4><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(idea.status)}`}>{statusLabel(idea.status, t)}</span></div><p className="mt-2 text-sm text-slate-600">{idea.problem}</p>{idea.review_note && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><strong>{t('प्राविधिक प्रतिक्रिया', 'Technical feedback')}: </strong>{idea.review_note}</p>}</div><span className="text-xs text-slate-500">{idea.created_at ? new Date(idea.created_at).toLocaleDateString() : ''}</span></article>)}</div> : <div className={card}><p className="text-sm text-slate-600">{t('तपाईंले अहिलेसम्म विचार पेश गर्नुभएको छैन।', 'You have not submitted an idea yet.')}</p></div>}
    </section>}

    {canReview && <section className="space-y-3">
      <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('व्यवस्थापन', 'Management')}</p><h3 className="mt-1 text-xl font-bold text-slate-950">{t('समीक्षा कक्ष', 'Innovation review queue')}</h3></div>
      {reviewQueue.length ? <div className="space-y-4">{reviewQueue.map((idea) => <article key={idea.id} className={`${card} space-y-3`}><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase text-emerald-800">{categoryLabel(idea.category)} · {idea.submitter_name || t('कृषक / प्राविधिक', 'Farmer / technician')}</span><h4 className="mt-1 text-lg font-bold text-slate-950">{idea.title}</h4><p className="mt-2 text-sm text-slate-700"><strong>{t('समस्या', 'Problem')}: </strong>{idea.problem}</p><p className="mt-2 text-sm text-slate-700"><strong>{t('समाधान', 'Solution')}: </strong>{idea.solution}</p><p className="mt-2 text-xs text-slate-500">{idea.crops || '—'}{idea.location ? ` · ${idea.location}` : ''}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(idea.status)}`}>{statusLabel(idea.status, t)}</span></div><div className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]"><select aria-label={t('समीक्षा स्थिति', 'Review status')} className={field} value={reviewStatuses[idea.id] || idea.status} onChange={(e) => setReviewStatuses((current) => ({ ...current, [idea.id]: e.target.value }))}>{statusKeys.slice(1).map((status) => <option key={status} value={status}>{statusLabel(status, t)}</option>)}</select><input aria-label={t('समीक्षा टिप्पणी', 'Review note')} className={field} maxLength="5000" value={reviewNotes[idea.id] ?? idea.review_note ?? ''} onChange={(e) => setReviewNotes((current) => ({ ...current, [idea.id]: e.target.value }))} placeholder={t('समीक्षा टिप्पणी वा सुधार सुझाव', 'Review note or suggested next step')}/><button type="button" className={primary} disabled={busy} onClick={() => reviewIdea(idea)}>{t('समीक्षा सुरक्षित गर्नुहोस्', 'Save review')}</button></div></article>)}</div> : <div className={card}><p className="text-sm text-slate-600">{loading ? t('प्रस्ताव लोड हुँदैछन्…', 'Loading proposals…') : t('समीक्षा गर्न बाँकी प्रस्ताव छैन।', 'There are no proposals waiting for review.')}</p></div>}
    </section>}
  </div>;
}

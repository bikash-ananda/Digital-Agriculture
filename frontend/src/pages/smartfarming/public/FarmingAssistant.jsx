import { useEffect, useRef, useState } from 'react';
import { ArrowUp, LoaderCircle, Mic, MicOff, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import { Callout, PublicPage } from './common';
import { copy, field, surface } from './helpers';

export default function FarmingAssistant() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechSupported] = useState(() => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  const messagesEnd = useRef(null);
  const recognition = useRef(null);
  useEffect(() => {
    let active = true;
    api.get('/public-farming/status').then(({ data }) => { if (active) setStatus(data); }).catch(() => { if (active) setStatus({ assistant_configured: false }); });
    return () => { active = false; recognition.current?.abort?.(); window.speechSynthesis?.cancel(); };
  }, []);
  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);

  const send = async (event) => {
    event?.preventDefault();
    const content = question.trim();
    if (!content || busy || !status?.assistant_configured) return;
    const updated = [...messages, { role: 'user', content }].slice(-12);
    setMessages(updated);
    setQuestion('');
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/public-farming/assistant', { lang, messages: updated });
      setMessages((current) => [...current, { role: 'assistant', content: data.answer, sources: data.sources || [] }].slice(-12));
    } catch (cause) {
      const code = cause.response?.data?.code;
      setError(cause.response?.data?.message || (cause.response?.status === 503 ? copy(lang, 'The AI service is not configured or is temporarily unavailable.', 'एआई सेवा जडान भएको छैन वा अस्थायी रूपमा उपलब्ध छैन।') : copy(lang, 'The assistant could not answer this question. Please retry.', 'सहायकले उत्तर दिन सकेन। फेरि प्रयास गर्नुहोस्।')));
      if (code === 'AI_NOT_CONFIGURED') setStatus((current) => ({ ...current, assistant_configured: false }));
    } finally { setBusy(false); }
  };
  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    recognition.current?.abort?.();
    const instance = new SpeechRecognition();
    instance.lang = lang === 'ne' ? 'ne-NP' : 'en-US';
    instance.interimResults = false;
    instance.onresult = (event) => setQuestion((old) => `${old}${old ? ' ' : ''}${event.results?.[0]?.[0]?.transcript || ''}`);
    instance.onerror = () => setListening(false);
    instance.onend = () => setListening(false);
    recognition.current = instance;
    setListening(true);
    instance.start();
  };
  const speak = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'ne' ? 'ne-NP' : 'en-US';
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };
  const clear = () => { setMessages([]); setQuestion(''); setError(''); window.speechSynthesis?.cancel(); setSpeaking(false); };
  const configured = status?.assistant_configured;
  return <PublicPage eyebrow={copy(lang, 'ASK A FARMING QUESTION', 'कृषि प्रश्न सोध्नुहोस्')} title={copy(lang, 'AI Farming Assistant', 'कृषि एआई सहायक')} intro={copy(lang, 'Ask in Nepali or English. When enabled, the model runs on the application server and can use published Knowledge Center articles. No model credentials are sent to this browser.', 'नेपाली वा अंग्रेजीमा सोध्नुहोस्। सक्षम भएपछि मोडेल एप्लिकेसन सर्भरमै चल्छ र प्रकाशित ज्ञान केन्द्रका लेख प्रयोग गर्न सक्छ। मोडेलका प्रमाणपत्र ब्राउजरमा पठाइँदैन।')}>
    <div className="mx-auto max-w-4xl space-y-4">
      {!configured && <Callout title={copy(lang, 'AI service not connected', 'एआई सेवा जडान छैन')} tone="amber">{copy(lang, 'For server-local inference, enable the local-ai Compose profile and configure FARMING_AI_PROVIDER=ollama, FARMING_AI_MODEL, and FARMING_EMBEDDING_MODEL in the server environment. Keep AGRI_MCP_TOKEN private; MCP stays disabled until it is set.', 'सर्भरमै मोडेल चलाउन local-ai Compose profile सक्षम गरी सर्भर वातावरणमा FARMING_AI_PROVIDER=ollama, FARMING_AI_MODEL र FARMING_EMBEDDING_MODEL राख्नुहोस्। AGRI_MCP_TOKEN गोप्य राख्नुहोस्; यो नदिएसम्म MCP बन्द रहन्छ।')}</Callout>}
      <section className={`${surface} overflow-hidden`} aria-label={copy(lang, 'Farming assistant conversation', 'कृषि सहायक संवाद')}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white p-4 sm:px-5"><div><h2 className="font-bold text-slate-950">{copy(lang, 'Conversation', 'संवाद')}</h2><p className="text-xs text-slate-600">{copy(lang, 'Use simple language. Share crop, stage and location for context.', 'सरल भाषामा लेख्नुहोस्। बाली, अवस्था र स्थान उल्लेख गर्नुहोस्।')}</p></div><button type="button" onClick={clear} disabled={!messages.length && !question} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RotateCcw size={15} aria-hidden="true" />{copy(lang, 'Clear', 'मेटाउनुहोस्')}</button></div>
        <div className="max-h-[55vh] min-h-64 space-y-3 overflow-y-auto bg-slate-50 p-4 sm:p-5" aria-live="polite">
          {!messages.length && <div className="mx-auto flex min-h-52 max-w-md flex-col items-center justify-center text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-900">🌱</span><p className="mt-3 font-semibold text-slate-900">{copy(lang, 'What are you growing?', 'तपाईं के खेती गर्दै हुनुहुन्छ?')}</p><p className="mt-1 text-sm leading-6 text-slate-600">{copy(lang, 'Ask about crop planning, soil, irrigation, field observations or farm technology.', 'बाली योजना, माटो, सिँचाइ, खेत निरीक्षण वा कृषि प्रविधिबारे सोध्नुहोस्।')}</p></div>}
          {messages.map((message, index) => <article key={`${index}-${message.role}`} className={`max-w-[92%] rounded-2xl px-4 py-3 shadow-sm ${message.role === 'user' ? 'ml-auto bg-emerald-900 text-white' : 'mr-auto border border-slate-200 bg-white text-slate-900'}`}><div className="flex items-center justify-between gap-3"><p className={`text-[11px] font-bold uppercase tracking-wide ${message.role === 'user' ? 'text-emerald-100' : 'text-emerald-800'}`}>{message.role === 'user' ? copy(lang, 'You', 'तपाईं') : copy(lang, 'Assistant', 'सहायक')}</p>{message.role === 'assistant' && <button type="button" onClick={() => speak(message.content)} aria-label={copy(lang, 'Read answer aloud', 'उत्तर पढेर सुनाउनुहोस्')} className="grid min-h-9 min-w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Volume2 size={16} aria-hidden="true" /></button>}</div><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.content}</p>{message.sources?.length > 0 && <div className="mt-3 border-t border-slate-200 pt-2"><p className="text-[11px] font-bold text-slate-600">{copy(lang, 'Published sources', 'प्रकाशित स्रोत')}</p><ul className="mt-1 space-y-1">{message.sources.map((source) => <li key={`${source.kind}-${source.id}`} className="text-xs"><Link to="/knowledge?tab=library" className="text-emerald-900 underline underline-offset-2">{source.title}{source.crop ? ` · ${source.crop}` : ''}</Link></li>)}</ul></div>}</article>)}
          {busy && <div role="status" className="mr-auto flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-slate-600"><LoaderCircle size={17} className="animate-spin" aria-hidden="true" />{copy(lang, 'Preparing an answer…', 'उत्तर तयार हुँदैछ…')}</div>}
          <div ref={messagesEnd} />
        </div>
        {error && <div role="alert" className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 sm:mx-5">{error}<button type="button" onClick={send} disabled={busy || !status?.assistant_configured} className="ml-2 font-bold underline underline-offset-2">{copy(lang, 'Retry', 'फेरि प्रयास')}</button></div>}
        <form onSubmit={send} className="flex items-end gap-2 border-t border-slate-200 bg-white p-3 sm:p-4"><label className="sr-only" htmlFor="farming-question">{copy(lang, 'Your question', 'तपाईंको प्रश्न')}</label><textarea id="farming-question" rows="2" maxLength="2500" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={copy(lang, 'Type a farming question…', 'कृषिसम्बन्धी प्रश्न लेख्नुहोस्…')} className={`${field} min-h-[3.25rem] resize-y`} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event); } }} />
          {speechSupported && <button type="button" onClick={listening ? () => recognition.current?.stop() : startVoice} aria-label={listening ? copy(lang, 'Stop voice input', 'आवाज इनपुट रोक्नुहोस्') : copy(lang, 'Use voice input', 'आवाजबाट लेख्नुहोस्')} className={`grid min-h-11 min-w-11 place-items-center rounded-xl border ${listening ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{listening ? <MicOff size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}</button>}
          <button type="submit" disabled={!configured || !question.trim() || busy} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-emerald-900 text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40" aria-label={copy(lang, 'Send question', 'प्रश्न पठाउनुहोस्')}><ArrowUp size={19} aria-hidden="true" /></button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 text-[11px] text-slate-500 sm:px-5"><span>{speechSupported ? copy(lang, 'Voice input is processed by your browser.', 'आवाज इनपुट तपाईंको ब्राउजरले प्रशोधन गर्छ।') : copy(lang, 'Voice input is unavailable in this browser.', 'यस ब्राउजरमा आवाज इनपुट उपलब्ध छैन।')}</span>{speaking && <span className="inline-flex items-center gap-1"><VolumeX size={13} aria-hidden="true" />{copy(lang, 'Speaking', 'पढिँदैछ')}</span>}</div>
      </section>
      <p className="px-1 text-xs leading-5 text-slate-500">{copy(lang, 'Agricultural responses can be wrong or incomplete. Treat them as general information, never as verified local recommendations. For severe or uncertain crop problems, contact an agricultural technician.', 'कृषि सम्बन्धी उत्तर गलत वा अपूरो हुन सक्छ। यसलाई सामान्य जानकारी मान्नुहोस्, पुष्टि भएको स्थानीय सिफारिस होइन। गम्भीर वा अन्योलको बाली समस्यामा कृषि प्राविधिकलाई सम्पर्क गर्नुहोस्।')}</p>
    </div>
  </PublicPage>;
}

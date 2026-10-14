import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, Sprout, LoaderCircle } from 'lucide-react';
import api from '../../services/api';
import useLang from '../../utils/useLang';

const STORAGE_KEY = 'da-login-support-session';

function savedSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    return value?.id && value?.accessToken ? value : null;
  } catch { return null; }
}

export default function LoginSupportChat() {
  const { lang, t } = useLang();
  const [open, setOpen] = useState(false);
  const sessionRef = useRef(savedSession());
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [relayNotice, setRelayNotice] = useState('');
  const [whatsappReady, setWhatsappReady] = useState(null);
  const [sessionCode, setSessionCode] = useState('');
  const lastMessageId = useRef('0');
  const endOfMessages = useRef(null);
  const input = useRef(null);

  const labels = {
    title: t('सफ्टवेयर सहयोग', 'Developer support'),
    subtitle: t('साइन इन नगरी कुरा गर्नुहोस्', 'Chat without signing in'),
    welcome: t('नमस्कार! तपाईंलाई प्रणाली प्रयोग गर्न के सहयोग चाहिन्छ?', 'Hello! How can we help you use the platform?'),
    replies: t('डेभलपरको जवाफ यहीँ देखिनेछ। यो ट्याब खुला राख्नुहोस्।', 'Developer replies appear here. Keep this tab open.'),
    unavailable: t('वेबसाइटको WhatsApp सम्पर्क अहिले जडान भएको छैन। कृपया पछि फेरि प्रयास गर्नुहोस्।', 'The website chat is not connected to WhatsApp yet. Please try again later.'),
    placeholder: t('आफ्नो सन्देश लेख्नुहोस्…', 'Write a message…'),
    send: t('सन्देश पठाउनुहोस्', 'Send message'),
    open: t('डेभलपरसँग कुरा गर्नुहोस्', 'Chat with the developer'),
    close: t('च्याट बन्द गर्नुहोस्', 'Close chat'),
    sending: t('पठाउँदै…', 'Sending…'),
    loading: t('च्याट खोल्दै…', 'Opening chat…'),
    now: t('अहिले', 'Now'),
    support: t('सहयोग टोली', 'Support team'),
    you: t('तपाईं', 'You'),
    prompt: t('सन्देशहरू यहीँ देखिनेछन्।', 'Messages and replies stay here.')
  };

  const keepSession = (value) => {
    sessionRef.current = value;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* The session still works in memory. */ }
  };

  const ensureSession = useCallback(async () => {
    if (sessionRef.current) return sessionRef.current;
    const { data } = await api.post('/support-chat/conversations');
    const value = { id: data.id, accessToken: data.accessToken, shortCode: data.shortCode, whatsappReady: data.whatsappReady };
    keepSession(value);
    setWhatsappReady(Boolean(data.whatsappReady));
    setSessionCode(data.shortCode || '');
    return value;
  }, []);

  const fetchMessages = useCallback(async (activeSession) => {
    const { data } = await api.get(`/support-chat/conversations/${activeSession.id}/messages`, {
      headers: { 'x-support-token': activeSession.accessToken },
      params: { after: lastMessageId.current }
    });
    if (typeof data.whatsappReady === 'boolean') {
      setWhatsappReady(data.whatsappReady);
      const refreshed = { ...activeSession, whatsappReady: data.whatsappReady };
      sessionRef.current = refreshed;
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(refreshed)); } catch { /* The session still works in memory. */ }
    }
    if (!data.messages?.length) return;
    lastMessageId.current = data.messages[data.messages.length - 1].id;
    setMessages((current) => {
      const known = new Set(current.map((message) => message.id));
      return [...current, ...data.messages.filter((message) => !known.has(message.id) && known.add(message.id))];
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let stopped = false;
    let timer;
    const initialize = async () => {
      setLoading(true);
      setError('');
      try {
        const activeSession = await ensureSession();
        if (stopped) return;
        setWhatsappReady(Boolean(activeSession.whatsappReady));
        setSessionCode(activeSession.shortCode || '');
        await fetchMessages(activeSession);
        if (stopped) return;
        timer = window.setInterval(() => {
          fetchMessages(activeSession).catch(() => { /* A later poll retries a transient connection error. */ });
        }, 3000);
      } catch (cause) {
        if (!stopped) setError(cause.response?.data?.message || t('च्याट अहिले उपलब्ध छैन। सर्भर र डेटाबेस जाँच्नुहोस्।', 'Chat is unavailable right now. Check the server and database.'));
      } finally {
        if (!stopped) setLoading(false);
      }
    };
    initialize();
    return () => { stopped = true; if (timer) window.clearInterval(timer); };
  }, [open, ensureSession, fetchMessages, t]);

  useEffect(() => { endOfMessages.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending || whatsappReady !== true) return;
    setSending(true);
    setError('');
    try {
      const activeSession = await ensureSession();
      const { data } = await api.post(`/support-chat/conversations/${activeSession.id}/messages`, { body }, {
        headers: { 'x-support-token': activeSession.accessToken }
      });
      const sent = data.message;
      lastMessageId.current = sent.id;
      setMessages((current) => current.some((item) => item.id === sent.id) ? current : [...current, sent]);
      setRelayNotice(data.notification === 'sent' ? '' : labels.unavailable);
      setDraft('');
      if (input.current) input.current.focus();
    } catch (cause) {
      setError(cause.response?.data?.message || t('सन्देश पठाउन सकिएन। इन्टरनेट जाँचेर फेरि प्रयास गर्नुहोस्।', 'Could not send the message. Check your connection and try again.'));
    } finally { setSending(false); }
  };

  const openChat = () => {
    setOpen(true);
    window.setTimeout(() => input.current?.focus(), 120);
  };

  return (
    <>
      {open && <section className="fixed bottom-[9.5rem] right-4 z-[80] flex h-[min(38rem,calc(100dvh-11rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-terrace-200 bg-white shadow-2xl sm:right-6" aria-labelledby="support-chat-title" aria-live="polite">
        <header className="flex items-center gap-3 bg-terrace-900 px-4 py-4 text-white">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15"><Sprout size={22} aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <h2 id="support-chat-title" className="font-bold">{labels.title}</h2>
            <p className="text-xs text-white/80">{labels.subtitle}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="grid min-h-11 min-w-11 place-items-center rounded-full hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label={labels.close}><X size={20} aria-hidden="true" /></button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-gradient-to-b from-terrace-50 to-white p-4" role="log" aria-label={t('च्याट सन्देशहरू', 'Chat messages')} aria-relevant="additions text">
          <div className="max-w-[90%] self-start rounded-2xl rounded-tl-sm border border-terrace-100 bg-white px-3.5 py-3 text-sm text-terrace-900 shadow-sm">
            <p>{labels.welcome}</p>
            <p className="mt-2 text-xs leading-relaxed text-gray-600">{labels.replies}</p>
          </div>
          {sessionCode && <p className="self-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-terrace-700 shadow-sm">{t('सन्दर्भ', 'Reference')} #{sessionCode}</p>}
          {whatsappReady === false && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">{labels.unavailable}</p>}
          {relayNotice && whatsappReady !== false && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">{relayNotice}</p>}
          {messages.map((message) => {
            const fromVisitor = message.sender === 'visitor';
            return <div key={message.id} className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${fromVisitor ? 'self-end rounded-tr-sm bg-terrace-800 text-white' : 'self-start rounded-tl-sm border border-terrace-100 bg-white text-terrace-900'}`}>
              <p className="mb-1 text-[11px] font-semibold opacity-75">{fromVisitor ? labels.you : labels.support}</p>
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
              <time className="mt-1 block text-right text-[10px] opacity-70" dateTime={message.created_at}>{message.created_at ? new Date(/[zZ]|[+-]\d\d:\d\d$/.test(message.created_at) ? message.created_at : `${message.created_at.replace(' ', 'T')}Z`).toLocaleTimeString(lang === 'ne' ? 'ne-NP' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : labels.now}</time>
            </div>;
          })}
          {loading && <p className="flex items-center gap-2 self-center text-xs text-gray-600"><LoaderCircle size={15} className="animate-spin" aria-hidden="true" />{labels.loading}</p>}
          {!messages.length && !loading && <p className="self-center px-2 text-center text-xs text-gray-500">{labels.prompt}</p>}
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <div ref={endOfMessages} />
        </div>

        <form onSubmit={send} className="border-t border-terrace-100 bg-white p-3">
          <label htmlFor="login-support-message" className="sr-only">{labels.placeholder}</label>
          <div className="flex items-end gap-2">
            <textarea id="login-support-message" ref={input} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event); } }} rows={1} maxLength={2000} disabled={whatsappReady !== true} placeholder={whatsappReady === false ? t('WhatsApp च्याट जडान नभएसम्म उपलब्ध छैन', 'Available when WhatsApp chat is connected') : labels.placeholder} className="max-h-28 min-h-11 flex-1 resize-y rounded-2xl border border-terrace-200 bg-white px-3.5 py-3 text-sm text-terrace-900 outline-none focus:border-terrace-700 focus:ring-2 focus:ring-terrace-200 disabled:cursor-not-allowed disabled:bg-gray-100" />
            <button type="submit" disabled={!draft.trim() || sending || whatsappReady !== true} aria-label={labels.send} className="grid min-h-11 min-w-11 place-items-center rounded-full bg-terrace-800 text-white shadow-md transition hover:bg-terrace-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terrace-800 disabled:cursor-not-allowed disabled:opacity-50">
              {sending ? <LoaderCircle size={19} className="animate-spin" aria-hidden="true" /> : <Send size={19} aria-hidden="true" />}
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-gray-500">{t('Enter पठाउनुहोस् · Shift + Enter नयाँ लाइन', 'Enter to send · Shift + Enter for a new line')}</p>
        </form>
      </section>}

      <button type="button" onClick={open ? () => setOpen(false) : openChat} className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-[80] flex min-h-14 items-center gap-2 rounded-full bg-gov-blue px-4 text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gov-blue sm:right-6" aria-label={open ? labels.close : labels.open} aria-expanded={open}>
        {open ? <X size={21} aria-hidden="true" /> : <MessageCircle size={22} aria-hidden="true" />}
        <span className="font-semibold">{open ? t('बन्द', 'Close') : t('सहयोग', 'Chat')}</span>
      </button>
    </>
  );
}

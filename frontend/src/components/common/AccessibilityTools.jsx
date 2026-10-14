import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Accessibility, ArrowLeft, ArrowUp, Contrast, Minus, Plus, Volume2, X } from 'lucide-react';
import useLang from '../../utils/useLang';

const STORAGE_KEY = 'digital-agriculture-accessibility';
const DEFAULTS = { textScale: 100, highContrast: false, reduceMotion: false };

function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      textScale: [100, 115, 130].includes(saved.textScale) ? saved.textScale : DEFAULTS.textScale,
      highContrast: Boolean(saved.highContrast),
      reduceMotion: Boolean(saved.reduceMotion)
    };
  } catch {
    return DEFAULTS;
  }
}

export default function AccessibilityTools() {
  const { lang, t } = useLang();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [preferences, setPreferences] = useState(loadPreferences);
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [speechStatus, setSpeechStatus] = useState('');
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.textScale = String(preferences.textScale);
    root.dataset.highContrast = String(preferences.highContrast);
    root.dataset.reduceMotion = String(preferences.reduceMotion);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* Preferences still apply for this page. */ }
  }, [preferences]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        document.getElementById('accessibility-toggle')?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  const toggle = (key) => setPreferences((current) => ({ ...current, [key]: !current[key] }));
  const goBack = () => {
    const index = window.history.state?.idx;
    if (Number.isInteger(index) && index > 0) navigate(-1);
    else navigate(pathname.startsWith('/app') ? '/app' : '/');
  };
  const scrollTop = () => window.scrollTo({ top: 0, behavior: preferences.reduceMotion ? 'auto' : 'smooth' });

  const readPage = () => {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setSpeechStatus(t('यो ब्राउजरमा आवाज पढ्ने सुविधा उपलब्ध छैन।', 'Read-aloud is not available in this browser.'));
      return;
    }
    const text = (document.querySelector('#main')?.innerText || document.querySelector('main')?.innerText || '')
      .replace(/\s+/g, ' ').trim().slice(0, 5000);
    if (!text) {
      setSpeechStatus(t('पढ्न सामग्री भेटिएन।', 'There is no page text to read.'));
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'ne' ? 'ne-NP' : 'en-US';
    utterance.rate = 0.92;
    utterance.onend = () => setReading(false);
    utterance.onerror = () => { setReading(false); setSpeechStatus(t('आवाज चलाउन सकिएन।', 'Audio playback failed.')); };
    setSpeechStatus(t('पृष्ठ पढ्दैछ…', 'Reading this page…'));
    setReading(true);
    window.speechSynthesis.speak(utterance);
  };

  const stopReading = () => {
    window.speechSynthesis?.cancel();
    setReading(false);
    setSpeechStatus(t('आवाज रोकियो।', 'Audio stopped.'));
  };
  const closeSettings = () => {
    setOpen(false);
    document.getElementById('accessibility-toggle')?.focus();
  };
  const buttonClass = 'a11y-control flex min-h-11 items-center justify-center gap-2 rounded-lg border border-terrace-300 bg-white px-3 py-2 font-semibold text-terrace-900 hover:bg-terrace-50';
  const onAppRoot = pathname.startsWith('/app') && pathname === '/app';
  const onPublicRoot = pathname === '/';

  return (
    <div className="a11y-dock" role="region" aria-label={t('सहज पहुँच र पृष्ठ नेभिगेसन', 'Accessibility and page navigation')}>
      <section id="accessibility-panel" hidden={!open} className="a11y-panel rounded-2xl border border-terrace-200 bg-white p-4 shadow-2xl" aria-labelledby="accessibility-title">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="accessibility-title" className="text-lg font-bold text-terrace-900">{t('सहज पहुँच', 'Accessibility')}</h2>
            <p className="text-sm text-gray-700">{t('सेटिङ यस यन्त्रमा सुरक्षित हुन्छ।', 'Settings are saved on this device.')}</p>
          </div>
          <button type="button" className={`${buttonClass} !min-h-11 !w-11 !p-2`} onClick={closeSettings} aria-label={t('बन्द गर्नुहोस्', 'Close accessibility settings')}><X size={20} aria-hidden="true" /></button>
        </div>

        <fieldset>
          <legend className="mb-2 font-semibold text-terrace-900">{t('अक्षरको आकार', 'Text size')}</legend>
          <div className="grid grid-cols-3 gap-2">
            {[100, 115, 130].map((size) => <button key={size} type="button" className={buttonClass} aria-pressed={preferences.textScale === size} onClick={() => setPreferences((current) => ({ ...current, textScale: size }))}>
              {size === 100 ? <Minus size={17} aria-hidden="true" /> : size === 130 ? <Plus size={17} aria-hidden="true" /> : <span aria-hidden="true">A</span>}
              <span>{size === 100 ? t('सामान्य', 'Normal') : `${size - 100}%`}</span>
            </button>)}
          </div>
        </fieldset>

        <div className="mt-3 grid gap-2">
          <button type="button" className={`${buttonClass} justify-start`} aria-pressed={preferences.highContrast} onClick={() => toggle('highContrast')}>
            <Contrast size={18} aria-hidden="true" /> {t('उच्च कन्ट्रास्ट', 'High contrast')} <span className="ml-auto text-sm">{preferences.highContrast ? t('चालु', 'On') : t('बन्द', 'Off')}</span>
          </button>
          <button type="button" className={`${buttonClass} justify-start`} aria-pressed={preferences.reduceMotion} onClick={() => toggle('reduceMotion')}>
            <Accessibility size={18} aria-hidden="true" /> {t('चलायमान प्रभाव घटाउनुहोस्', 'Reduce motion')} <span className="ml-auto text-sm">{preferences.reduceMotion ? t('चालु', 'On') : t('बन्द', 'Off')}</span>
          </button>
        </div>

        <div className="mt-3 border-t border-terrace-100 pt-3">
          <p className="mb-2 font-semibold text-terrace-900">{t('आवाजबाट सुन्नुहोस्', 'Listen to this page')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={readPage} disabled={reading}><Volume2 size={18} aria-hidden="true" /> {t('पृष्ठ पढ्नुहोस्', 'Read page aloud')}</button>
            {reading && <button type="button" className={buttonClass} onClick={stopReading}>{t('रोक्नुहोस्', 'Stop')}</button>}
          </div>
          <p className="mt-2 text-xs text-gray-700" aria-live="polite">{speechStatus || t('उपकरणमा उपलब्ध आवाज प्रयोग हुन्छ।', 'Uses a voice available on this device.')}</p>
        </div>
      </section>

      <div className="flex items-center justify-end gap-2">
        {!onPublicRoot && !onAppRoot && <button type="button" className="a11y-float-button" onClick={goBack} aria-label={t('अघिल्लो पृष्ठमा फर्कनुहोस्', 'Go back to the previous page')} title={t('पछाडि', 'Back')}><ArrowLeft size={21} aria-hidden="true" /></button>}
        {showTop && <button type="button" className="a11y-float-button" onClick={scrollTop} aria-label={t('पृष्ठको माथि जानुहोस्', 'Scroll to the top')} title={t('माथि जानुहोस्', 'Back to top')}><ArrowUp size={21} aria-hidden="true" /></button>}
        <button id="accessibility-toggle" type="button" className="a11y-float-button" aria-expanded={open} aria-controls="accessibility-panel" onClick={() => setOpen((value) => !value)} aria-label={t('सहज पहुँच सेटिङ खोल्नुहोस्', 'Open accessibility settings')} title={t('सहज पहुँच', 'Accessibility')}><Accessibility size={23} aria-hidden="true" /></button>
      </div>
    </div>
  );
}

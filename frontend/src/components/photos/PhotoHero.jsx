import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MapPin, Pause, Play } from 'lucide-react';
import useLang from '../../utils/useLang';
import HeroLandscape from '../layout/HeroLandscape';
import { allPhotos, altOf, fallbackSrc, interleave, motionOf, placeOf, srcset, transitionOf } from '../../utils/photos';

const DWELL_MS = 8000;
const SCRIM = 'linear-gradient(90deg, rgba(8,20,13,.62) 0%, rgba(8,20,13,.28) 45%, rgba(8,20,13,0) 75%), linear-gradient(180deg, rgba(8,20,13,.30) 0%, rgba(8,20,13,.05) 30%, rgba(8,20,13,.72) 100%)';

const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const liteConnection = () => {
  const c = typeof navigator !== 'undefined' ? navigator.connection : null;
  return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')));
};

function HeroText({ t, dark }) {
  const cta = dark ? 'bg-terrace-800 hover:bg-terrace-900 text-white' : 'bg-white hover:bg-terrace-50 text-terrace-900';
  const ghost = dark ? 'bg-white/80 hover:bg-white border border-terrace-800 text-terrace-800' : 'border border-white/80 hover:bg-white/15 text-white';
  return (
    <div className="max-w-2xl">
      <h1 className={`text-4xl md:text-6xl font-bold leading-tight ${dark ? 'text-terrace-900' : 'text-white'}`} style={dark ? undefined : { textShadow: '0 2px 18px rgba(0,0,0,.45)' }}>
        {t('कास्कीका किसानका लागि डिजिटल कृषि सेवा', 'Digital agriculture services for the farmers of Kaski')}
      </h1>
      <p className={`mt-4 text-lg md:text-xl max-w-xl ${dark ? 'text-gray-800' : 'text-white/95'}`}>{t('सूचना, अनुदान कार्यक्रम, तालिम र स्मार्ट फार्मिङ — एकै ठाउँमा।', 'Notices, grant programs, training and smart farming, in one place.')}</p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link to="/notices" className={`px-6 py-3 rounded-md font-semibold ${cta}`}>{t('नयाँ सूचना हेर्नुहोस्', 'View latest notices')}</Link>
        <Link to="/login" className={`px-6 py-3 rounded-md font-semibold ${ghost}`}>{t('लगइन गर्नुहोस्', 'Sign in')}</Link>
      </div>
    </div>
  );
}

function IllustratedHero({ t }) {
  return (
    <section className="hero-sky relative overflow-hidden min-h-[540px]">
      <HeroLandscape className="absolute inset-x-0 bottom-0 w-full h-[72%]" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 pt-12 md:pt-16 pb-44 md:pb-52"><HeroText t={t} dark /></div>
    </section>
  );
}

export default function PhotoHero() {
  const { lang, t } = useLang();
  const reduced = useMemo(prefersReduced, []);
  const lite = useMemo(liteConnection, []);
  const slides = useMemo(() => interleave(allPhotos, lite ? 1 : 7), [lite]);
  const n = slides.length;
  const [cur, setCur] = useState(0);
  const [prev, setPrev] = useState(-1);
  const [intro, setIntro] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(typeof document === 'undefined' ? true : !document.hidden);
  const curRef = useRef(0);
  const seen = useRef(new Set([0, 1]));
  const root = useRef(null);
  const layer = useRef(null);
  const sx = useRef(null);
  const motionOK = !reduced && !lite;
  const auto = playing && motionOK && !paused && visible && pageVisible && n > 1;

  const go = useCallback((target) => {
    if (n < 2) return;
    const next = ((target % n) + n) % n;
    if (next === curRef.current) return;
    setPrev(curRef.current);
    curRef.current = next;
    seen.current.add(next);
    seen.current.add((next + 1) % n);
    setCur(next);
    setIntro(false);
  }, [n]);

  useEffect(() => { if (!auto) return undefined; const id = setTimeout(() => go(curRef.current + 1), DWELL_MS); return () => clearTimeout(id); }, [auto, cur, go]);
  useEffect(() => { if (prev < 0) return undefined; const id = setTimeout(() => setPrev(-1), 1700); return () => clearTimeout(id); }, [prev]);
  useEffect(() => { const f = () => setPageVisible(!document.hidden); document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, []);
  useEffect(() => {
    if (!root.current || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(root.current);
    return () => io.disconnect();
  }, [n]);
  useEffect(() => {
    if (!motionOK || !layer.current) return undefined;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; if (layer.current) layer.current.style.transform = `translate3d(0, ${(Math.min(window.scrollY, 700) * 0.22).toFixed(1)}px, 0)`; });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); if (layer.current) layer.current.style.transform = ''; };
  }, [motionOK, n]);

  if (!n) return <IllustratedHero t={t} />;
  const p = slides[cur];
  const place = placeOf(p, lang) || (lang === 'en' ? p.caption_en : (p.caption_ne || p.caption_en));
  const ctl = 'w-10 h-10 grid place-items-center rounded-full bg-black/35 hover:bg-black/55 border border-white/40 text-white';

  return (
    <section
      ref={root}
      className="relative isolate overflow-hidden bg-terrace-900 text-white h-[80svh] min-h-[540px] max-h-[880px] on-dark"
      role="region" aria-roledescription="carousel" aria-label={t('हिमाल र कृषि जीवनका तस्बिर', 'Photographs of the Himalaya and farming life')}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') go(curRef.current + 1); if (e.key === 'ArrowLeft') go(curRef.current - 1); }}
      onPointerDown={(e) => { sx.current = e.clientX; }}
      onPointerUp={(e) => { if (sx.current === null) return; const dx = e.clientX - sx.current; sx.current = null; if (Math.abs(dx) > 60) go(curRef.current + (dx < 0 ? 1 : -1)); }}
    >
      <div ref={layer} className="absolute inset-x-0 -top-[6%] -bottom-[6%] isolate" aria-live={auto ? 'off' : 'polite'}>
        {slides.map((s, i) => {
          const state = i === cur ? 'slide-cur' : i === prev ? 'slide-prev' : 'slide-off';
          const running = motionOK && (i === cur || i === prev);
          return (
            <div key={s.id} role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${n}`} aria-hidden={i !== cur}
              className={`slide ${state} tr-${transitionOf(s)} ${intro && i === 0 ? 'no-intro' : ''}`}
              style={{ backgroundColor: s.color, backgroundImage: `url(${s.placeholder})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
              {seen.current.has(i) && (
                <picture>
                  <source type="image/avif" srcSet={srcset(s, 'avif')} sizes="100vw" />
                  <source type="image/webp" srcSet={srcset(s, 'webp')} sizes="100vw" />
                  <img src={fallbackSrc(s)} alt={altOf(s, lang)} width={s.width} height={s.height} decoding="async" loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'auto'}
                    className={`kb kb-${motionOf(s, i)} ${running ? 'kb-run' : ''}`} style={{ objectPosition: `${s.focal[0]}% ${s.focal[1]}%`, '--kb-dur': `${DWELL_MS / 1000 + 2.4}s` }} />
                </picture>
              )}
            </div>
          );
        })}
      </div>

      <div className="absolute inset-0 z-20 pointer-events-none" style={{ background: SCRIM }} />
      <div className="relative z-30 h-full max-w-7xl mx-auto px-4 flex flex-col justify-end pb-28 md:pb-32"><HeroText t={t} /></div>

      <div className="absolute z-30 left-4 md:left-8 bottom-6 max-w-[55%] md:max-w-[50%] text-xs md:text-sm text-white/90">
        {place && <p className="flex items-center gap-1.5 font-medium"><MapPin size={14} aria-hidden="true" /> <span className="truncate">{place}</span></p>}
        <Link to="/photo-credits" className="underline underline-offset-2 hover:text-white truncate block">{t('फोटो श्रेय', 'Photo credit')}: {p.author}</Link>
      </div>

      {n > 1 && (
        <div className="absolute z-30 right-4 md:right-8 bottom-5 flex items-center gap-2">
          <button className={ctl} aria-label={t('अघिल्लो फोटो', 'Previous photo')} onClick={() => go(curRef.current - 1)}><ChevronLeft size={20} /></button>
          <ol className="hidden sm:flex items-center gap-1.5 px-1">
            {slides.map((s, i) => (
              <li key={s.id}><button aria-label={`${t('फोटो', 'Photo')} ${i + 1}`} aria-current={i === cur} onClick={() => go(i)} className={`h-2.5 rounded-full transition-all ${i === cur ? 'w-7 bg-white' : 'w-2.5 bg-white/50 hover:bg-white/80'}`} /></li>
            ))}
          </ol>
          <button className={ctl} aria-label={t('अर्को फोटो', 'Next photo')} onClick={() => go(curRef.current + 1)}><ChevronRight size={20} /></button>
          {motionOK && <button className={ctl} aria-pressed={!playing} aria-label={playing ? t('स्लाइडशो रोक्नुहोस्', 'Pause slideshow') : t('स्लाइडशो चलाउनुहोस्', 'Play slideshow')} onClick={() => setPlaying((x) => !x)}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>}
        </div>
      )}
      {motionOK && n > 1 && <div key={cur} className="hero-progress" style={{ animationDuration: `${DWELL_MS}ms`, animationPlayState: auto ? 'running' : 'paused' }} aria-hidden="true" />}
    </section>
  );
}

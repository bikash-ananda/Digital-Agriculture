import { useEffect, useRef } from 'react';
import useLang from '../../utils/useLang';
import Photo from './Photo';
import { pickOne, placeOf } from '../../utils/photos';

export default function PhotoBand({ theme = 'himal' }) {
  const { lang, t } = useLang();
  const p = pickOne(theme);
  const wrap = useRef(null);
  const inner = useRef(null);
  useEffect(() => {
    if (!p || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let raf = 0;
    const upd = () => {
      raf = 0;
      if (!wrap.current || !inner.current) return;
      const r = wrap.current.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.bottom < -100 || r.top > vh + 100) return;
      const prog = (vh - r.top) / (vh + r.height);
      inner.current.style.transform = `translate3d(0, ${((prog - 0.5) * -90).toFixed(1)}px, 0) scale(1.12)`;
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(upd); };
    on();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
  }, [p]);
  if (!p) return null;
  const place = placeOf(p, lang);
  return (
    <section ref={wrap} className="relative overflow-hidden h-[52svh] min-h-[340px] bg-terrace-900 text-white on-dark">
      <div ref={inner} className="absolute inset-0 will-change-transform"><Photo p={p} lang={lang} className="block h-full" imgClass="h-full w-full object-cover" /></div>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(8,20,13,.72), rgba(8,20,13,.25) 60%, rgba(8,20,13,.1))' }} />
      <div className="relative h-full max-w-7xl mx-auto px-4 flex flex-col justify-center">
        <h2 className="text-3xl md:text-5xl font-bold max-w-2xl leading-tight" style={{ textShadow: '0 2px 16px rgba(0,0,0,.5)' }}>{t('हिमालको काखमा, पोखरादेखि गण्डकीसम्म', 'In the shadow of the Himalaya, from Pokhara across Gandaki')}</h2>
        <p className="mt-3 max-w-xl text-white/90 text-lg">{t('कृषकका लागि डिजिटल सेवा, ज्ञान र प्रविधि।', 'Digital services, knowledge and technology for farmers.')}</p>
        {place && <p className="mt-4 text-sm text-white/80">{place}</p>}
      </div>
    </section>
  );
}

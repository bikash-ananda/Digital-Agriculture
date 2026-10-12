import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import useLang from '../../utils/useLang';
import { notices, office } from '../../data/office';

export default function NoticeTicker() {
  const { t } = useLang();
  const [i, setI] = useState(0);
  const [play, setPlay] = useState(true);
  const [hover, setHover] = useState(false);
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rotate = play && !hover && !reduced && notices.length > 1;
  useEffect(() => { if (!rotate) return undefined; const id = setInterval(() => setI((x) => (x + 1) % notices.length), 6500); return () => clearInterval(id); }, [rotate]);
  if (!notices.length) return null;
  const n = notices[i];
  const b = 'p-1 rounded hover:bg-white/15';
  return (
    <div className="bg-terrace-800 text-white on-dark" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3 text-sm">
        <span className="shrink-0 bg-gov-red px-2.5 py-0.5 rounded font-semibold">{t('सूचना', 'Notice')}</span>
        <a key={i} href={`${office.website}/notice`} target="_blank" rel="noreferrer" className="flex-1 min-w-0 truncate hover:underline" aria-live={rotate ? 'off' : 'polite'}>{n.title}</a>
        <span className="hidden md:inline text-white/80 whitespace-nowrap">{t('अन्तिम मिति', 'Deadline')}: {n.deadline}</span>
        {notices.length > 1 && (
          <span className="flex items-center gap-0.5 shrink-0">
            <button className={b} aria-label={t('अघिल्लो सूचना', 'Previous notice')} onClick={() => setI((x) => (x - 1 + notices.length) % notices.length)}><ChevronLeft size={16} /></button>
            {!reduced && <button className={b} aria-pressed={!play} aria-label={play ? t('रोक्नुहोस्', 'Pause') : t('चलाउनुहोस्', 'Play')} onClick={() => setPlay(!play)}>{play ? <Pause size={15} /> : <Play size={15} />}</button>}
            <button className={b} aria-label={t('अर्को सूचना', 'Next notice')} onClick={() => setI((x) => (x + 1) % notices.length)}><ChevronRight size={16} /></button>
          </span>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import useLang from '../../utils/useLang';

const KEY = 'da_a11y_v1';
const read = () => { try { return { size: 0, contrast: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { size: 0, contrast: false }; } };
const apply = (s) => {
  const h = document.documentElement;
  h.classList.remove('a11y-1', 'a11y-2');
  if (s.size) h.classList.add(`a11y-${s.size}`);
  h.classList.toggle('hc', !!s.contrast);
};
apply(read());

export default function A11yBar() {
  const { t } = useLang();
  const [s, setS] = useState(read);
  useEffect(() => { apply(s); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ } }, [s]);
  const b = 'px-1.5 py-0.5 rounded border border-white/40 hover:bg-white/15 disabled:opacity-40 font-semibold';
  return (
    <div role="group" aria-label={t('पहुँच सहजता', 'Accessibility')} className="flex items-center gap-1 text-white">
      <button className={b} aria-label={t('अक्षर सानो', 'Smaller text')} disabled={s.size === 0} onClick={() => setS({ ...s, size: Math.max(0, s.size - 1) })}>A−</button>
      <button className={b} aria-label={t('अक्षर सामान्य', 'Normal text')} onClick={() => setS({ ...s, size: 0 })}>A</button>
      <button className={b} aria-label={t('अक्षर ठूलो', 'Larger text')} disabled={s.size === 2} onClick={() => setS({ ...s, size: Math.min(2, s.size + 1) })}>A+</button>
      <button className={`${b} ${s.contrast ? 'bg-white text-terrace-900' : ''}`} aria-pressed={s.contrast} aria-label={t('उच्च कन्ट्रास्ट', 'High contrast')} onClick={() => setS({ ...s, contrast: !s.contrast })}>◐</button>
    </div>
  );
}

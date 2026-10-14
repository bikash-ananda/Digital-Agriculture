import { useEffect, useState } from 'react';

export default function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.reduceMotion === 'true'
  ));

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches || document.documentElement.dataset.reduceMotion === 'true');
    const observer = new MutationObserver(update);
    media.addEventListener('change', update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
    update();
    return () => {
      media.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);

  return reduced;
}

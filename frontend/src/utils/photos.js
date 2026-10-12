import data from '../data/photos.json';

const BASE = '/images/photos';
export const allPhotos = (data.items || []).filter((p) => p.enabled !== false);
export const srcset = (p, ext) => p.widths.map((w) => `${BASE}/${p.id}/${p.id}-${w}.${ext} ${w}w`).join(', ');
export const fallbackSrc = (p) => `${BASE}/${p.id}/${p.id}-${p.fallback_w}.jpg`;

const MOTION = { himal: ['zoom-out', 'rise', 'pan-right'], traditional: ['pan-left', 'pan-right', 'zoom-in'], modern: ['zoom-in', 'pan-left', 'zoom-out'], other: ['zoom-in', 'pan-right', 'zoom-out'] };
const TRANS = { himal: 'wipe', traditional: 'slide', modern: 'fade', other: 'fade' };
export const motionOf = (p, i) => (p.motion && p.motion !== 'auto' ? p.motion : (MOTION[p.theme] || MOTION.other)[i % 3]);
export const transitionOf = (p) => (p.transition && p.transition !== 'auto' ? p.transition : TRANS[p.theme] || 'fade');

export function interleave(items, max = 7) {
  const g = {};
  items.forEach((p) => { (g[p.theme] = g[p.theme] || []).push(p); });
  const order = ['himal', 'traditional', 'modern', 'other'].filter((k) => g[k]);
  const out = [];
  for (let i = 0; out.length < max; i++) {
    let added = false;
    for (const k of order) if (g[k][i] && out.length < max) { out.push(g[k][i]); added = true; }
    if (!added) break;
  }
  return out;
}

export const pickOne = (theme) => {
  const l = allPhotos.filter((p) => p.theme === theme);
  return l.length ? l[Math.floor(Date.now() / 86400000) % l.length] : null;
};
export const placeOf = (p, lang) => (lang === 'en' ? p.place_en : (p.place_ne || p.place_en)) || '';
export const altOf = (p, lang) => (lang === 'en' ? p.alt_en : (p.alt_ne || p.alt_en));

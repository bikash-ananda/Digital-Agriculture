import api from '../services/api';
import { office, officers, staff, usefulLinks } from './office';

const clone = (v) => JSON.parse(JSON.stringify(v));
const DEFAULTS = clone({ office, officers, staff, usefulLinks });
export const getDefaults = () => clone(DEFAULTS);

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Merge saved content over the built-in values, in place, so every page that
// imports these objects shows the saved content on its next render.
export function applyContent(content = {}) {
  if (isObj(content.office)) {
    const base = clone(DEFAULTS.office);
    for (const [k, v] of Object.entries(content.office)) {
      if (!(k in base)) continue;
      if (isObj(base[k]) && isObj(v)) base[k] = { ...base[k], ...v };
      else if (typeof base[k] === typeof v) base[k] = v;
    }
    Object.assign(office, base);
  }
  const lists = { officers, staff, usefulLinks };
  for (const [k, arr] of Object.entries(lists)) {
    if (Array.isArray(content[k])) arr.splice(0, arr.length, ...content[k]);
  }
}

export function resetKey(key) {
  if (key === 'office') Object.assign(office, clone(DEFAULTS.office));
  else { const arr = { officers, staff, usefulLinks }[key]; if (arr) arr.splice(0, arr.length, ...clone(DEFAULTS[key])); }
}

export async function loadSiteContent() {
  try {
    const { data } = await api.get('/site-content', { timeout: 4000 });
    applyContent(data);
    return true;
  } catch { return false; }
}

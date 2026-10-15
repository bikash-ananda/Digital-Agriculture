export const fmtP = (p) => (p === null || p === undefined ? '—' : p < 0.001 ? '<0.001' : p.toFixed(3));
export const f = (v, d = 2) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(d));
export const ymd = (d) => d.toLocaleDateString('en-CA');
export const mname = (mm, k, lang) => (mm[k] ? (lang === 'en' ? mm[k].en : mm[k].ne) : k);

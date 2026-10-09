export const fmtP = (p) => (p === null || p === undefined ? '—' : p < 0.001 ? '<0.001' : p.toFixed(3));
export const f = (v, d = 2) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(d));
export const ymd = (d) => d.toLocaleDateString('en-CA');
export const mname = (mm, k, lang) => (mm[k] ? (lang === 'en' ? mm[k].en : mm[k].ne) : k);

export function Caveats({ list, t }) {
  if (!list || !list.length) return null;
  return (
    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-900">
      <p className="font-semibold mb-1">{t('अध्ययनमा ध्यान दिनुपर्ने कुरा', 'Read this before drawing conclusions')}</p>
      <ul className="list-disc pl-5 space-y-0.5">{list.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

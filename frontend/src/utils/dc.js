export const ROPANI = 508.737; // 5476 sq ft
export const AANA = ROPANI / 16;
export const PAISA = AANA / 4;
export const DAM = PAISA / 4;

export const toSqm = (p) => (Number(p.ropani) || 0) * ROPANI + (Number(p.aana) || 0) * AANA + (Number(p.paisa) || 0) * PAISA + (Number(p.dam) || 0) * DAM;

export function splitSqm(sqm) {
  let rest = Number(sqm) || 0;
  const ropani = Math.floor(rest / ROPANI + 1e-9); rest -= ropani * ROPANI;
  const aana = Math.min(15, Math.floor(rest / AANA + 1e-9)); rest -= aana * AANA;
  const paisa = Math.min(3, Math.floor(rest / PAISA + 1e-9)); rest -= paisa * PAISA;
  const dam = Math.round((rest / DAM) * 10) / 10;
  return { ropani, aana, paisa, dam };
}

export function formatLand(sqm, lang = 'ne') {
  if (sqm === null || sqm === undefined || sqm === '') return '—';
  const x = Number(sqm);
  if (!Number.isFinite(x)) return '—';
  const p = splitSqm(x);
  const u = lang === 'en' ? ['ropani', 'aana', 'paisa', 'dam'] : ['रोपनी', 'आना', 'पैसा', 'दाम'];
  const parts = [p.ropani, p.aana, p.paisa, p.dam].map((v, i) => (v > 0 ? `${v} ${u[i]}` : null)).filter(Boolean);
  return `${parts.length ? parts.join(' ') : `${x} m²`} (${(x / 10000).toFixed(x >= 10000 ? 2 : 4)} ha)`;
}

export function fiscalYearOf(date = new Date()) {
  const y = date.getFullYear();
  const after = date.getMonth() > 6 || (date.getMonth() === 6 && date.getDate() >= 17);
  const bs = after ? y + 57 : y + 56;
  return `${bs}/${String(bs + 1).slice(-2)}`;
}

export const nf = (v, d = 0) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: d });
export const val = (v, d = 1) => (v === null || v === undefined ? '—' : nf(v, d));

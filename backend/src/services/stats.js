const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => (a.length ? sum(a) / a.length : null);
const variance = (a) => { if (a.length < 2) return null; const m = mean(a); return sum(a.map((x) => (x - m) ** 2)) / (a.length - 1); };
const sd = (a) => { const v = variance(a); return v === null ? null : Math.sqrt(v); };
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) { y += 1; ser += c[j] / y; }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a, b, x) {
  const FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}

function betai(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

const tTwoSidedP = (t, df) => betai(df / 2, 0.5, df / (df + t * t));
const fUpperP = (F, d1, d2) => betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * F));

function tCrit(df) {
  let lo = 0, hi = 200;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (tTwoSidedP(mid, df) > 0.05) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

function ranks(a) {
  const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
  const r = new Array(a.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = rank;
    i = j + 1;
  }
  return r;
}

function pearson(x, y) {
  const n = x.length;
  if (n < 3) return null;
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  if (sxx === 0 || syy === 0) return null;
  const r = Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
  const t = r * Math.sqrt((n - 2) / Math.max(1e-12, 1 - r * r));
  return { r, n, p: tTwoSidedP(t, n - 2), slope: sxy / sxx, intercept: my - (sxy / sxx) * mx, r2: r * r };
}

function correlate(x, y, method) {
  const raw = pearson(x, y);
  if (!raw) return null;
  if (method !== 'spearman') return raw;
  const rk = pearson(ranks(x), ranks(y));
  return rk ? { ...raw, r: rk.r, p: rk.p } : null;
}

function welch(a, b) {
  const n1 = a.length, n2 = b.length;
  if (n1 < 2 || n2 < 2) return null;
  const m1 = mean(a), m2 = mean(b), v1 = variance(a), v2 = variance(b);
  const se2 = v1 / n1 + v2 / n2;
  if (se2 === 0) return null;
  const t = (m1 - m2) / Math.sqrt(se2);
  const df = (se2 * se2) / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1));
  const tc = tCrit(df);
  const diff = m1 - m2;
  const se = Math.sqrt(se2);
  const sp = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
  return { test: 'welch_t', t, df, p: tTwoSidedP(t, df), mean_diff: diff, ci95: [diff - tc * se, diff + tc * se], cohens_d: sp ? diff / sp : null };
}

function anova(groups) {
  const k = groups.length;
  const N = sum(groups.map((g) => g.length));
  if (k < 2 || N - k < 1 || groups.some((g) => g.length < 1)) return null;
  const gm = sum(groups.map((g) => sum(g))) / N;
  const ssb = sum(groups.map((g) => g.length * (mean(g) - gm) ** 2));
  const ssw = sum(groups.map((g) => sum(g.map((x) => (x - mean(g)) ** 2))));
  if (ssw === 0) return null;
  const F = ssb / (k - 1) / (ssw / (N - k));
  return { test: 'anova', F, df1: k - 1, df2: N - k, p: fUpperP(F, k - 1, N - k), eta2: ssb / (ssb + ssw) };
}

function compareGroups(groups) {
  if (groups.length === 2) return welch(groups[0], groups[1]);
  if (groups.length > 2) return anova(groups);
  return null;
}

module.exports = { mean, sd, median, correlate, welch, anova, compareGroups };

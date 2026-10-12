const db = require('../config/db');

const LOCAL_MS = (5 * 60 + 45) * 60000;
const STEP = 600;
const PER_DAY = 144;
const TYPES = ['temperature', 'humidity', 'soil_moisture', 'light'];
const META = {
  temperature: { ne: 'तापक्रम', en: 'Temperature', unit: '°C' }, humidity: { ne: 'आर्द्रता', en: 'Humidity', unit: '%' },
  soil_moisture: { ne: 'माटोको चिस्यान', en: 'Soil moisture', unit: '%' }, light: { ne: 'प्रकाश', en: 'Light', unit: 'lux' }
};
const MINSD = { temperature: 0.7, humidity: 3, soil_moisture: 1.5 };

const hourOf = (ts) => new Date(ts * 1000 + LOCAL_MS).getUTCHours();
const dayKey = (ts) => new Date(ts * 1000 + LOCAL_MS).toISOString().slice(0, 10);
const clock = (ts) => new Date(ts * 1000 + LOCAL_MS).toISOString().slice(11, 16);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => (a.length ? sum(a) / a.length : null);
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const rd = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const nonNull = (a) => a.filter((x) => x !== null);
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

async function loadSeries(unitId, hours) {
  const [rows] = await db.query(
    `SELECT s.sensor_type AS type, FLOOR(UNIX_TIMESTAMP(r.recorded_at) / ${STEP}) * ${STEP} AS ts, AVG(r.value) AS v
       FROM sensor_readings r JOIN sensors s ON s.id = r.sensor_id
      WHERE s.growing_unit_id = ? AND s.status <> 'disabled' AND s.sensor_type IN ('temperature','humidity','soil_moisture','light') AND r.recorded_at >= NOW() - INTERVAL ? HOUR
      GROUP BY type, ts ORDER BY ts`, [unitId, hours]);
  const [nowRow] = await db.query('SELECT UNIX_TIMESTAMP(NOW()) AS t');
  const end = Math.floor(Number(nowRow[0].t) / STEP) * STEP;
  const n = Math.floor((hours * 3600) / STEP) + 1;
  const start = end - (n - 1) * STEP;
  const series = {};
  rows.forEach((r) => {
    if (!series[r.type]) series[r.type] = new Array(n).fill(null);
    const i = (Number(r.ts) - start) / STEP;
    if (i >= 0 && i < n) series[r.type][i] = Number(r.v);
  });
  return { start, end, n, series, ts: (i) => start + i * STEP };
}

async function loadEvents(unitId, hours) {
  const [rows] = await db.query(
    `SELECT a.actuator_type AS type, UNIX_TIMESTAMP(e.started_at) AS s, UNIX_TIMESTAMP(COALESCE(e.ended_at, NOW())) AS e, e.trigger_source AS src
       FROM actuator_events e JOIN actuators a ON a.id = e.actuator_id
      WHERE a.growing_unit_id = ? AND e.state = 'on' AND COALESCE(e.ended_at, NOW()) >= NOW() - INTERVAL ? HOUR ORDER BY e.started_at`, [unitId, hours]);
  return rows.map((r) => ({ type: r.type, s: Number(r.s), e: Number(r.e), src: r.src }));
}

async function loadTargets(unitId) {
  const defaults = { temperature: [18, 28], humidity: [55, 80], soil_moisture: [40, 70] };
  try {
    const [cy] = await db.query("SELECT crop_id FROM crop_cycles WHERE growing_unit_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [unitId]);
    const [g] = await db.query("SELECT id FROM crops WHERE code = 'GENERIC'");
    const ids = [cy[0] && cy[0].crop_id, g[0] && g[0].id].filter(Boolean);
    if (!ids.length) return { t: defaults, source: 'default' };
    const [rows] = await db.query("SELECT crop_id, parameter, opt_min, opt_max FROM crop_stage_targets WHERE crop_id IN (?) AND stage_code = 'all'", [ids]);
    const out = { ...defaults };
    const crop = cy[0] ? cy[0].crop_id : null;
    rows.filter((x) => x.crop_id !== crop).forEach((x) => { if (out[x.parameter]) out[x.parameter] = [x.opt_min, x.opt_max]; });
    rows.filter((x) => x.crop_id === crop).forEach((x) => { if (out[x.parameter]) out[x.parameter] = [x.opt_min, x.opt_max]; });
    return { t: out, source: crop ? 'crop' : 'generic' };
  } catch (e) { return { t: defaults, source: 'default' }; }
}

function eventMask(S, events, types, before, after) {
  const m = new Set();
  events.filter((e) => types.includes(e.type)).forEach((e) => {
    const i0 = Math.floor((e.s - before - S.start) / STEP);
    const i1 = Math.ceil((e.e + after - S.start) / STEP);
    for (let i = Math.max(0, i0); i <= Math.min(S.n - 1, i1); i++) m.add(i);
  });
  return m;
}

// ---------------- anomalies: unusual compared with the sensor's own pattern for that hour of day ----------------
function findAnomalies(S, events) {
  const out = [];
  const recentFrom = Math.max(0, S.n - PER_DAY);
  for (const type of ['temperature', 'humidity', 'soil_moisture']) {
    const v = S.series[type];
    if (!v) continue;
    if (nonNull(v.slice(0, recentFrom)).length < PER_DAY * 1.5) continue;
    const mask = type === 'soil_moisture' ? eventMask(S, events, ['irrigation'], 600, 3600) : eventMask(S, events, ['misting', 'irrigation', 'fan'], 600, 1800);
    const byHour = Array.from({ length: 24 }, () => []);
    for (let i = 0; i < recentFrom; i++) if (v[i] !== null && !mask.has(i)) byHour[hourOf(S.ts(i))].push(v[i]);
    const base = byHour.map((a) => {
      if (a.length < 5) return null;
      const md = median(a);
      return { md, sd: Math.max(1.4826 * median(a.map((x) => Math.abs(x - md))), MINSD[type]) };
    });
    let run = null;
    const flush = () => {
      if (run && run.len >= 2) {
        out.push({ type, label: META[type], unit: META[type].unit, start: S.ts(run.first), end: S.ts(run.last) + STEP, minutes: run.len * 10, value: rd(run.v, 1), expected: rd(run.exp, 1), direction: run.z > 0 ? 'high' : 'low', z: rd(run.z, 1) });
      }
      run = null;
    };
    for (let i = recentFrom; i < S.n; i++) {
      const b = v[i] === null || mask.has(i) ? null : base[hourOf(S.ts(i))];
      const z = b ? (v[i] - b.md) / b.sd : null;
      if (z !== null && Math.abs(z) > 4) {
        if (run && i - run.last <= 1) {
          run.last = i; run.len++;
          if (Math.abs(z) > Math.abs(run.z)) { run.z = z; run.v = v[i]; run.exp = b.md; }
        } else { flush(); run = { first: i, last: i, len: 1, z, v: v[i], exp: b.md }; }
      } else if (run && i - run.last > 1) flush();
    }
    flush();
  }
  return out.sort((a, b) => b.start - a.start);
}

// ---------------- forecast: daily profile + a decaying correction for how today differs ----------------
function hourlySeries(S, type) {
  const v = S.series[type];
  if (!v) return [];
  const acc = new Map();
  for (let i = 0; i < S.n; i++) {
    if (v[i] === null) continue;
    const hs = Math.floor(S.ts(i) / 3600) * 3600;
    if (!acc.has(hs)) acc.set(hs, []);
    acc.get(hs).push(v[i]);
  }
  return [...acc.entries()].sort((a, b) => a[0] - b[0]).filter(([, a]) => a.length >= 3).map(([ts, a]) => ({ ts, v: mean(a) }));
}

function forecastAt(H, idx, horizon) {
  const hist = H.slice(Math.max(0, idx - 24 * 7), idx + 1);
  const prof = Array.from({ length: 24 }, () => []);
  hist.forEach((p) => prof[hourOf(p.ts + 1800)].push(p.v));
  const pm = prof.map((a) => (a.length >= 3 ? median(a) : null));
  const recent = H.slice(Math.max(0, idx - 2), idx + 1).filter((p) => pm[hourOf(p.ts + 1800)] !== null);
  if (recent.length < 2) return null;
  const dev = mean(recent.map((p) => p.v - pm[hourOf(p.ts + 1800)]));
  const out = [];
  for (let k = 1; k <= horizon; k++) {
    const ts = H[idx].ts + k * 3600;
    const p = pm[hourOf(ts + 1800)];
    if (p === null) return null;
    out.push({ ts, v: p + dev * Math.exp(-k / 6) });
  }
  return out;
}

function forecast(S, type, horizon = 6) {
  const H = hourlySeries(S, type);
  if (H.length < 72) return { type, ready: false, reason: 'learning', have_hours: H.length, need_hours: 72 };
  if (S.end - H[H.length - 1].ts > 3 * 3600) return { type, ready: false, reason: 'stale' };
  const byTs = new Map(H.map((p) => [p.ts, p.v]));
  const errs = Array.from({ length: horizon }, () => []);
  for (let idx = Math.max(48, H.length - 72); idx < H.length - 1; idx += 3) {
    const f = forecastAt(H, idx, horizon);
    if (!f) continue;
    f.forEach((p, k) => { const a = byTs.get(p.ts); if (a !== undefined) errs[k].push(p.v - a); });
  }
  const rmse = errs.map((e) => (e.length >= 5 ? Math.sqrt(mean(e.map((x) => x * x))) : null));
  const f = forecastAt(H, H.length - 1, horizon);
  if (!f) return { type, ready: false, reason: 'learning', have_hours: H.length, need_hours: 72 };
  return {
    type, ready: true, unit: META[type].unit, rmse: rmse.map((x) => rd(x, 2)), backtest_n: Math.max(...errs.map((e) => e.length)),
    history: H.slice(-24).map((p) => ({ ts: p.ts, v: rd(p.v, 2) })),
    forecast: f.map((p, k) => ({ ts: p.ts, v: rd(p.v, 2), lo: rmse[k] === null ? null : rd(p.v - 1.28 * rmse[k], 2), hi: rmse[k] === null ? null : rd(p.v + 1.28 * rmse[k], 2) }))
  };
}

// ---------------- soil dry-down model ----------------
function ols(X, y) {
  const k = X[0].length;
  const A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  X.forEach((row, n) => { for (let i = 0; i < k; i++) { for (let j = 0; j < k; j++) A[i][j] += row[i] * row[j]; A[i][k] += row[i] * y[n]; } });
  for (let i = 0; i < k; i++) {
    let p = i;
    for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    if (Math.abs(A[p][i]) < 1e-12) return null;
    [A[i], A[p]] = [A[p], A[i]];
    for (let r = i + 1; r < k; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c <= k; c++) A[r][c] -= f * A[i][c]; }
  }
  const b = new Array(k).fill(0);
  for (let i = k - 1; i >= 0; i--) { let s = A[i][k]; for (let j = i + 1; j < k; j++) s -= A[i][j] * b[j]; b[i] = s / A[i][i]; }
  return b;
}

function fitDryDown(S, events) {
  const sm = S.series.soil_moisture;
  if (!sm) return { ready: false, n: 0, need: 100 };
  const T = S.series.temperature || [];
  const L = S.series.light || [];
  const mask = eventMask(S, events, ['irrigation'], 600, 5400);
  const rows = [];
  for (let i = 0; i < S.n - 1; i++) {
    if (sm[i] === null || sm[i + 1] === null || mask.has(i) || mask.has(i + 1)) continue;
    const y = sm[i] - sm[i + 1];
    if (y < -1 || y > 3.5) continue;
    rows.push({ y, h: hourOf(S.ts(i)), t: T[i] === undefined ? null : T[i], l: L[i] === undefined ? null : L[i] });
  }
  if (rows.length < 100) return { ready: false, n: rows.length, need: 100 };
  const overall = median(rows.map((r) => r.y));
  const profile = Array.from({ length: 24 }, (_, h) => { const a = rows.filter((r) => r.h === h).map((r) => r.y); return a.length >= 4 ? median(a) : overall; });
  let reg = null;
  const rr = rows.filter((r) => r.t !== null && r.l !== null);
  if (rr.length >= 100) {
    const X = rr.map((r) => [1, r.l / 50000, (r.t - 20) / 10]);
    const beta = ols(X, rr.map((r) => r.y));
    if (beta) {
      const ybar = mean(rr.map((r) => r.y));
      const ssr = sum(rr.map((r, j) => (r.y - (beta[0] + beta[1] * X[j][1] + beta[2] * X[j][2])) ** 2));
      const sst = sum(rr.map((r) => (r.y - ybar) ** 2));
      reg = { beta, r2: sst > 0 ? 1 - ssr / sst : 0, n: rr.length };
    }
  }
  const useReg = !!(reg && reg.r2 >= 0.12);
  return {
    ready: true, n: rows.length, kind: useReg ? 'regression' : 'hour_profile', r2: reg ? rd(reg.r2, 3) : null, beta: useReg ? reg.beta : null, profile,
    per_hour: profile.map((x) => rd(Math.max(0, x) * 6, 2)),
    day_rate_per_h: rd(median(rows.filter((r) => r.h >= 8 && r.h < 17).map((r) => r.y)) * 6, 2), night_rate_per_h: rd(median(rows.filter((r) => r.h >= 20 || r.h < 5).map((r) => r.y)) * 6, 2)
  };
}

function dropAt(model, t, l, hour) {
  if (model.kind === 'regression' && t !== null && l !== null) return Math.max(0, model.beta[0] + model.beta[1] * (l / 50000) + model.beta[2] * ((t - 20) / 10));
  return Math.max(0, model.profile[hour]);
}

function hoursToThreshold(model, S, current, thr) {
  let m = current;
  let ts = S.end;
  if (m <= thr) return 0;
  for (let k = 0; k < 72 * 6; k++) {
    m -= Math.max(0, model.profile[hourOf(ts)]);
    ts += STEP;
    if (m <= thr) return rd(((k + 1) * STEP) / 3600, 1);
  }
  return null;
}

// ---------------- how much the soil rises per minute of irrigation ----------------
async function responseModel(unitId, events, hours) {
  const ir = events.filter((e) => e.type === 'irrigation' && e.e - e.s >= 20);
  if (!ir.length) return { ready: false, n: 0, need: 3 };
  const [rows] = await db.query(
    `SELECT FLOOR(UNIX_TIMESTAMP(r.recorded_at) / 60) * 60 AS ts, AVG(r.value) AS v FROM sensor_readings r JOIN sensors s ON s.id = r.sensor_id
      WHERE s.growing_unit_id = ? AND s.sensor_type = 'soil_moisture' AND s.status <> 'disabled' AND r.recorded_at >= NOW() - INTERVAL ? HOUR GROUP BY ts ORDER BY ts`, [unitId, hours]);
  const pts = rows.map((r) => [Number(r.ts), Number(r.v)]);
  const win = (a, b) => pts.filter((p) => p[0] >= a && p[0] <= b);
  const good = [];
  for (const e of ir) {
    const before = win(e.s - 600, e.s - 60);
    const after = win(e.e + 120, e.e + 2700);
    if (before.length < 3 || after.length < 6) continue;
    const b = median(before.map((p) => p[1]));
    let best = null;
    for (let i = 0; i + 2 < after.length; i++) {
      const m = (after[i][1] + after[i + 1][1] + after[i + 2][1]) / 3;
      if (!best || m > best.m) best = { m, ts: after[i + 1][0] };
    }
    const gain = best.m - b;
    const mins = (e.e - e.s) / 60;
    if (gain > -0.5) good.push({ start: e.s, minutes: rd(mins, 1), before: rd(b, 1), peak: rd(best.m, 1), gain: rd(gain, 1), lag_min: rd((best.ts - e.e) / 60, 0), per_min: gain / mins, src: e.src });
  }
  if (good.length < 3) return { ready: false, n: good.length, need: 3 };
  return {
    ready: true, n: good.length, gain_per_min: rd(median(good.map((x) => x.per_min)), 2), median_gain: rd(median(good.map((x) => x.gain)), 1),
    median_minutes: rd(median(good.map((x) => x.minutes)), 1), lag_min: rd(median(good.map((x) => x.lag_min)), 0), events: good.slice(-30).map((x) => ({ ...x, per_min: rd(x.per_min, 2) }))
  };
}

// ---------------- simulation of an irrigation rule on past conditions ----------------
function inWindow(from, to, lmin) {
  if (!from || !to) return true;
  const mm = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
  const a = mm(from);
  const b = mm(to);
  return a <= b ? lmin >= a && lmin <= b : lmin >= a || lmin <= b;
}

function simulate(rule, model, gain, S, targets, days) {
  const sm = S.series.soil_moisture;
  const T = S.series.temperature || [];
  const L = S.series.light || [];
  const bins = Math.min(S.n, days * PER_DAY);
  const i0 = S.n - bins;
  let m = null;
  for (let i = i0; i < S.n; i++) if (sm[i] !== null) { m = sm[i]; break; }
  if (m === null) return null;
  const [lo, hi] = targets.soil_moisture;
  const crit = lo - 10;
  const maxRun = Math.max(1, Math.round(rule.max_runtime_seconds / 60));
  const coolMin = Math.round((rule.min_interval_seconds || 0) / 60);
  let running = false, left = 0, cool = 0, runs = 0, pump = 0, inBand = 0, below = 0, total = 0, minM = m, maxM = m;
  const trace = [];
  for (let i = i0; i < S.n; i++) {
    const ts = S.ts(i);
    const drop = dropAt(model, T[i] === undefined ? null : T[i], L[i] === undefined ? null : L[i], hourOf(ts)) / 10;
    for (let k = 0; k < 10; k++) {
      m -= drop;
      if (running) { m += gain; pump++; left--; if (m >= rule.stop_threshold || left <= 0) { running = false; cool = coolMin; } }
      else if (cool > 0) cool--;
      m = clamp(m, 0, 100);
      const lmin = Math.floor(((ts + k * 60 + LOCAL_MS / 1000) % 86400) / 60);
      if (!running && cool <= 0 && m < rule.start_threshold && inWindow(rule.schedule_from, rule.schedule_to, lmin)) { running = true; left = maxRun; runs++; }
      total++;
      if (m >= lo && m <= hi) inBand++;
      if (m < crit) below++;
      if (m < minM) minM = m;
      if (m > maxM) maxM = m;
    }
    if ((i - i0) % 3 === 0) trace.push({ ts, m: rd(m, 1) });
  }
  const d = total / 1440;
  return { runs, runs_per_day: rd(runs / d, 1), pump_min_per_day: rd(pump / d, 1), time_in_band_pct: rd((100 * inBand) / total, 1), below_critical_h_per_day: rd(below / 60 / d, 2), min_moisture: rd(minM, 1), max_moisture: rd(maxM, 1), trace };
}

function actualStats(S, events, targets, days) {
  const sm = S.series.soil_moisture;
  const bins = Math.min(S.n, days * PER_DAY);
  const i0 = S.n - bins;
  const t0 = S.ts(i0);
  const vals = nonNull(sm.slice(i0));
  if (!vals.length) return null;
  const [lo, hi] = targets.soil_moisture;
  const d = bins / PER_DAY;
  const ir = events.filter((e) => e.type === 'irrigation' && e.e >= t0);
  const pump = sum(ir.map((e) => (Math.min(e.e, S.end) - Math.max(e.s, t0)) / 60));
  const trace = [];
  for (let i = i0; i < S.n; i += 3) if (sm[i] !== null) trace.push({ ts: S.ts(i), m: rd(sm[i], 1) });
  return {
    runs: ir.length, runs_per_day: rd(ir.length / d, 1), pump_min_per_day: rd(pump / d, 1), time_in_band_pct: rd((100 * vals.filter((x) => x >= lo && x <= hi).length) / vals.length, 1),
    below_critical_h_per_day: rd((vals.filter((x) => x < lo - 10).length * 10) / 60 / d, 2), min_moisture: rd(Math.min(...vals), 1), max_moisture: rd(Math.max(...vals), 1), trace
  };
}

function recommend(model, gain, S, targets, days, actMaxS, cooldownS) {
  const [lo] = targets.soil_moisture;
  const all = [];
  for (let start = Math.max(15, lo - 12); start <= Math.min(60, lo + 4); start += 2) {
    for (const gap of [5, 8, 12]) {
      for (const run of [120, 300, 600, 900]) {
        if (run > actMaxS) continue;
        const rule = { start_threshold: start, stop_threshold: Math.min(start + gap, 95), max_runtime_seconds: run, min_interval_seconds: cooldownS, schedule_from: null, schedule_to: null };
        const r = simulate(rule, model, gain, S, targets, days);
        if (!r) continue;
        const score = r.time_in_band_pct - 0.1 * r.pump_min_per_day - 10 * r.below_critical_h_per_day - 0.5 * Math.max(0, r.runs_per_day - 8);
        all.push({ rule, result: { ...r, trace: undefined }, score: rd(score, 1) });
      }
    }
  }
  all.sort((a, b) => b.score - a.score);
  const out = [];
  for (const c of all) {
    if (out.every((o) => o.rule.start_threshold !== c.rule.start_threshold || o.rule.stop_threshold !== c.rule.stop_threshold)) out.push(c);
    if (out.length === 3) break;
  }
  return out;
}

// ---------------- daily digest in plain language (Nepali and English) ----------------
function buildDigest(ctx) {
  const { S, events, tg, anomalies, forecasts, dry, soil, flags } = ctx;
  const last = (t) => (S.series[t] ? nonNull(S.series[t].slice(-PER_DAY)) : []);
  const tir = (a, lo, hi) => (a.length ? (100 * a.filter((x) => x >= lo && x <= hi).length) / a.length : null);
  const bullets = [];
  const actions = [];
  const push = (level, ne, en) => bullets.push({ level, ne, en });
  const stats = {};
  for (const t of ['temperature', 'humidity', 'soil_moisture']) {
    const a = last(t);
    if (!a.length) continue;
    const [lo, hi] = tg.t[t];
    const inr = tir(a, lo, hi);
    stats[t] = { min: rd(Math.min(...a), 1), mean: rd(mean(a), 1), max: rd(Math.max(...a), 1), in_range_pct: rd(inr, 0) };
    const u = META[t].unit;
    push(inr >= 70 ? 'good' : 'warn',
      `${META[t].ne}: ${rd(Math.min(...a), 1)}–${rd(Math.max(...a), 1)} ${u} (औसत ${rd(mean(a), 1)}); ${rd(inr, 0)}% समय उपयुक्त दायरा (${lo}–${hi}) भित्र।`,
      `${META[t].en}: ${rd(Math.min(...a), 1)}–${rd(Math.max(...a), 1)} ${u} (mean ${rd(mean(a), 1)}); ${rd(inr, 0)}% of the time inside the ${lo}–${hi} range.`);
  }
  const day = (ty) => events.filter((e) => e.type === ty && e.e >= S.end - 86400);
  const ir = day('irrigation');
  const ms = day('misting');
  const mins = (l) => Math.round(sum(l.map((e) => (e.e - e.s) / 60)));
  if (ir.length || ms.length) {
    push('info', `गत २४ घण्टा: सिँचाइ ${ir.length} पटक (${mins(ir)} मिनेट), मिस्टिङ ${ms.length} पटक (${mins(ms)} मिनेट)।`, `Last 24 h: irrigation ${ir.length} runs (${mins(ir)} min), misting ${ms.length} runs (${mins(ms)} min).`);
  }
  if (anomalies.length) push('warn', `${anomalies.length} असामान्य अवधि फेला परे।`, `${anomalies.length} unusual period(s) found.`);
  if (soil && soil.hours_to_threshold !== null && soil.hours_to_threshold !== undefined) {
    push(soil.hours_to_threshold < 6 ? 'warn' : 'info', `माटोको चिस्यान करिब ${soil.hours_to_threshold} घण्टामा ${soil.threshold}% पुग्ने अनुमान (हाल ${soil.current}%)।`,
      `Soil moisture is expected to fall to ${soil.threshold}% in about ${soil.hours_to_threshold} h (now ${soil.current}%).`);
  }
  const ft = forecasts.temperature;
  if (ft && ft.ready) {
    const mx = Math.max(...ft.forecast.map((p) => p.v));
    push('info', `अर्को ६ घण्टामा तापक्रम अधिकतम करिब ${rd(mx, 1)} °C पुग्ने अनुमान।`, `Temperature is forecast to peak around ${rd(mx, 1)} °C in the next 6 hours.`);
  }
  (flags || []).forEach((f) => push('warn', f.message.ne, f.message.en));
  if (stats.soil_moisture && stats.soil_moisture.in_range_pct < 70) actions.push({ ne: 'माटोको चिस्यान प्रायः दायरा बाहिर छ — “स्वचालन” ट्याबमा सेटिङ सिफारिस चलाएर हेर्नुहोस्।', en: 'Soil moisture is often outside its range — try the settings recommendation in the Automation tab.' });
  if (stats.humidity && stats.humidity.in_range_pct < 60) actions.push({ ne: 'आर्द्रता प्रायः दायरा बाहिर छ — भेन्टिलेसन वा मिस्टिङ समय जाँच गर्नुहोस्।', en: 'Humidity is often out of range — review ventilation or misting times.' });
  if (!dry.ready) actions.push({ ne: 'सिकाइ मोडेलका लागि अझै तथ्याङ्क जम्मा हुँदैछ।', en: 'The learning models are still collecting data.' });
  const lvl = bullets.some((b) => b.level === 'warn') ? 'warn' : 'good';
  return {
    headline: lvl === 'good' ? { level: 'good', ne: 'ग्रीनहाउस सामान्य अवस्थामा छ।', en: 'The greenhouse looks healthy.' } : { level: 'warn', ne: 'केही कुरामा ध्यान चाहिन्छ।', en: 'A few things need attention.' },
    bullets, actions, stats
  };
}

const cache = new Map();

async function insights(unitId, hours = 168, opts = {}) {
  const key = `${unitId}:${hours}`;
  const hit = cache.get(key);
  if (!opts.fresh && hit && Date.now() - hit.t < 90000) return hit.v;
  const [S, events, tg] = await Promise.all([loadSeries(unitId, hours), loadEvents(unitId, hours), loadTargets(unitId)]);
  const count = (t) => (S.series[t] ? nonNull(S.series[t]).length : 0);
  const days = Math.max(...TYPES.map(count)) / PER_DAY;
  const coverage = {};
  TYPES.forEach((t) => { coverage[t] = S.series[t] ? Math.round((100 * nonNull(S.series[t].slice(-PER_DAY)).length) / PER_DAY) : 0; });

  const anomalies = findAnomalies(S, events);
  const forecasts = {};
  for (const t of ['temperature', 'humidity', 'soil_moisture']) forecasts[t] = S.series[t] ? forecast(S, t) : { type: t, ready: false, reason: 'no_sensor' };
  const dry = fitDryDown(S, events);
  const resp = await responseModel(unitId, events, hours);

  const flags = [];
  TYPES.forEach((t) => {
    const v = S.series[t];
    if (!v) return;
    const lastIdx = v.map((x, i) => (x === null ? -1 : i)).reduce((a, b) => Math.max(a, b), -1);
    if (lastIdx >= 0 && (S.n - 1 - lastIdx) * 10 > 30) flags.push({ type: t, message: { ne: `${META[t].ne}: ${(S.n - 1 - lastIdx) * 10} मिनेटदेखि नयाँ तथ्याङ्क छैन।`, en: `${META[t].en}: no new data for ${(S.n - 1 - lastIdx) * 10} minutes.` } });
    if (t === 'temperature' || t === 'humidity') {
      const tail = nonNull(v.slice(-18));
      if (tail.length >= 12 && Math.max(...tail) - Math.min(...tail) < 1e-9) flags.push({ type: t, message: { ne: `${META[t].ne} सेन्सरको मान ३ घण्टादेखि स्थिर छ — सेन्सर अड्किएको हुन सक्छ।`, en: `${META[t].en} has not changed for 3 hours — the sensor may be stuck.` } });
    }
  });

  let soil = null;
  const sm = S.series.soil_moisture;
  if (sm) {
    const cur = [...sm].reverse().find((x) => x !== null);
    if (cur !== undefined && sm.slice(-3).some((x) => x !== null)) {
      const thr = tg.t.soil_moisture[0];
      const h = dry.ready ? hoursToThreshold(dry, S, cur, thr) : null;
      soil = { current: rd(cur, 1), threshold: thr, hours_to_threshold: h, at_ts: h === null ? null : S.end + Math.round(h * 3600) };
    }
  }

  const needs = [];
  if (days < 3) needs.push({ ne: 'पूर्वानुमानका लागि कम्तीमा ३ दिनको तथ्याङ्क चाहिन्छ।', en: 'Forecasts need at least 3 days of data.' });
  if (!dry.ready) needs.push({ ne: 'सुक्ने गति सिक्न थप तथ्याङ्क चाहिन्छ।', en: 'More data is needed to learn the drying rate.' });
  if (!resp.ready) needs.push({ ne: `सिँचाइको असर सिक्न कम्तीमा ३ सिँचाइ चाहिन्छ (हाल ${resp.n || 0})।`, en: `At least 3 irrigation runs are needed to learn the response (now ${resp.n || 0}).` });

  const result = {
    generated_at: new Date().toISOString(), hours, targets: tg,
    data_status: { any_data: days > 0, days_of_data: rd(days, 1), coverage_24h: coverage, needs, models_ready: dry.ready && resp.ready },
    digest: buildDigest({ S, events, tg, anomalies, forecasts, dry, soil, flags }),
    anomalies, forecasts, soil, flags,
    models: { dry_down: dry.ready ? { ...dry, profile: undefined, beta: undefined } : dry, response: resp }
  };
  cache.set(key, { t: Date.now(), v: result });
  return result;
}

async function prepare(unitId, days) {
  const hours = Math.min(Math.max(days, 3), 30) * 24;
  const [S, events, tg] = await Promise.all([loadSeries(unitId, hours), loadEvents(unitId, hours), loadTargets(unitId)]);
  const dry = fitDryDown(S, events);
  const resp = await responseModel(unitId, events, hours);
  const reasons = [];
  if (!S.series.soil_moisture) reasons.push({ ne: 'यस इकाईमा माटो चिस्यान सेन्सरको तथ्याङ्क छैन।', en: 'This unit has no soil moisture data.' });
  if (!dry.ready) reasons.push({ ne: `सुक्ने मोडेलका लागि तथ्याङ्क पर्याप्त छैन (${dry.n}/${dry.need})।`, en: `Not enough data for the drying model (${dry.n}/${dry.need}).` });
  if (!resp.ready) reasons.push({ ne: `सिँचाइको असर सिक्न कम्तीमा ३ सिँचाइ चाहिन्छ (हाल ${resp.n || 0})।`, en: `At least 3 irrigation runs are needed (now ${resp.n || 0}).` });
  return { S, events, tg, dry, resp, reasons };
}

async function backtest(unitId, rule, days) {
  const p = await prepare(unitId, days);
  if (p.reasons.length) return { ready: false, reasons: p.reasons };
  const sim = simulate(rule, p.dry, p.resp.gain_per_min, p.S, p.tg, days);
  const act = actualStats(p.S, p.events, p.tg, days);
  if (!sim || !act) return { ready: false, reasons: [{ ne: 'तुलना गर्न पर्याप्त तथ्याङ्क छैन।', en: 'Not enough data to compare.' }] };
  const byTs = new Map(act.trace.map((x) => [x.ts, x.m]));
  const rows = sim.trace.map((x) => ({ ts: x.ts, sim: x.m, actual: byTs.has(x.ts) ? byTs.get(x.ts) : null }));
  return { ready: true, days, targets: p.tg.t.soil_moisture, model: { kind: p.dry.kind, r2: p.dry.r2, gain_per_min: p.resp.gain_per_min, response_runs: p.resp.n }, simulated: { ...sim, trace: undefined }, actual: { ...act, trace: undefined }, trace: rows };
}

async function recommendFor(unitId, actMaxS, cooldownS, days) {
  const p = await prepare(unitId, days);
  if (p.reasons.length) return { ready: false, reasons: p.reasons };
  const act = actualStats(p.S, p.events, p.tg, days);
  return { ready: true, days, targets: p.tg.t.soil_moisture, model: { kind: p.dry.kind, r2: p.dry.r2, gain_per_min: p.resp.gain_per_min, response_runs: p.resp.n }, actual: act && { ...act, trace: undefined }, options: recommend(p.dry, p.resp.gain_per_min, p.S, p.tg, days, actMaxS, cooldownS) };
}

module.exports = { insights, backtest, recommendFor, loadTargets };

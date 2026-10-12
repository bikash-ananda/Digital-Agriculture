import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ScatterChart, Scatter } from 'recharts';
import api from '../../services/api';
import { meta, hhmm, dayhm } from '../../utils/console';

const LV = { good: 'border-green-500 bg-green-50 text-green-900', warn: 'border-yellow-500 bg-yellow-50 text-yellow-900', info: 'border-blue-400 bg-blue-50 text-blue-900' };

function ForecastChart({ f, lang, t }) {
  const m = meta(f.type);
  const rows = useMemo(() => {
    if (!f.ready) return [];
    const last = f.history[f.history.length - 1];
    return [...f.history.map((p) => ({ ts: p.ts, actual: p.v })), { ts: last.ts, forecast: last.v, lo: last.v, hi: last.v }, ...f.forecast.map((p) => ({ ts: p.ts, forecast: p.v, lo: p.lo, hi: p.hi }))];
  }, [f]);
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h4 className="font-semibold text-terrace-900">{m.icon} {m[lang]} — {t('अर्को ६ घण्टा', 'next 6 hours')}</h4>
      {!f.ready ? (
        <p className="text-sm text-gray-500 py-8">{f.reason === 'learning' ? t(`सिक्दै छ: ${f.have_hours}/${f.need_hours} घण्टाको तथ्याङ्क`, `Learning: ${f.have_hours}/${f.need_hours} hours of data`) : f.reason === 'stale' ? t('ताजा तथ्याङ्क छैन', 'No fresh data') : t('यस इकाईमा यो सेन्सर छैन', 'No such sensor')}</p>
      ) : (
        <>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <ComposedChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" dataKey="ts" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={hhmm} tick={{ fontSize: 11 }} /><YAxis width={42} tick={{ fontSize: 12 }} domain={['auto', 'auto']} /><Tooltip labelFormatter={(v) => dayhm(v)} />
                <Line type="monotone" dataKey="actual" name={t('मापन', 'measured')} stroke={m.color} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="forecast" name={t('अनुमान', 'forecast')} stroke={m.color} strokeDasharray="5 4" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="hi" name="80% hi" stroke="#94a3b8" strokeWidth={1} dot={false} isAnimationActive={false} /><Line type="monotone" dataKey="lo" name="80% lo" stroke="#94a3b8" strokeWidth={1} dot={false} isAnimationActive={false} /></ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500">{t('विगत ३ दिनमा यो विधिको औसत त्रुटि', 'Typical error of this method over the last 3 days')}: ±{f.rmse[2] ?? '—'} {m.unit} (3 h), ±{f.rmse[5] ?? '—'} {m.unit} (6 h)</p>
        </>
      )}
    </div>
  );
}

export default function InsightsTab({ id, lang, t }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState([]);
  const [pick, setPick] = useState('');
  const load = (fresh) => { setBusy(true); api.get(`/ai/units/${id}/insights`, { params: fresh ? { fresh: 1 } : {} }).then((r) => { setD(r.data); setErr(''); }).catch((e) => setErr(e.response?.data?.message || 'Failed to load')).finally(() => setBusy(false)); };
  useEffect(() => { load(false); api.get(`/ai/units/${id}/digests`, { params: { days: 14 } }).then((r) => setHist(r.data)).catch(() => {}); }, [id]);
  const dg = pick ? (hist.find((h) => h.day === pick) || {}).digest : d && d.digest;

  if (err) return <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{err}</div>;
  if (!d) return <p className="text-gray-500">…</p>;
  const ds = d.data_status;
  const dry = d.models.dry_down;
  const resp = d.models.response;
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-60">
          <p className="text-sm text-gray-600">{t('एआईले सिकेको तथ्याङ्क', 'Data the AI has learned from')}: <b>{ds.days_of_data}</b> {t('दिन', 'days')} · {t('मोडेल', 'models')}: <b>{ds.models_ready ? t('तयार', 'ready') : t('सिक्दै', 'learning')}</b></p>
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-agri-green" style={{ width: `${Math.min(100, (ds.days_of_data / 7) * 100)}%` }} /></div>
          <p className="mt-1 text-xs text-gray-500">{t('७ दिनको तथ्याङ्कपछि विश्लेषण बढी भरपर्दो हुन्छ। यो तथ्याङ्कमा आधारित गणितीय विश्लेषण हो, भाषा मोडेल होइन।', 'Analysis becomes more reliable after about 7 days. This is statistical analysis of your own data, not a language model.')}</p>
        </div>
        <button onClick={() => load(true)} disabled={busy} className="bg-gov-blue text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50">{busy ? '…' : `↻ ${t('फेरि विश्लेषण', 'Re-analyse')}`}</button>
      </div>
      {ds.needs.length > 0 && <ul className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900 list-disc pl-6">{ds.needs.map((n, i) => <li key={i}>{lang === 'en' ? n.en : n.ne}</li>)}</ul>}

      {dg && (
        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display font-bold text-xl text-terrace-900">🗒️ {t('दैनिक सारांश', 'Daily digest')}</h3>
            {hist.length > 0 && <select value={pick} onChange={(e) => setPick(e.target.value)} className="ml-auto border rounded-md p-1.5 text-sm bg-white"><option value="">{t('आजको (प्रत्यक्ष)', 'Today (live)')}</option>{hist.map((h) => <option key={h.day} value={h.day}>{h.day}</option>)}</select>}
          </div>
          <p className={`mt-2 inline-block px-3 py-1 rounded-full text-sm font-semibold ${dg.headline.level === 'good' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-900'}`}>{lang === 'en' ? dg.headline.en : dg.headline.ne}</p>
          <ul className="mt-3 space-y-2">{dg.bullets.map((b, i) => <li key={i} className={`border-l-4 rounded p-2.5 text-sm ${LV[b.level] || LV.info}`}>{lang === 'en' ? b.en : b.ne}</li>)}</ul>
          {dg.actions.length > 0 && <div className="mt-3"><p className="font-semibold text-sm text-terrace-800">{t('सुझाव', 'Suggestions')}</p><ul className="list-disc pl-5 text-sm text-gray-800">{dg.actions.map((a, i) => <li key={i}>{lang === 'en' ? a.en : a.ne}</li>)}</ul></div>}
        </div>
      )}

      {d.soil && (
        <div className="grid md:grid-cols-3 gap-5">
          <div className="bg-white rounded-xl shadow p-4"><p className="text-sm text-gray-600">🌱 {t('हालको माटो चिस्यान', 'Soil moisture now')}</p><p className="text-3xl font-display font-bold text-terrace-800">{d.soil.current}%</p></div>
          <div className="bg-white rounded-xl shadow p-4"><p className="text-sm text-gray-600">⏳ {t(`${d.soil.threshold}% पुग्न`, `Time until ${d.soil.threshold}%`)}</p><p className="text-3xl font-display font-bold text-terrace-800">{d.soil.hours_to_threshold === null ? '—' : `${d.soil.hours_to_threshold} h`}</p><p className="text-xs text-gray-500">{d.soil.at_ts ? `≈ ${dayhm(d.soil.at_ts)}` : t('सुक्ने मोडेल तयार भएपछि देखिन्छ', 'Shown once the drying model is ready')}</p></div>
          <div className="bg-white rounded-xl shadow p-4"><p className="text-sm text-gray-600">💦 {t('प्रति मिनेट सिँचाइको असर', 'Effect of one irrigation minute')}</p><p className="text-3xl font-display font-bold text-terrace-800">{resp.ready ? `+${resp.gain_per_min}%` : '—'}</p><p className="text-xs text-gray-500">{resp.ready ? t(`${resp.n} सिँचाइबाट; असर देखिन करिब ${resp.lag_min} मिनेट`, `from ${resp.n} runs; about ${resp.lag_min} min until the probe responds`) : t('कम्तीमा ३ सिँचाइ चाहिन्छ', 'needs at least 3 irrigation runs')}</p></div>
        </div>
      )}

      <div className="grid xl:grid-cols-3 gap-5">{['temperature', 'humidity', 'soil_moisture'].map((k) => <ForecastChart key={k} f={d.forecasts[k]} lang={lang} t={t} />)}</div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow p-4">
          <h4 className="font-semibold text-terrace-900 mb-2">🚨 {t('असामान्य अवधि (गत २४ घण्टा)', 'Unusual periods (last 24 h)')}</h4>
          {d.anomalies.length === 0 ? <p className="text-sm text-green-700 bg-green-50 rounded p-3">{t('आफ्नै सामान्य ढाँचाभन्दा फरक केही भेटिएन।', 'Nothing unusual compared with the greenhouse’s own normal pattern.')}</p> : (
            <ul className="space-y-2">{d.anomalies.map((a, i) => (
              <li key={i} className="border-l-4 border-yellow-500 bg-yellow-50 rounded p-2.5 text-sm">
                <b>{a.label[lang]}</b> {t('सामान्यभन्दा', 'was unusually')} {a.direction === 'high' ? t('उच्च', 'high') : t('न्यून', 'low')} {t('करिब', 'for about')} {a.minutes} {t('मिनेट', 'min')} ({dayhm(a.start)}): {a.value}{a.unit} {t('देखियो, अपेक्षित', 'seen, expected')} ≈ {a.expected}{a.unit}.
              </li>
            ))}</ul>
          )}
          <p className="mt-2 text-xs text-gray-500">{t('पम्प चलेको समय र त्यसपछिको असर यसमा गनिँदैन।', 'Pump runs and their immediate effect are excluded.')}</p>
          {d.flags.length > 0 && <ul className="mt-3 space-y-1">{d.flags.map((f, i) => <li key={i} className="text-sm bg-red-50 text-red-800 rounded p-2">⚠ {lang === 'en' ? f.message.en : f.message.ne}</li>)}</ul>}
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h4 className="font-semibold text-terrace-900 mb-2">🔬 {t('सिकेका मोडेल (अनुसन्धानका लागि)', 'Learned models (for research)')}</h4>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between border-b py-1"><dt className="text-gray-600">{t('माटो सुक्ने मोडेल', 'Soil drying model')}</dt><dd className="font-semibold">{dry.ready ? `${dry.kind === 'regression' ? t('प्रकाश/तापक्रम सहित', 'light + temperature') : t('दैनिक ढाँचा', 'daily pattern')} · n=${dry.n}${dry.r2 !== null ? ` · R²=${dry.r2}` : ''}` : t(`तयार छैन (${dry.n}/${dry.need})`, `not ready (${dry.n}/${dry.need})`)}</dd></div>
            {dry.ready && <div className="flex justify-between border-b py-1"><dt className="text-gray-600">{t('सुक्ने गति (दिन / रात)', 'Drying rate (day / night)')}</dt><dd className="font-semibold">{dry.day_rate_per_h} / {dry.night_rate_per_h} %/h</dd></div>}
            <div className="flex justify-between border-b py-1"><dt className="text-gray-600">{t('सिँचाइको असर', 'Irrigation response')}</dt><dd className="font-semibold">{resp.ready ? `+${resp.gain_per_min} %/min · ${resp.median_minutes} min` : t('तयार छैन', 'not ready')}</dd></div>
            <div className="flex justify-between py-1"><dt className="text-gray-600">{t('लक्ष्य दायरा स्रोत', 'Target range source')}</dt><dd className="font-semibold">{d.targets.source}</dd></div>
          </dl>
          {resp.ready && resp.events.length > 2 && (
            <div className="mt-3"><p className="text-xs text-gray-600 mb-1">{t('सिँचाइ अवधि बनाम माटो चिस्यान वृद्धि', 'Irrigation minutes vs moisture gain')}</p>
              <div style={{ width: '100%', height: 170 }}><ResponsiveContainer><ScatterChart margin={{ top: 5, right: 10, left: 0, bottom: 15 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" dataKey="minutes" name="min" tick={{ fontSize: 11 }} label={{ value: 'min', position: 'bottom', offset: 0, fontSize: 11 }} /><YAxis type="number" dataKey="gain" name="%" width={36} tick={{ fontSize: 11 }} /><Tooltip /><Scatter data={resp.events} fill="#15803d" /></ScatterChart></ResponsiveContainer></div></div>
          )}
        </div>
      </div>
    </div>
  );
}

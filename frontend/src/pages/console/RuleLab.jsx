import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceArea } from 'recharts';
import api from '../../services/api';
import { dur } from '../../utils/console';
import { errMsgs } from '../../utils/errors';

const inp = 'mt-1 w-full border rounded-md p-2 bg-white';

export default function RuleLab({ id, ov, canCfg, onCreated, setErrs, lang, t }) {
  const soilAct = ov.actuators.find((a) => a.type === 'irrigation');
  const [sensors, setSensors] = useState([]);
  const [f, setF] = useState({ start: 35, stop: 46, run: Math.min(300, soilAct ? soilAct.max_runtime_seconds : 300), rest: 30, from: '', to: '', days: 14 });
  const [lab, setLab] = useState(null);
  const [rec, setRec] = useState(null);
  const [busy, setBusy] = useState('');
  useEffect(() => { api.get(`/smart/units/${id}/live`).then((r) => setSensors(r.data.sensors)).catch(() => {}); }, [id]);

  const body = () => ({ start_threshold: Number(f.start), stop_threshold: Number(f.stop), max_runtime_seconds: Number(f.run), min_interval_seconds: Number(f.rest) * 60, schedule_from: f.from || undefined, schedule_to: f.to || undefined, days: Number(f.days) });
  const runBacktest = async () => { setBusy('bt'); setErrs([]); setLab(null); try { setLab((await api.post(`/ai/units/${id}/backtest`, body())).data); } catch (e) { setErrs(errMsgs(e)); } finally { setBusy(''); } };
  const runRecommend = async () => {
    setBusy('rc'); setErrs([]); setRec(null);
    try { setRec((await api.post(`/ai/units/${id}/recommend`, { actuator_max_seconds: soilAct ? soilAct.max_runtime_seconds : 900, min_interval_seconds: Number(f.rest) * 60, days: Number(f.days) })).data); }
    catch (e) { setErrs(errMsgs(e)); } finally { setBusy(''); }
  };
  const createFrom = async (o) => {
    setErrs([]);
    const sensor = sensors.find((s) => s.sensor_type === 'soil_moisture');
    if (!soilAct || !sensor) { setErrs([t('सिँचाइ पम्प वा माटो सेन्सर भेटिएन', 'No irrigation pump or soil sensor found')]); return; }
    try {
      await api.post(`/smart/units/${id}/rules`, { actuator_id: soilAct.id, sensor_id: sensor.id, name: `AI: start ${o.start_threshold}% stop ${o.stop_threshold}%`, comparison: 'lt', start_threshold: o.start_threshold, stop_threshold: o.stop_threshold, max_runtime_seconds: o.max_runtime_seconds, min_interval_seconds: o.min_interval_seconds, is_enabled: false });
      onCreated();
      window.alert(t('नियम निष्क्रिय अवस्थामा थपियो। जाँचेर मात्र सक्रिय गर्नुहोस्।', 'The rule was added switched OFF. Review it, then enable it.'));
    } catch (e) { setErrs(errMsgs(e)); }
  };

  const row = (k, label, unit, lowerBetter) => {
    if (!lab) return null;
    const a = lab.actual[k];
    const s = lab.simulated[k];
    const better = a !== null && s !== null && (lowerBetter ? s < a : s > a);
    return <tr className="border-t"><td className="p-2">{label}</td><td className="p-2">{a ?? '—'}{unit}</td><td className={`p-2 font-semibold ${better ? 'text-agri-green' : ''}`}>{s ?? '—'}{unit}</td></tr>;
  };

  return (
    <section className="bg-white rounded-xl shadow p-5 space-y-4">
      <div>
        <h3 className="font-display font-bold text-xl text-terrace-900">🧪 {t('नियम परीक्षण प्रयोगशाला', 'Rule lab')}</h3>
        <p className="text-sm text-gray-600">{t('आफ्नै विगतको तथ्याङ्कमा सिँचाइ नियम चलाएर के हुन्थ्यो भनी अनुमान गर्नुहोस् — पम्प नचलाई।', 'See what an irrigation rule would have done on your own past data — without touching the pump.')}</p>
      </div>
      <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
        <label>{t('सुरु (भन्दा कम %)', 'Start below (%)')}<input type="number" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} className={inp} /></label>
        <label>{t('रोक्ने (%)', 'Stop at (%)')}<input type="number" value={f.stop} onChange={(e) => setF({ ...f, stop: e.target.value })} className={inp} /></label>
        <label>{t('अधिकतम (से.)', 'Max run (s)')}<input type="number" min="10" max={soilAct ? soilAct.max_runtime_seconds : 900} value={f.run} onChange={(e) => setF({ ...f, run: e.target.value })} className={inp} /></label>
        <label>{t('आराम (मि.)', 'Rest (min)')}<input type="number" min="0" value={f.rest} onChange={(e) => setF({ ...f, rest: e.target.value })} className={inp} /></label>
        <label>{t('समय देखि (नेपाल)', 'From (Nepal time)')}<input type="time" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={inp} /></label>
        <label>{t('समय सम्म', 'To')}<input type="time" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={inp} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">{t('परीक्षण अवधि', 'Test on the last')} <select value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} className="border rounded-md p-1.5 bg-white">{[7, 14, 30].map((d) => <option key={d}>{d}</option>)}</select> {t('दिन', 'days')}</label>
        <button disabled={!!busy} onClick={runBacktest} className="bg-gov-blue text-white px-4 py-2 rounded-md font-semibold text-sm disabled:opacity-50">{busy === 'bt' ? '…' : t('यो नियम परीक्षण गर्नुहोस्', 'Test this rule')}</button>
        <button disabled={!!busy} onClick={runRecommend} className="bg-agri-green text-white px-4 py-2 rounded-md font-semibold text-sm disabled:opacity-50">{busy === 'rc' ? '…' : `✨ ${t('उत्तम सेटिङ खोज्नुहोस्', 'Find better settings')}`}</button>
      </div>

      {[lab, rec].filter((x) => x && x.ready === false).map((x, i) => (
        <ul key={i} className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900 list-disc pl-6">{x.reasons.map((r, j) => <li key={j}>{lang === 'en' ? r.en : r.ne}</li>)}</ul>
      ))}

      {lab && lab.ready && (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm max-w-xl">
              <thead className="bg-gray-100 text-left"><tr><th className="p-2" /><th className="p-2">{t('वास्तविक (विगत)', 'Actual (past)')}</th><th className="p-2">{t('यो नियम (अनुमान)', 'This rule (estimate)')}</th></tr></thead>
              <tbody>
                {row('time_in_band_pct', t('दायरा भित्र समय', 'Time in range'), '%', false)}{row('runs_per_day', t('दिनको सिँचाइ', 'Runs per day'), '', true)}
                {row('pump_min_per_day', t('पम्प मिनेट/दिन', 'Pump min/day'), '', true)}{row('below_critical_h_per_day', t('अति सुक्खा घण्टा/दिन', 'Too-dry hours/day'), '', true)}{row('min_moisture', t('न्यूनतम चिस्यान', 'Lowest moisture'), '%', false)}
              </tbody>
            </table>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={lab.trace}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="ts" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(v) => new Date(v * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' })} tick={{ fontSize: 11 }} />
                <YAxis width={40} domain={['auto', 'auto']} tick={{ fontSize: 12 }} /><Tooltip labelFormatter={(v) => new Date(v * 1000).toLocaleString()} /><Legend />
                <ReferenceArea y1={lab.targets[0]} y2={lab.targets[1]} fill="#86efac" fillOpacity={0.2} />
                <Line type="monotone" dataKey="actual" name={t('वास्तविक', 'actual')} stroke="#64748b" dot={false} strokeWidth={2} isAnimationActive={false} />
                <Line type="monotone" dataKey="sim" name={t('यो नियम', 'this rule')} stroke="#15803d" dot={false} strokeWidth={2.5} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500">{t(`मोडेल: ${lab.model.kind === 'regression' ? 'प्रकाश/तापक्रम' : 'दैनिक ढाँचा'}, ${lab.model.response_runs} सिँचाइबाट प्रति मिनेट +${lab.model.gain_per_min}%। यो सरल अनुमान हो: पानी प्रोबसम्म पुग्ने ढिलाइ र सुक्खा माटोमा सुक्ने गति घट्ने कुरा समावेश छैन।`, `Model: ${lab.model.kind === 'regression' ? 'light + temperature' : 'daily pattern'}, +${lab.model.gain_per_min}% per minute from ${lab.model.response_runs} runs. A simplified estimate: it ignores the delay before water reaches the probe and the slower drying of dry soil.`)}</p>
        </div>
      )}

      {rec && rec.ready && (
        <div className="space-y-3">
          <h4 className="font-semibold text-terrace-900">{t('सुझाव गरिएका सेटिङ', 'Suggested settings')} <span className="text-xs font-normal text-gray-500">({t('लक्ष्य दायरा', 'target range')} {rec.targets[0]}–{rec.targets[1]}%)</span></h4>
          {rec.actual && <p className="text-sm text-gray-600">{t('हालको वास्तविक', 'Actual now')}: {rec.actual.time_in_band_pct}% {t('दायरा भित्र', 'in range')}, {rec.actual.pump_min_per_day} {t('पम्प मिनेट/दिन', 'pump min/day')}</p>}
          <div className="grid md:grid-cols-3 gap-4">
            {rec.options.map((o, i) => (
              <div key={i} className={`rounded-xl border p-4 ${i === 0 ? 'border-agri-green bg-terrace-50' : 'bg-white'}`}>
                {i === 0 && <p className="text-xs font-bold text-agri-green mb-1">★ {t('सर्वोत्तम अनुमान', 'Best estimate')}</p>}
                <p className="font-semibold text-terrace-900">{t('सुरु', 'Start')} &lt; {o.rule.start_threshold}% → {t('रोक्ने', 'stop')} {o.rule.stop_threshold}%</p>
                <p className="text-sm text-gray-700">{t('अधिकतम', 'Max')} {dur(o.rule.max_runtime_seconds)} · {t('आराम', 'rest')} {Math.round(o.rule.min_interval_seconds / 60)} min</p>
                <ul className="mt-2 text-sm space-y-0.5">
                  <li>{t('दायरा भित्र', 'In range')}: <b>{o.result.time_in_band_pct}%</b></li><li>{t('सिँचाइ/दिन', 'Runs/day')}: <b>{o.result.runs_per_day}</b></li>
                  <li>{t('पम्प मिनेट/दिन', 'Pump min/day')}: <b>{o.result.pump_min_per_day}</b></li><li>{t('अति सुक्खा घण्टा/दिन', 'Too-dry h/day')}: <b>{o.result.below_critical_h_per_day}</b></li>
                </ul>
                {canCfg && <button onClick={() => createFrom(o.rule)} className="mt-3 w-full bg-gov-blue text-white py-2 rounded-md text-sm font-semibold">{t('निष्क्रिय नियम बनाउनुहोस्', 'Create as a rule (off)')}</button>}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">{t('यी अनुमान हुन्। नियम पहिले निष्क्रिय बनाइन्छ — पहिलो हप्ता नजिकबाट हेर्नुहोस् र बाली विशेषज्ञसँग पुष्टि गर्नुहोस्।', 'These are estimates. The rule is created switched OFF — watch the first week closely and confirm with a crop specialist.')}</p>
        </div>
      )}
    </section>
  );
}

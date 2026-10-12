import { useEffect, useState } from 'react';
import api from '../../services/api';
import { dur } from '../../utils/console';
import { errMsgs } from '../../utils/errors';
import RuleLab from './RuleLab';

const STATE = {
  running: ['bg-green-100 text-green-800', 'चलिरहेको', 'Running'], will_start: ['bg-green-100 text-green-800', 'सुरु हुँदैछ', 'About to start'], idle: ['bg-gray-100 text-gray-700', 'प्रतीक्षामा', 'Idle'],
  waiting: ['bg-yellow-100 text-yellow-900', 'पर्खिँदै', 'Waiting'], blocked: ['bg-red-100 text-red-800', 'रोकिएको', 'Blocked'], disabled: ['bg-gray-200 text-gray-600', 'निष्क्रिय', 'Off']
};
const CMP = { lt: '<', lte: '≤', gt: '>', gte: '≥' };
const inp = 'mt-1 w-full border rounded-md p-2 bg-white';

export default function AutomationTab({ id, ov, lang, t, can }) {
  const [rules, setRules] = useState([]);
  const [errs, setErrs] = useState([]);
  const [sensors, setSensors] = useState([]);
  const canCfg = can('automation.configure');
  const blank = { name: '', actuator_id: '', sensor_id: '', comparison: 'lt', start_threshold: '', stop_threshold: '', max_runtime_seconds: 120, rest_min: 30, from: '', to: '' };
  const [d, setD] = useState(blank);

  const loadRules = () => api.get(`/console/units/${id}/automation-status`).then((r) => setRules(r.data)).catch((e) => setErrs(errMsgs(e)));
  useEffect(() => { loadRules(); const iv = setInterval(loadRules, 15000); return () => clearInterval(iv); }, [id]);
  useEffect(() => { api.get(`/smart/units/${id}/live`).then((r) => setSensors(r.data.sensors)).catch(() => {}); }, [id]);

  const toggle = async (r) => { setErrs([]); try { await api.put(`/smart/rules/${r.id}`, { is_enabled: !r.is_enabled }); loadRules(); } catch (e) { setErrs(errMsgs(e)); } };
  const del = async (r) => { if (!window.confirm(t('नियम मेट्ने?', 'Delete this rule?'))) return; try { await api.delete(`/smart/rules/${r.id}`); loadRules(); } catch (e) { setErrs(errMsgs(e)); } };
  const save = async (e) => {
    e.preventDefault(); setErrs([]);
    try {
      await api.post(`/smart/units/${id}/rules`, { name: d.name, actuator_id: d.actuator_id, sensor_id: d.sensor_id, comparison: d.comparison, start_threshold: d.start_threshold, stop_threshold: d.stop_threshold,
        max_runtime_seconds: d.max_runtime_seconds, min_interval_seconds: Number(d.rest_min) * 60, schedule_from: d.from || undefined, schedule_to: d.to || undefined, is_enabled: false });
      setD(blank); loadRules();
    } catch (err) { setErrs(errMsgs(err)); }
  };

  return (
    <div className="space-y-8">
      {errs.length > 0 && <ul role="alert" className="p-3 bg-red-50 text-red-700 rounded text-sm list-disc pl-6">{errs.map((x, i) => <li key={i}>{x}</li>)}</ul>}

      <section className="space-y-3">
        <h3 className="font-display font-bold text-xl text-terrace-900">{t('नियम र तिनको हालको अवस्था', 'Rules and what they are doing now')}</h3>
        {rules.length === 0 && <p className="text-sm text-gray-500">{t('कुनै नियम छैन — तल परीक्षण गरी बनाउनुहोस्।', 'No rules yet — test and create one below.')}</p>}
        {rules.map((r) => {
          const s = STATE[r.state] || STATE.idle;
          return (
            <div key={r.id} className="bg-white rounded-xl shadow p-4 flex flex-wrap items-start gap-4">
              <div className="flex-1 min-w-64">
                <p className="font-semibold text-terrace-900">{r.name}</p>
                <p className="text-sm text-gray-700">
                  {t('जब', 'When')} <b>{r.sensor_name}</b> {CMP[r.comparison]} <b>{r.start_threshold}{r.sensor_unit || ''}</b> → <b>{r.actuator_name}</b> {t('चल्छ', 'starts')}; {t('रोक्ने', 'stops at')} <b>{r.stop_threshold}{r.sensor_unit || ''}</b>,
                  {' '}{t('अधिकतम', 'max')} {dur(r.max_runtime_seconds)}, {t('आराम', 'rest')} {Math.round(r.min_interval_seconds / 60)} min{r.schedule_from ? `, ${String(r.schedule_from).slice(0, 5)}–${String(r.schedule_to).slice(0, 5)}` : ''}
                </p>
                <p className="mt-1 text-sm"><span className={`px-2 py-0.5 rounded text-xs font-semibold mr-2 ${s[0]}`}>{lang === 'en' ? s[2] : s[1]}</span>{lang === 'en' ? r.why.en : r.why.ne}</p>
              </div>
              {canCfg && (
                <div className="flex items-center gap-2">
                  <button onClick={() => toggle(r)} className={`px-3 py-1.5 rounded-md text-sm font-semibold ${r.is_enabled ? 'bg-agri-green text-white' : 'bg-gray-200'}`}>{r.is_enabled ? t('सक्रिय', 'On') : t('निष्क्रिय', 'Off')}</button>
                  <button onClick={() => del(r)} className="px-3 py-1.5 border border-gov-red text-gov-red rounded-md text-sm">{t('मेट्नुहोस्', 'Delete')}</button>
                </div>
              )}
            </div>
          );
        })}
        <p className="text-xs text-gray-500">{t('समय सीमा नेपाल समय (UTC+५:४५) मा हुन्छ। नियम चल्न पम्प “स्वचालित” मोडमा हुनुपर्छ। पम्पको आफ्नै सुरक्षा सीमा सधैं लागू हुन्छ।', 'Time windows use Nepal time (UTC+5:45). A pump must be in Auto mode for rules to run. The pump’s own safety limits always apply.')}</p>
      </section>

      <RuleLab id={id} ov={ov} canCfg={canCfg} onCreated={loadRules} setErrs={setErrs} lang={lang} t={t} />

      {canCfg && (
        <section className="bg-white rounded-xl shadow p-5">
          <h3 className="font-display font-bold text-xl text-terrace-900 mb-1">{t('हातैले नयाँ नियम बनाउनुहोस्', 'Create a rule by hand')}</h3>
          <p className="text-xs text-gray-500 mb-3">{t('मिस्टिङ (आर्द्रता) जस्ता अन्य नियम यहाँ बनाउनुहोस्। नियम सधैं निष्क्रिय अवस्थामा सुरु हुन्छ।', 'Use this for other rules, such as misting on humidity. Rules always start switched off.')}</p>
          <form onSubmit={save} className="grid sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
            <label className="sm:col-span-3 lg:col-span-4">{t('नाम', 'Name')}<input required value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} className={inp} /></label>
            <label>{t('सेन्सर', 'Sensor')}<select required value={d.sensor_id} onChange={(e) => setD({ ...d, sensor_id: e.target.value })} className={inp}><option value="">-</option>{sensors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label>{t('सर्त', 'Condition')}<select value={d.comparison} onChange={(e) => setD({ ...d, comparison: e.target.value })} className={inp}><option value="lt">{t('भन्दा कम', 'below')}</option><option value="gt">{t('भन्दा बढी', 'above')}</option></select></label>
            <label>{t('सुरु सीमा', 'Start threshold')}<input required type="number" step="any" value={d.start_threshold} onChange={(e) => setD({ ...d, start_threshold: e.target.value })} className={inp} /></label>
            <label>{t('रोक्ने सीमा', 'Stop threshold')}<input required type="number" step="any" value={d.stop_threshold} onChange={(e) => setD({ ...d, stop_threshold: e.target.value })} className={inp} /></label>
            <label>{t('पम्प', 'Pump')}<select required value={d.actuator_id} onChange={(e) => setD({ ...d, actuator_id: e.target.value })} className={inp}><option value="">-</option>{ov.actuators.map((a) => <option key={a.id} value={a.id}>{a.name} (max {dur(a.max_runtime_seconds)})</option>)}</select></label>
            <label>{t('अधिकतम (से.)', 'Max run (s)')}<input type="number" min="10" value={d.max_runtime_seconds} onChange={(e) => setD({ ...d, max_runtime_seconds: e.target.value })} className={inp} /></label>
            <label>{t('आराम (मि.)', 'Rest (min)')}<input type="number" min="0" value={d.rest_min} onChange={(e) => setD({ ...d, rest_min: e.target.value })} className={inp} /></label>
            <span />
            <label>{t('समय देखि', 'From')}<input type="time" value={d.from} onChange={(e) => setD({ ...d, from: e.target.value })} className={inp} /></label>
            <label>{t('समय सम्म', 'To')}<input type="time" value={d.to} onChange={(e) => setD({ ...d, to: e.target.value })} className={inp} /></label>
            <div className="sm:col-span-3 lg:col-span-4"><button className="bg-agri-green text-white px-5 py-2 rounded-md font-semibold">{t('नियम सुरक्षित गर्नुहोस् (निष्क्रिय)', 'Save rule (off)')}</button></div>
          </form>
        </section>
      )}
    </div>
  );
}

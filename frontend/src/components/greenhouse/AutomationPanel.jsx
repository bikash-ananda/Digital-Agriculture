import { useEffect, useState } from 'react';
import api from '../../services/api';
import FormField, { inputCls } from '../common/FormField';
import { errMsgs } from '../../utils/errors';
import { CMP } from '../../utils/greenhouse';

export default function AutomationPanel({ unitId, live, can, t }) {
  const [rules, setRules] = useState([]);
  const [sugs, setSugs] = useState([]);
  const [errs, setErrs] = useState([]);
  const [note, setNote] = useState('');
  const [show, setShow] = useState(false);
  const canCfg = can('automation.configure');
  const blank = { actuator_id: '', sensor_id: '', name: '', comparison: 'lt', start_threshold: '', stop_threshold: '', max_runtime_seconds: '300', min_interval_seconds: '1800', schedule_from: '', schedule_to: '', is_enabled: false };
  const [f, setF] = useState(blank);

  const load = () => {
    api.get(`/smart/units/${unitId}/rules`).then((r) => setRules(r.data)).catch((e) => setErrs(errMsgs(e)));
    if (canCfg) api.get(`/smart/units/${unitId}/rules/suggestions`).then((r) => setSugs(r.data)).catch(() => setSugs([]));
  };
  useEffect(() => { load(); }, [unitId]);

  const post = async (body) => {
    setErrs([]); setNote('');
    try {
      const r = await api.post(`/smart/units/${unitId}/rules`, body);
      if (r.data.note) setNote(r.data.note);
      setShow(false); setF(blank); load();
    } catch (e) { setErrs(errMsgs(e)); }
  };
  const toggle = async (r) => {
    setErrs([]);
    try { await api.put(`/smart/rules/${r.id}`, { is_enabled: !r.is_enabled }); load(); } catch (e) { setErrs(errMsgs(e)); }
  };
  const del = async (r) => {
    if (!window.confirm(t('नियम मेट्ने?', 'Delete this rule?'))) return;
    try { await api.delete(`/smart/rules/${r.id}`); load(); } catch (e) { setErrs(errMsgs(e)); }
  };
  const sf = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => { e.preventDefault(); post({ ...f, is_enabled: !!f.is_enabled }); };

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded p-4 text-sm space-y-1">
        <p className="font-semibold">🤖 {t('स्वचालन कसरी काम गर्छ', 'How automation works')}</p>
        <ul className="list-disc pl-5">
          <li>{t('सर्भरले हरेक ३० सेकेन्डमा सेन्सर मान जाँचेर नियम लागू गर्छ।', 'The server checks sensor values every 30 seconds and applies the rules.')}</li>
          <li>{t('सुरु र रोक्ने सीमा फरक राखिन्छ (हिस्टेरेसिस) ताकि रिले बारम्बार on/off नहोस्।', 'Start and stop thresholds differ (hysteresis) so relays do not chatter.')}</li>
          <li>{t('अधिकतम चल्ने समय, न्यूनतम अन्तराल र समय तालिका लागू हुन्छन्।', 'Maximum runtime, minimum interval and an optional time window apply.')}</li>
          <li>{t('सेन्सर पुरानो वा यन्त्र अफलाइन भए सुरक्षाका लागि एक्चुएटर बन्द गरिन्छ।', 'If a sensor is stale or the device is offline, the actuator is switched off as a fail-safe.')}</li>
          <li>{t('नियम चल्न एक्चुएटर “स्वचालित” मोडमा हुनुपर्छ।', 'A rule only runs while its actuator is in AUTO mode.')}</li>
        </ul>
      </div>

      {errs.length > 0 && <ul className="p-3 bg-red-50 text-red-700 rounded text-sm list-disc pl-6">{errs.map((x, i) => <li key={i}>{x}</li>)}</ul>}
      {note && <p className="p-3 bg-yellow-50 text-yellow-900 rounded text-sm">{note}</p>}

      <div className="space-y-3">
        <h3 className="font-semibold text-gov-blue">{t('नियमहरू', 'Rules')} ({rules.length})</h3>
        {rules.length === 0 && <p className="text-sm text-gray-500">{t('कुनै नियम छैन', 'No rules yet')}</p>}
        {rules.map((r) => (
          <div key={r.id} className={`bg-white rounded-lg shadow p-4 border-l-4 ${r.is_enabled ? 'border-green-500' : 'border-gray-300'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.name}</p>
                <p className="text-sm text-gray-700">
                  {t('यदि', 'If')} <b>{r.sensor_name}</b> {CMP[r.comparison]} <b>{r.start_threshold}</b> → <b>{r.actuator_name} ON</b>; {t('रोक्ने', 'stop at')} <b>{r.stop_threshold}</b>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {t('अधिकतम', 'max')} {r.max_runtime_seconds}s · {t('न्यूनतम अन्तराल', 'min interval')} {r.min_interval_seconds}s
                  {r.schedule_from ? ` · ${String(r.schedule_from).slice(0, 5)}–${String(r.schedule_to).slice(0, 5)}` : ''}
                  {r.last_started_at ? ` · ${t('अन्तिम सुरु', 'last start')}: ${new Date(r.last_started_at).toLocaleString()}` : ''}
                </p>
                {r.control_mode !== 'auto' && <p className="text-xs text-yellow-700 mt-1">⚠ {t('एक्चुएटर म्यानुअल मोडमा छ — नियम चल्दैन', 'Actuator is in MANUAL mode — this rule will not run')}</p>}
              </div>
              {canCfg && (
                <div className="flex items-center gap-2">
                  <button onClick={() => toggle(r)} className={`px-3 py-1.5 rounded text-sm font-semibold ${r.is_enabled ? 'bg-agri-green text-white' : 'bg-gray-200'}`}>{r.is_enabled ? t('सक्रिय', 'Enabled') : t('निष्क्रिय', 'Disabled')}</button>
                  <button onClick={() => del(r)} className="px-3 py-1.5 border border-gov-red text-gov-red rounded text-sm">{t('मेट्नुहोस्', 'Delete')}</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {canCfg && sugs.length > 0 && (
        <div>
          <h3 className="font-semibold text-gov-blue mb-2">✨ {t('सुझाव गरिएका नियम (बालीको लक्ष्य दायराबाट)', 'Suggested rules (from crop target ranges)')}</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {sugs.map((s) => (
              <div key={s.actuator_id} className="bg-white rounded-lg shadow p-4 text-sm">
                <p className="font-semibold">{s.name}</p>
                <p className="text-gray-600">{t('सुरु', 'Start')} {CMP[s.comparison]} {s.start_threshold} · {t('रोक्ने', 'Stop')} {s.stop_threshold} · max {s.max_runtime_seconds}s</p>
                <button onClick={() => post({ ...s, is_enabled: false })} className="mt-2 bg-gov-blue text-white px-3 py-1.5 rounded text-sm">+ {t('थप्नुहोस् (निष्क्रिय)', 'Add (disabled)')}</button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">{t('थपेपछि सीमाहरू जाँचेर सक्रिय गर्नुहोस्।', 'After adding, review the thresholds and then enable the rule.')}</p>
        </div>
      )}

      {canCfg && (
        <div>
          <button onClick={() => setShow(!show)} className="bg-agri-green text-white px-4 py-2 rounded text-sm font-semibold">+ {t('आफ्नै नियम बनाउनुहोस्', 'Create custom rule')}</button>
          {show && (
            <form onSubmit={submit} className="bg-white rounded-lg shadow p-4 mt-3 grid sm:grid-cols-3 gap-3">
              <FormField label={`${t('नाम', 'Name')} *`} className="sm:col-span-3"><input required value={f.name} onChange={sf('name')} className={inputCls} /></FormField>
              <FormField label={`${t('एक्चुएटर', 'Actuator')} *`}>
                <select required value={f.actuator_id} onChange={sf('actuator_id')} className={inputCls}><option value="">-</option>{live.actuators.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              </FormField>
              <FormField label={`${t('सेन्सर', 'Sensor')} *`}>
                <select required value={f.sensor_id} onChange={sf('sensor_id')} className={inputCls}><option value="">-</option>{live.sensors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              </FormField>
              <FormField label={t('सर्त', 'Condition')}>
                <select value={f.comparison} onChange={sf('comparison')} className={inputCls}><option value="lt">{t('भन्दा कम (<)', 'below (<)')}</option><option value="lte">≤</option><option value="gt">{t('भन्दा बढी (>)', 'above (>)')}</option><option value="gte">≥</option></select>
              </FormField>
              <FormField label={`${t('सुरु सीमा', 'Start threshold')} *`}><input required type="number" step="any" value={f.start_threshold} onChange={sf('start_threshold')} className={inputCls} /></FormField>
              <FormField label={`${t('रोक्ने सीमा', 'Stop threshold')} *`}><input required type="number" step="any" value={f.stop_threshold} onChange={sf('stop_threshold')} className={inputCls} /></FormField>
              <FormField label={t('अधिकतम समय (से.)', 'Max runtime (s)')}><input type="number" value={f.max_runtime_seconds} onChange={sf('max_runtime_seconds')} className={inputCls} /></FormField>
              <FormField label={t('न्यूनतम अन्तराल (से.)', 'Min interval (s)')}><input type="number" value={f.min_interval_seconds} onChange={sf('min_interval_seconds')} className={inputCls} /></FormField>
              <FormField label={t('समय देखि', 'Window from')}><input type="time" value={f.schedule_from} onChange={sf('schedule_from')} className={inputCls} /></FormField>
              <FormField label={t('समय सम्म', 'Window to')}><input type="time" value={f.schedule_to} onChange={sf('schedule_to')} className={inputCls} /></FormField>
              <label className="sm:col-span-3 text-sm flex items-center gap-2"><input type="checkbox" checked={f.is_enabled} onChange={(e) => setF({ ...f, is_enabled: e.target.checked })} /> {t('तुरुन्त सक्रिय गर्नुहोस्', 'Enable immediately')}</label>
              <div className="sm:col-span-3"><button className="bg-agri-green text-white px-4 py-2 rounded text-sm font-semibold">{t('सुरक्षित गर्नुहोस्', 'Save rule')}</button></div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import api from '../../services/api';
import StatusBadge from '../common/StatusBadge';
import { ACT_LABEL } from '../../utils/greenhouse';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function ActuatorCard({ a, offline, canControl, canConfigure, onDone, lang, t }) {
  const meta = ACT_LABEL[a.actuator_type] || ACT_LABEL.other;
  const options = [60, 300, 600, 900, 1800, 3600].filter((s) => s <= a.max_runtime_seconds);
  if (!options.includes(a.max_runtime_seconds) && a.max_runtime_seconds < 3600) options.push(a.max_runtime_seconds);
  const [dur, setDur] = useState(Math.min(300, a.max_runtime_seconds));
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const isOn = a.current_state === 'on';
  const relayChannel = a.relay_channel ?? (a.actuator_type === 'irrigation' ? 1 : a.actuator_type === 'misting' ? 2 : null);
  const unmapped = relayChannel == null;
  const label = (s) => (s >= 3600 ? `${s / 3600} ${t('घण्टा', 'h')}` : `${Math.round(s / 60)} ${t('मिनेट', 'min')}`);

  const send = async (command) => {
    if (command === 'on' && !window.confirm(t(
      `${a.name} लाई ${label(dur)} का लागि चलाउने? यसले वास्तविक रिलेमा आदेश पठाउनेछ।`,
      `Turn ${a.name} on for ${label(dur)}? This sends a command to a real relay.`
    ))) return;
    setBusy(true);
    setMsg({ kind: 'info', text: t('यन्त्रको प्रतीक्षा गर्दै…', 'Waiting for the device…') });
    try {
      const r = await api.post(`/smart/actuators/${a.id}/command`, command === 'on' ? { command, duration_seconds: dur } : { command });
      let finished = false;
      for (let i = 0; i < 30 && !finished; i++) {
        await wait(2000);
        const s = await api.get(`/smart/commands/${r.data.id}`);
        const st = s.data.status;
        if (st === 'acknowledged') { setMsg({ kind: 'ok', text: t('यन्त्रले आदेश पुष्टि गर्‍यो', 'Device confirmed the command') }); finished = true; }
        else if (['failed', 'expired', 'cancelled'].includes(st)) { setMsg({ kind: 'err', text: s.data.error_message || st }); finished = true; }
        if (i % 3 === 0) onDone();
      }
      if (!finished) setMsg({ kind: 'err', text: t('यन्त्रबाट जवाफ आएन', 'No response from the device') });
    } catch (e) {
      setMsg({ kind: 'err', text: e.response?.data?.message || 'Request failed' });
    } finally { setBusy(false); onDone(); }
  };

  const setMode = async (mode) => {
    if (mode === 'auto' && !window.confirm(t(
      `${a.name} लाई स्वचालित मोडमा राख्ने? सक्रिय नियमले वास्तविक उपकरण चलाउन सक्छ।`,
      `Set ${a.name} to automatic mode? An enabled rule may operate real equipment.`
    ))) return;
    try { await api.put(`/smart/actuators/${a.id}/mode`, { control_mode: mode }); onDone(); }
    catch (e) { setMsg({ kind: 'err', text: e.response?.data?.message || 'Request failed' }); }
  };

  const color = { info: 'text-blue-700 bg-blue-50', ok: 'text-green-700 bg-green-50', err: 'text-red-700 bg-red-50' };
  return (
    <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${isOn ? 'border-green-500' : 'border-gray-300'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gov-blue">{meta.icon} {a.name}</p>
          <p className="text-xs text-gray-500">{meta[lang]}{relayChannel ? ` · ${t('रिले', 'Relay')} ${relayChannel}${a.relay_channel == null ? ` (${t('पूर्वनिर्धारित', 'board default')})` : ''}` : ''} · {t('अधिकतम', 'max')} {label(a.max_runtime_seconds)}</p>
        </div>
        <StatusBadge value={a.current_state} />
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="text-gray-600">{t('मोड', 'Mode')}:</span>
        <div className="inline-flex rounded overflow-hidden border">
          {['manual', 'auto'].map((m) => (
            <button key={m} disabled={!canConfigure || a.control_mode === m} onClick={() => setMode(m)}
              className={`px-3 py-1 ${a.control_mode === m ? 'bg-gov-blue text-white' : 'bg-white hover:bg-gray-50'} disabled:cursor-default`}>
              {m === 'manual' ? t('म्यानुअल', 'Manual') : t('स्वचालित', 'Auto')}
            </button>
          ))}
        </div>
      </div>
      {a.control_mode === 'auto' && <p className="mt-2 text-xs text-gray-500">🤖 {t('नियमहरू अनुसार स्वतः चल्छ। म्यानुअल आदेश दिँदा स्वचालनले त्यसलाई रोक्दैन।', 'Runs by automation rules. A manual command is never overridden by automation.')}</p>}

      {canControl && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={dur} onChange={(e) => setDur(Number(e.target.value))} className="border rounded p-1.5 text-sm bg-white" disabled={busy}>
            {options.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
          <button disabled={busy || offline || unmapped || a.status !== 'active'} onClick={() => send('on')} className="bg-agri-green hover:bg-green-800 text-white px-4 py-1.5 rounded text-sm font-semibold disabled:opacity-50">ON</button>
          <button disabled={busy || offline || unmapped || a.status !== 'active'} onClick={() => send('off')} className="bg-gov-red hover:bg-red-700 text-white px-4 py-1.5 rounded text-sm font-semibold disabled:opacity-50">OFF</button>
        </div>
      )}
      {unmapped && <p className="mt-2 text-xs text-amber-700">{t('यो एक्चुएटर प्रकारका लागि बोर्डमा रिले च्यानल म्याप गरिएको छैन।', 'No board relay channel is mapped for this actuator type.')}</p>}
      {offline && <p className="mt-2 text-xs text-red-600">{t('यन्त्र अफलाइन छ — आदेश पठाउन मिल्दैन', 'Device offline — commands disabled')}</p>}
      {msg && <p className={`mt-2 text-sm rounded p-2 ${color[msg.kind]}`}>{msg.text}</p>}
      {a.last_state_at && <p className="mt-2 text-xs text-gray-400">{t('अन्तिम परिवर्तन', 'Last change')}: {new Date(a.last_state_at).toLocaleString()}</p>}
    </div>
  );
}

export default function ControlPanel({ actuators, devices, canControl, canConfigure, onDone, lang, t }) {
  const offline = devices.length === 0 || devices.every((d) => d.live_status !== 'online');
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded p-3 text-sm">
        🛡️ {t('सुरक्षा: हरेक एक्चुएटरको अधिकतम चल्ने समय सर्भरले लागू गर्छ। सेन्सर वा यन्त्र अफलाइन भए स्वचालन बन्द हुन्छ।', 'Safety: the server enforces each actuator’s maximum runtime. Automation switches off if a sensor goes stale or the device goes offline.')}
      </div>
      {actuators.length === 0 && <p className="text-gray-500">{t('कुनै एक्चुएटर दर्ता छैन', 'No actuators registered')}</p>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {actuators.map((a) => (
          <ActuatorCard key={a.id} a={a} offline={offline} canControl={canControl} canConfigure={canConfigure} onDone={onDone} lang={lang} t={t} />
        ))}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../../services/api';
import { ageText, hhmm } from '../../utils/console';
import { WifiPanel, CalibPanel, CmdChip } from './DevicePanels';
import FirmwarePanel from './FirmwarePanel';

const bars = (r) => (r === null || r === undefined ? null : r >= -60 ? 4 : r >= -70 ? 3 : r >= -80 ? 2 : 1);
const up = (s) => (s === null || s === undefined ? '—' : s >= 86400 ? `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h` : s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} m` : `${Math.floor(s / 60)} min`);
const BAD = ['panic', 'task_wdt', 'int_wdt', 'wdt', 'brownout'];

function Signal({ rssi }) {
  const n = bars(rssi);
  return <span className="inline-flex items-end gap-0.5 mr-2 align-middle">{[1, 2, 3, 4].map((i) => <span key={i} style={{ height: 4 + i * 4 }} className={`w-1.5 rounded-sm ${n !== null && i <= n ? (n <= 1 ? 'bg-red-500' : n === 2 ? 'bg-yellow-500' : 'bg-green-600') : 'bg-gray-300'}`} />)}</span>;
}

function sensorFlags(sensors) {
  if (!sensors || typeof sensors !== 'object') return [];
  return Object.entries(sensors).map(([k, v]) => {
    if (typeof v === 'boolean') return { name: k.replace(/_ok$/, ''), ok: v };
    if (v && typeof v === 'object' && typeof v.ok === 'boolean') return { name: k, ok: v.ok };
    return null;
  }).filter(Boolean);
}

export default function DeviceTab({ id, ov, lang, t, can }) {
  const [ops, setOps] = useState(undefined);
  const [health, setHealth] = useState(null);
  const [cmds, setCmds] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    api.get('/ops/admin/devices').then((r) => setOps(r.data.find((d) => String(d.growing_unit_id) === String(id)) || null)).catch((e) => { setOps(null); setErr(e.response?.data?.message || 'Failed'); });
  }, [id]);
  const loadHealth = useCallback(() => (ops ? api.get(`/ops/admin/devices/${ops.ops_id}/health`, { params: { hours: 24 } }).then((r) => setHealth(r.data)).catch(() => {}) : null), [ops]);
  const loadCmds = useCallback(() => (ops ? api.get(`/ops/admin/devices/${ops.ops_id}/commands`).then((r) => setCmds(r.data)).catch(() => {}) : null), [ops]);
  useEffect(() => {
    if (!ops) return undefined;
    loadHealth(); loadCmds();
    const a = setInterval(loadHealth, 30000);
    const b = setInterval(loadCmds, 6000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [ops, loadHealth, loadCmds]);

  const send = async (type, payload = {}) => { const r = await api.post(`/ops/admin/devices/${ops.ops_id}/commands`, { type, ...payload }); loadCmds(); return r.data; };
  const cancel = async (c) => { try { await api.delete(`/ops/admin/commands/${c.id}`); loadCmds(); } catch (e) { setErr(e.response?.data?.message || 'Failed'); } };

  if (ops === undefined) return <p className="text-gray-500">…</p>;
  if (ops === null) {
    return (
      <div className="bg-white rounded-xl shadow p-5 space-y-2">
        <h3 className="font-display font-bold text-terrace-900">{t('यो ग्रीनहाउसको नियन्त्रक अझै जोडिएको छैन', 'This greenhouse’s controller is not linked yet')}</h3>
        <p className="text-sm text-gray-700">{t('यन्त्रको स्वास्थ्य, Wi-Fi, क्यालिब्रेसन र फर्मवेयर व्यवस्थापन गर्न “ops” परिचय प्लेटफर्म यन्त्रसँग जोड्नुपर्छ। सर्भरमा यो आदेश चलाउनुहोस्:', 'To manage health, Wi-Fi, calibration and firmware, the controller’s ops id must be linked to the platform device. On the server run:')}</p>
        <pre className="bg-gray-100 rounded p-3 text-xs overflow-x-auto">node database/ops-link.js greenhouse-kaski-01 GH-KASKI-01 --env-file /etc/digital-agriculture/production.env --key &lt;TOKEN_VARIABLE_NAME&gt;</pre>
        {err && <p className="text-sm text-red-700">{err}</p>}
      </div>
    );
  }

  const h = health && health.latest;
  const online = h && h.age_s !== null && h.age_s < 180;
  const flags = sensorFlags(h && h.sensors);
  const relays = h && h.relays && typeof h.relays === 'object' ? Object.entries(h.relays) : [];
  const series = health ? health.series.map((s) => ({ ts: s.ts, rssi: s.rssi, heap: s.heap_free === null ? null : Math.round(s.heap_free / 1024) })) : [];
  const canEdit = can('devices.update');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display font-bold text-xl text-terrace-900">🔧 {ops.ops_id}</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{online ? t('अनलाइन', 'Online') : t('अफलाइन', 'Offline')}</span>
          <span className="text-sm text-gray-600">{t('अन्तिम स्वास्थ्य रिपोर्ट', 'Last health report')}: {h ? ageText(h.age_s, t) : '—'}</span>
          {canEdit && <div className="ml-auto flex gap-2"><button onClick={() => send('read_now').catch(() => {})} className="px-3 py-1.5 border rounded-md text-sm">{t('अहिले पढ्नुहोस्', 'Read now')}</button><button onClick={() => { if (window.confirm(t('यन्त्र पुनः सुरु गर्ने? पम्प रोकिनेछन्।', 'Restart the device? Pumps will stop.'))) send('reboot').catch(() => {}); }} className="px-3 py-1.5 border border-gov-red text-gov-red rounded-md text-sm">{t('पुनः सुरु', 'Restart')}</button></div>}
        </div>
        {!h ? <p className="mt-3 text-sm text-gray-500">{t('अहिलेसम्म कुनै स्वास्थ्य रिपोर्ट आएको छैन।', 'No health report has arrived yet.')}</p> : (
          <dl className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-gray-500">{t('Wi-Fi सङ्केत', 'Wi-Fi signal')}</dt><dd className={`font-semibold ${h.rssi !== null && h.rssi < -85 ? 'text-gov-red' : ''}`}><Signal rssi={h.rssi} />{h.rssi ?? '—'} dBm · {h.ssid || '—'}</dd></div>
            <div><dt className="text-gray-500">{t('खाली मेमोरी', 'Free memory')}</dt><dd className="font-semibold">{h.heap_free === null ? '—' : `${Math.round(h.heap_free / 1024)} kB`} <span className="text-xs text-gray-500">({t('न्यूनतम', 'min')} {h.heap_min === null ? '—' : Math.round(h.heap_min / 1024)} kB)</span></dd></div>
            <div><dt className="text-gray-500">{t('चालू अवधि', 'Uptime')}</dt><dd className="font-semibold">{up(h.uptime_s)}</dd></div>
            <div><dt className="text-gray-500">{t('फर्मवेयर', 'Firmware')}</dt><dd className="font-semibold">{h.firmware || '—'}</dd></div>
            <div><dt className="text-gray-500">{t('पछिल्लो रिस्टार्टको कारण', 'Last restart reason')}</dt><dd className={`font-semibold ${BAD.includes(h.reset_reason) ? 'text-gov-red' : ''}`}>{h.reset_reason || '—'}</dd></div>
            <div><dt className="text-gray-500">{t('Wi-Fi पुनर्जडान / सर्भर असफलता', 'Wi-Fi reconnects / server failures')}</dt><dd className="font-semibold">{h.wifi_reconnects ?? '—'} / {h.http_fails ?? '—'}</dd></div>
            <div><dt className="text-gray-500">{t('पम्प कुल चलेको', 'Pump run totals')}</dt><dd className="font-semibold">{t('सिँचाइ', 'irrigation')} {h.pump_total_s_irrigation === null ? '—' : Math.round(h.pump_total_s_irrigation / 60)} min · {t('मिस्टिङ', 'misting')} {h.pump_total_s_misting === null ? '—' : Math.round(h.pump_total_s_misting / 60)} min</dd></div>
            <div><dt className="text-gray-500">{t('पछिल्लो त्रुटि', 'Last error')}</dt><dd className="font-semibold break-words">{h.last_error || '—'}</dd></div>
          </dl>
        )}
        {h && (flags.length > 0 || relays.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {flags.map((f) => <span key={f.name} className={`px-2 py-1 rounded ${f.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800 font-semibold'}`}>{f.ok ? '✓' : '✗'} {f.name}</span>)}
            {relays.map(([k, v]) => <span key={k} className={`px-2 py-1 rounded ${v ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>{k}: {v ? 'ON' : 'off'}</span>)}
          </div>
        )}
      </div>

      {series.length > 1 && (
        <div className="grid lg:grid-cols-2 gap-5">
          {[['rssi', t('Wi-Fi सङ्केत (dBm), २४ घण्टा', 'Wi-Fi signal (dBm), 24 h'), '#2563eb'], ['heap', t('खाली मेमोरी (kB), २४ घण्टा', 'Free memory (kB), 24 h'), '#7c3aed']].map(([k, title, color]) => (
            <div key={k} className="bg-white rounded-xl shadow p-4">
              <p className="text-sm font-semibold text-terrace-900 mb-1">{title}</p>
              <div style={{ width: '100%', height: 150 }}>
                <ResponsiveContainer><LineChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" dataKey="ts" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={hhmm} tick={{ fontSize: 10 }} /><YAxis width={40} tick={{ fontSize: 11 }} domain={['auto', 'auto']} /><Tooltip labelFormatter={(v) => new Date(v * 1000).toLocaleString()} /><Line type="monotone" dataKey={k} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      )}
      {health && health.resets.length > 0 && <p className="text-sm bg-yellow-50 border border-yellow-200 rounded p-3 text-yellow-900">⚠ {t('गत २४ घण्टामा', 'Restarts in the last 24 h')}: {health.resets.map((r) => `${hhmm(r.ts)}${r.reason ? ` (${r.reason})` : ''}`).join(', ')}</p>}

      <div className="grid xl:grid-cols-2 gap-5">
        <WifiPanel health={health} send={send} canEdit={canEdit} cmds={cmds} lang={lang} t={t} />
        <FirmwarePanel health={health} send={send} canUpload={can('settings.update')} cmds={cmds} lang={lang} t={t} />
      </div>
      <CalibPanel health={health} ov={ov} send={send} canEdit={canEdit} cmds={cmds} lang={lang} t={t} />

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <h4 className="font-display font-bold text-terrace-900 p-4 pb-2">{t('यन्त्र आदेश इतिहास', 'Device command history')}</h4>
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left"><tr><th className="p-3">{t('समय', 'Time')}</th><th className="p-3">{t('आदेश', 'Command')}</th><th className="p-3">{t('विवरण', 'Details')}</th><th className="p-3">{t('कसले', 'By')}</th><th className="p-3">{t('अवस्था', 'Status')}</th><th className="p-3" /></tr></thead>
          <tbody>
            {cmds.length === 0 && <tr><td colSpan="6" className="p-4 text-center text-gray-500">—</td></tr>}
            {cmds.map((c) => (
              <tr key={c.id} className="border-t"><td className="p-3 whitespace-nowrap">{new Date(c.created_at).toLocaleString()}</td><td className="p-3 font-medium">{c.type}</td>
                <td className="p-3 text-xs">{c.summary && Object.keys(c.summary).length ? Object.entries(c.summary).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ') : '—'}</td>
                <td className="p-3">{c.by || '—'}</td><td className="p-3"><CmdChip c={c} lang={lang} /></td>
                <td className="p-3">{c.status === 'queued' && canEdit && <button onClick={() => cancel(c)} className="text-gov-red text-xs underline">{t('रद्द', 'Cancel')}</button>}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

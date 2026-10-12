import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceArea } from 'recharts';
import api from '../../services/api';
import { meta, fv, ageText, dur, hhmm, CMD, friendly } from '../../utils/console';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RANGES = [[1, '1h'], [6, '6h'], [24, '24h'], [72, '3d'], [168, '7d']];

function Tile({ tile, lang, t }) {
  const m = meta(tile.type);
  return (
    <div className={`bg-white rounded-xl shadow p-4 ${tile.stale ? 'opacity-70' : ''}`}>
      <p className="text-sm text-gray-600">{m.icon} {m[lang]}</p>
      <p className="mt-1 text-3xl font-display font-bold" style={{ color: m.color }}>{fv(tile.value, m.d)}<span className="text-base font-medium text-gray-500 ml-1">{tile.unit || m.unit}</span></p>
      <div style={{ width: '100%', height: 38 }}>
        <ResponsiveContainer><LineChart data={tile.spark}><Line type="monotone" dataKey="v" stroke={m.color} strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>
      </div>
      <p className={`text-xs ${tile.stale ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>{tile.stale ? '⚠ ' : ''}{ageText(tile.age_s, t)}</p>
    </div>
  );
}

function PumpCard({ a, minOff, fetchedAt, offline, canControl, canConfigure, onChanged, lang, t }) {
  const presets = [30, 60, 120, 300, 600, 900].filter((s) => s <= a.max_runtime_seconds);
  if (!presets.includes(a.max_runtime_seconds) && a.max_runtime_seconds < 3600) presets.push(a.max_runtime_seconds);
  const [sel, setSel] = useState(presets.includes(60) ? 60 : presets[0]);
  const [phase, setPhase] = useState(null);
  const [msg, setMsg] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(iv); }, []);
  const lapsed = Math.floor((Date.now() - fetchedAt) / 1000);
  const cool = Math.max(0, a.cooldown_left_s - lapsed);
  const left = a.ends_in_s === null ? null : Math.max(0, a.ends_in_s - lapsed);
  const on = a.state === 'on';
  const busy = !!phase && !['acknowledged', 'failed', 'expired', 'cancelled'].includes(phase);
  const icon = a.type === 'misting' ? '🌫️' : a.type === 'irrigation' ? '💦' : '⚙️';

  const send = async (command) => {
    setMsg(null); setPhase('pending');
    try {
      const r = await api.post(`/smart/actuators/${a.id}/command`, command === 'on' ? { command, duration_seconds: sel } : { command });
      for (let i = 0; i < 40; i++) {
        await sleep(1500);
        const s = await api.get(`/smart/commands/${r.data.id}`);
        setPhase(s.data.status);
        if (s.data.status === 'acknowledged') { setMsg({ ok: true, text: command === 'on' ? t('पम्प चल्यो', 'The pump is running') : t('पम्प रोकियो', 'The pump stopped') }); break; }
        if (['failed', 'expired', 'cancelled'].includes(s.data.status)) { setMsg({ ok: false, text: friendly(s.data.error_message, t) || t('आदेश पूरा भएन', 'The command did not complete') }); break; }
        if (i % 3 === 0) onChanged();
      }
    } catch (e) { setPhase(null); setMsg({ ok: false, text: e.response?.data?.message || 'Request failed' }); }
    onChanged();
  };
  const setMode = async (mode) => { try { await api.put(`/smart/actuators/${a.id}/mode`, { control_mode: mode }); onChanged(); } catch (e) { setMsg({ ok: false, text: e.response?.data?.message || 'Request failed' }); } };
  const steps = [['pending', t('पठाइयो', 'Sent')], ['sent', t('यन्त्रले पायो', 'Controller got it')], ['acknowledged', t('सम्पन्न', 'Done')]];
  const idx = phase ? steps.findIndex((s) => s[0] === phase) : -1;

  return (
    <div className={`bg-white rounded-xl shadow p-4 border-l-4 ${on ? 'border-green-500' : 'border-gray-300'}`}>
      <div className="flex items-start justify-between gap-2">
        <div><p className="font-display font-bold text-terrace-900">{icon} {a.name}</p><p className="text-xs text-gray-500">{t('अधिकतम', 'Max')} {dur(a.max_runtime_seconds)} · {t('न्यूनतम आराम', 'rest')} {minOff} s</p></div>
        <span className={`px-3 py-1 rounded-full text-sm font-bold ${on ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{on ? 'ON' : 'OFF'}</span>
      </div>
      {on && left !== null && a.total_s > 0 && (
        <div className="mt-3"><div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-green-500 transition-all" style={{ width: `${Math.min(100, (100 * (a.total_s - left)) / a.total_s)}%` }} /></div><p className="text-xs text-gray-600 mt-1">{t('बाँकी', 'Remaining')} {dur(left)}</p></div>
      )}
      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="text-gray-600">{t('मोड', 'Mode')}</span>
        <div className="inline-flex rounded-md overflow-hidden border">
          {['manual', 'auto'].map((m) => <button key={m} disabled={!canConfigure || a.mode === m} onClick={() => setMode(m)} className={`px-3 py-1 ${a.mode === m ? 'bg-gov-blue text-white' : 'bg-white hover:bg-gray-50'} disabled:cursor-default`}>{m === 'manual' ? t('म्यानुअल', 'Manual') : t('स्वचालित', 'Auto')}</button>)}
        </div>
      </div>
      {a.mode === 'auto' && <p className="mt-2 text-xs text-gray-600">🤖 {t('स्वचालित नियमअनुसार चल्छ; आवश्यक परे तपाईं हातैले पनि चलाउन सक्नुहुन्छ।', 'Runs by automation rules; you can still start it by hand when needed.')}</p>}
      {canControl && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((s) => <button key={s} disabled={busy} onClick={() => setSel(s)} className={`px-2.5 py-1 rounded border text-sm ${sel === s ? 'bg-terrace-800 text-white border-terrace-800' : 'bg-white'}`}>{dur(s)}</button>)}
          </div>
          <div className="flex gap-2">
            <button disabled={busy || offline || on || cool > 0 || a.status !== 'active'} onClick={() => send('on')} className="flex-1 bg-agri-green hover:bg-green-800 text-white py-2.5 rounded-md font-semibold disabled:opacity-50">{cool > 0 ? `${t('आराम', 'Rest')} ${cool}s` : `${t('चलाउनुहोस्', 'Start')} ${dur(sel)}`}</button>
            <button disabled={busy || offline || !on} onClick={() => send('off')} className="px-5 bg-gov-red hover:bg-red-700 text-white py-2.5 rounded-md font-semibold disabled:opacity-50">{t('रोक्नुहोस्', 'Stop')}</button>
          </div>
          {offline && <p className="text-xs text-red-600">{t('यन्त्र अफलाइन — नियन्त्रण बन्द', 'Device offline — control disabled')}</p>}
        </div>
      )}
      {phase && idx >= 0 && (
        <ol className="mt-3 flex gap-2 text-xs">{steps.map((s, i) => <li key={s[0]} className={`flex-1 text-center py-1 rounded ${i <= idx ? 'bg-green-100 text-green-800 font-semibold' : 'bg-gray-100 text-gray-500'}`}>{s[1]}</li>)}</ol>
      )}
      {busy && <p className="mt-1 text-xs text-gray-500">{t('नियन्त्रकले करिब १० सेकेन्डमा आदेश लिन्छ।', 'The controller picks up commands about every 10 seconds.')}</p>}
      {msg && <p className={`mt-2 text-sm rounded p-2 ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
    </div>
  );
}

export default function LiveTab({ id, ov, reload, offline, lang, t, can }) {
  const [hours, setHours] = useState(6);
  const [m1, setM1] = useState('soil_moisture');
  const [m2, setM2] = useState('');
  const [data, setData] = useState(null);
  const types = useMemo(() => ov.tiles.map((x) => x.type), [ov.tiles]);
  useEffect(() => { if (types.length && !types.includes(m1)) setM1(types[0]); }, [types]);
  useEffect(() => {
    if (!m1) return undefined;
    let alive = true;
    const load = () => api.get(`/console/units/${id}/series`, { params: { hours, types: [m1, m2].filter(Boolean).join(',') } }).then((r) => alive && setData(r.data)).catch(() => {});
    setData(null); load();
    const iv = setInterval(load, 45000);
    return () => { alive = false; clearInterval(iv); };
  }, [id, hours, m1, m2]);

  const rows = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    Object.entries(data.series).forEach(([k, pts]) => pts.forEach((p) => { const r = map.get(p.ts) || { ts: p.ts }; r[k] = Number(p.v.toFixed(2)); map.set(p.ts, r); }));
    return [...map.values()].sort((a, b) => a.ts - b.ts);
  }, [data]);
  const tick = (v) => (hours <= 24 ? hhmm(v) : new Date(v * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' }));
  const sel = (v, set, blank) => (
    <select value={v} onChange={(e) => set(e.target.value)} className="border rounded-md p-1.5 bg-white text-sm">{blank && <option value="">—</option>}{types.map((x) => <option key={x} value={x}>{meta(x)[lang]}</option>)}</select>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{ov.tiles.map((x) => <Tile key={x.type} tile={x} lang={lang} t={t} />)}</div>

      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h3 className="font-display font-bold text-terrace-900">{t('इतिहास', 'History')}</h3>
          <div className="flex gap-1">{RANGES.map(([h, l]) => <button key={h} onClick={() => setHours(h)} className={`px-3 py-1 rounded border text-sm ${hours === h ? 'bg-agri-green text-white border-agri-green' : 'bg-white'}`}>{l}</button>)}</div>
          <div className="ml-auto flex items-center gap-2 text-sm">{sel(m1, setM1, false)}<span className="text-gray-400">+</span>{sel(m2, setM2, true)}</div>
        </div>
        {!data && <p className="text-gray-500 text-sm py-12 text-center">…</p>}
        {data && rows.length === 0 && <p className="text-gray-500 text-sm py-12 text-center">{t('यस अवधिमा तथ्याङ्क छैन', 'No data in this period')}</p>}
        {rows.length > 0 && (
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="ts" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={tick} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="l" width={46} tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                {m2 && <YAxis yAxisId="r" orientation="right" width={46} tick={{ fontSize: 12 }} domain={['auto', 'auto']} />}
                <Tooltip labelFormatter={(v) => new Date(v * 1000).toLocaleString()} />
                {data.events.map((e, i) => <ReferenceArea key={i} yAxisId="l" x1={e.s} x2={Math.max(e.e, e.s + data.bucket)} fill={e.type === 'misting' ? '#60a5fa' : '#22c55e'} fillOpacity={0.18} ifOverflow="hidden" />)}
                <Line yAxisId="l" type="monotone" dataKey={m1} name={meta(m1)[lang]} stroke={meta(m1).color} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls />
                {m2 && <Line yAxisId="r" type="monotone" dataKey={m2} name={meta(m2)[lang]} stroke={meta(m2).color} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500"><span className="inline-block w-3 h-3 bg-green-500/30 align-middle mr-1" />{t('सिँचाइ चलेको समय', 'irrigation running')} <span className="inline-block w-3 h-3 bg-blue-400/30 align-middle mx-1 ml-3" />{t('मिस्टिङ', 'misting')}</p>
      </div>

      <div>
        <h3 className="font-display font-bold text-terrace-900 mb-3">{t('पम्प नियन्त्रण', 'Pump control')}</h3>
        {ov.actuators.length === 0 && <p className="text-gray-500 text-sm">{t('कुनै एक्चुएटर दर्ता छैन', 'No actuators registered')}</p>}
        <div className="grid md:grid-cols-2 gap-5">
          {ov.actuators.map((a) => <PumpCard key={a.id} a={a} minOff={ov.min_off_s} fetchedAt={ov._at} offline={offline} canControl={can('irrigation_control.control')} canConfigure={can('irrigation_control.configure')} onChanged={reload} lang={lang} t={t} />)}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <h3 className="font-display font-bold text-terrace-900 p-4 pb-2">{t('हालैका आदेश', 'Recent commands')}</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left"><tr><th className="p-3">{t('समय', 'Time')}</th><th className="p-3">{t('पम्प', 'Pump')}</th><th className="p-3">{t('आदेश', 'Command')}</th><th className="p-3">{t('कसले', 'By')}</th><th className="p-3">{t('नतिजा', 'Result')}</th></tr></thead>
          <tbody>
            {ov.commands.length === 0 && <tr><td colSpan="5" className="p-4 text-center text-gray-500">—</td></tr>}
            {ov.commands.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 whitespace-nowrap">{new Date(c.requested_at).toLocaleString()}</td><td className="p-3">{c.actuator}</td>
                <td className="p-3">{c.command.toUpperCase()}{c.command === 'on' && c.duration_seconds ? ` · ${dur(c.duration_seconds)}` : ''}</td>
                <td className="p-3">{c.source === 'auto' ? `🤖 ${t('स्वचालन', 'automation')}` : c.username || '—'}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${(CMD[c.status] || CMD.pending).cls}`}>{(CMD[c.status] || CMD.pending)[lang]}</span>{c.error_message && <span className="ml-2 text-xs text-red-700">{friendly(c.error_message, t)}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

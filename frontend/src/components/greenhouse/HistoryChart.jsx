import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from 'recharts';
import api from '../../services/api';
import { fmt } from '../../utils/greenhouse';

const RANGES = [[6, '6h'], [24, '24h'], [72, '3d'], [168, '7d'], [720, '30d']];

export default function HistoryChart({ sensors, parameters, t, live = false }) {
  const [sensorId, setSensorId] = useState(sensors.length ? sensors[0].id : null);
  const [hours, setHours] = useState(24);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!sensorId) return undefined;
    let alive = true;
    const refresh = () => api.get('/smart/sensors/' + sensorId + '/history', { params: { hours } })
      .then((r) => { if (alive) { setData(r.data); setErr(''); } })
      .catch((e) => alive && setErr(e.response?.data?.message || 'Failed to load history'));
    refresh();
    const timer = live ? window.setInterval(refresh, 30000) : null;
    return () => { alive = false; if (timer) window.clearInterval(timer); };
  }, [sensorId, hours, live]);

  if (!sensors.length) return <p className="text-gray-500">{t('कुनै सेन्सर छैन', 'No sensors')}</p>;
  const sensor = sensors.find((s) => s.id === Number(sensorId)) || sensors[0];
  const tg = (parameters || []).find((p) => p.key === sensor.sensor_type);
  const target = tg ? tg.target : null;
  const pts = data ? data.points.map((p) => ({ ts: new Date(p.t).getTime(), avg: Number(p.avg), min: Number(p.min), max: Number(p.max) })) : [];
  const vals = pts.map((p) => p.avg);
  const stats = vals.length ? { min: Math.min(...pts.map((p) => p.min)), max: Math.max(...pts.map((p) => p.max)), avg: vals.reduce((a, b) => a + b, 0) / vals.length } : null;
  const tick = (v) => (hours <= 48 ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' }));

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <select value={sensor.id} onChange={(e) => { setData(null); setErr(''); setSensorId(Number(e.target.value)); }} className="border rounded p-2 bg-white text-sm">
          {sensors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex gap-1">
          {RANGES.map(([h, label]) => (
            <button key={h} onClick={() => { setData(null); setErr(''); setHours(h); }} className={`px-3 py-1.5 rounded text-sm border ${hours === h ? 'bg-agri-green text-white border-agri-green' : 'bg-white'}`}>{label}</button>
          ))}
        </div>
        {stats && (
          <div className="ml-auto flex gap-4 text-sm text-gray-600">
            <span>{t('न्यूनतम', 'Min')}: <b>{fmt(stats.min, 2)}</b></span>
            <span>{t('औसत', 'Avg')}: <b>{fmt(stats.avg, 2)}</b></span>
            <span>{t('अधिकतम', 'Max')}: <b>{fmt(stats.max, 2)}</b></span>
            <span className="text-gray-400">{sensor.unit}</span>
          </div>
        )}
      </div>
      {err && <p className="p-3 bg-red-50 text-red-700 rounded text-sm">{err}</p>}
      {!err && !data && <p className="text-gray-500 text-sm py-10 text-center">…</p>}
      {data && pts.length === 0 && <p className="text-gray-500 text-sm py-10 text-center">{t('यस अवधिमा डाटा छैन', 'No data in this period')}</p>}
      {pts.length > 0 && (
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={pts} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={tick} tick={{ fontSize: 12 }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} width={48} />
              <Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} formatter={(v, n) => [fmt(v, 2) + ' ' + (sensor.unit || ''), n]} />
              {target && <ReferenceArea y1={target.opt_min} y2={target.opt_max} fill="#86efac" fillOpacity={0.25} />}
              <Line type="monotone" dataKey="max" name="Max" stroke="#fca5a5" strokeWidth={1} dot={false} />
              <Line type="monotone" dataKey="min" name="Min" stroke="#93c5fd" strokeWidth={1} dot={false} />
              <Line type="monotone" dataKey="avg" name="Avg" stroke="#15803d" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {target && <p className="mt-2 text-xs text-gray-500">🟩 {t('हरियो क्षेत्र = उपयुक्त दायरा', 'Green band = optimum range')} ({target.opt_min}–{target.opt_max})</p>}
    </div>
  );
}

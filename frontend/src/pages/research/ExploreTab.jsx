import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import api from '../../services/api';
import { f, mname } from '../../components/research/formatters';

const KEY_MEANS = ['temp_avg', 'rh_avg', 'vpd_avg', 'dli', 'gdd', 'soil_moisture_avg', 'ec_avg', 'irrigation_min', 'tir_temp', 'data_coverage'];
const TYPES = ['temperature', 'humidity', 'soil_moisture', 'soil_temperature', 'ec', 'light', 'water_level'];

export default function ExploreTab({ units, metrics, mm, range, lang, t }) {
  const [unitId, setUnitId] = useState('');
  const [m1, setM1] = useState('temp_avg');
  const [m2, setM2] = useState('');
  const [daily, setDaily] = useState(null);
  const [sum, setSum] = useState(null);
  const [type, setType] = useState('temperature');
  const [hourly, setHourly] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { if (!unitId && units.length) setUnitId(String(units[0].id)); }, [units]);
  useEffect(() => {
    if (!unitId) return;
    setDaily(null); setSum(null); setErr('');
    api.get(`/research/units/${unitId}/daily`, { params: range }).then((r) => setDaily(r.data)).catch((e) => setErr(e.response?.data?.message || 'Failed'));
    api.get(`/research/units/${unitId}/summary`, { params: range }).then((r) => setSum(r.data)).catch(() => {});
  }, [unitId, range.from, range.to]);
  useEffect(() => {
    if (!unitId) return;
    const to = new Date(`${range.to}T00:00:00`);
    const from = new Date(Math.max(new Date(`${range.from}T00:00:00`).getTime(), to.getTime() - 6 * 86400000));
    setHourly(null);
    api.get(`/research/units/${unitId}/hourly`, { params: { type, from: from.toLocaleDateString('en-CA'), to: range.to } }).then((r) => setHourly(r.data.rows)).catch(() => setHourly([]));
  }, [unitId, type, range.to, range.from]);

  const sel = (v, set, blank) => (
    <select value={v} onChange={(e) => set(e.target.value)} className="border rounded p-2 bg-white text-sm">
      {blank && <option value="">—</option>}
      {metrics.map((m) => <option key={m.key} value={m.key}>{lang === 'en' ? m.en : m.ne} ({m.unit})</option>)}
    </select>
  );

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-3 text-sm">
        <label>{t('ग्रीनहाउस', 'Greenhouse')}
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="block mt-1 border rounded p-2 bg-white">
            {units.map((u) => <option key={u.id} value={u.id}>{lang === 'en' ? u.name_en : (u.name_ne || u.name_en)}{u.is_simulated ? ' [SIM]' : ''}</option>)}
          </select></label>
        <label>{t('मापक १', 'Metric 1')}<span className="block mt-1">{sel(m1, setM1, false)}</span></label>
        <label>{t('मापक २ (ऐच्छिक)', 'Metric 2 (optional)')}<span className="block mt-1">{sel(m2, setM2, true)}</span></label>
      </div>
      {err && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{err}</div>}

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gov-blue mb-2">{t('दैनिक प्रवृत्ति', 'Daily trend')}</h3>
        {!daily && <p className="text-gray-500 text-sm py-10 text-center">…</p>}
        {daily && daily.rows.length === 0 && <p className="text-gray-500 text-sm py-10 text-center">{t('यो अवधिमा दैनिक तथ्याङ्क छैन। रोलअप चल्न केही समय लाग्छ।', 'No daily data in this period. Rollups take a few minutes to appear.')}</p>}
        {daily && daily.rows.length > 0 && (
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={daily.rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="l" tick={{ fontSize: 12 }} width={48} />{m2 && <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 12 }} width={48} />}
                <Tooltip /><Legend />
                <Line yAxisId="l" type="monotone" dataKey={m1} name={mname(mm, m1, lang)} stroke="#15803d" strokeWidth={2.5} dot={false} connectNulls />
                {m2 && <Line yAxisId="r" type="monotone" dataKey={m2} name={mname(mm, m2, lang)} stroke="#2563eb" strokeWidth={2.5} dot={false} connectNulls />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {sum && (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gov-blue mb-2">{t('अवधिको औसत', 'Period averages')} ({sum.days} {t('दिन', 'days')})</h3>
            <dl className="grid sm:grid-cols-2 gap-x-6 text-sm">
              {KEY_MEANS.map((k) => <div key={k} className="flex justify-between border-b py-1.5"><dt className="text-gray-600">{mname(mm, k, lang)}</dt><dd className="font-semibold">{f(sum.means[k])} <span className="text-xs text-gray-500">{mm[k] ? mm[k].unit : ''}</span></dd></div>)}
            </dl>
            <p className="mt-2 text-xs text-gray-500">{t('कुल सिँचाइ', 'Total irrigation')}: {f(sum.totals.irrigation_min, 0)} min · GDD: {f(sum.totals.gdd, 0)} · DLI: {f(sum.totals.dli, 0)} mol/m²</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
            <h3 className="font-semibold text-gov-blue mb-2">{t('सेन्सर गुणस्तर', 'Sensor quality')}</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-left"><th className="p-1.5">{t('सेन्सर', 'Sensor')}</th><th className="p-1.5">{t('कभरेज', 'Coverage')}</th><th className="p-1.5">{t('अड्किएको', 'Stuck')}</th></tr></thead>
              <tbody>
                {sum.sensors.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-1.5">{s.name}</td>
                    <td className={`p-1.5 ${s.coverage !== null && s.coverage < 80 ? 'text-gov-red font-semibold' : ''}`}>{s.coverage === null ? '—' : `${s.coverage}%`}</td>
                    <td className="p-1.5">{s.stuck_days > 0 ? `⚠ ${s.stuck_days}d` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h3 className="font-semibold text-gov-blue">{t('घण्टागत मान (अन्तिम ७ दिन)', 'Hourly values (last 7 days)')}</h3>
          <select value={type} onChange={(e) => setType(e.target.value)} className="border rounded p-1.5 bg-white text-sm">{TYPES.map((x) => <option key={x}>{x}</option>)}</select>
        </div>
        {hourly && hourly.length === 0 && <p className="text-gray-500 text-sm py-8 text-center">{t('तथ्याङ्क छैन', 'No data')}</p>}
        {hourly && hourly.length > 0 && (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={hourly}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="hour_local" tick={{ fontSize: 10 }} minTickGap={40} /><YAxis width={48} tick={{ fontSize: 12 }} /><Tooltip />
                <Line type="monotone" dataKey="v_max" stroke="#fca5a5" strokeWidth={1} dot={false} name="max" /><Line type="monotone" dataKey="v_min" stroke="#93c5fd" strokeWidth={1} dot={false} name="min" />
                <Line type="monotone" dataKey="v_avg" stroke="#15803d" strokeWidth={2} dot={false} name="mean" /></LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

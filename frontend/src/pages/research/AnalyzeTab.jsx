import { useEffect, useState } from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../../services/api';
import UnitPicker from '../../components/research/UnitPicker';
import { Caveats, f, fmtP, mname } from '../../components/research/helpers';

export default function AnalyzeTab({ units, metrics, mm, range, lang, t }) {
  const [sel, setSel] = useState([]);
  const [x, setX] = useState('vpd_avg');
  const [y, setY] = useState('soil_moisture_avg');
  const [method, setMethod] = useState('pearson');
  const [cor, setCor] = useState(null);
  const [metric, setMetric] = useState('soil_moisture_avg');
  const [cmp, setCmp] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!sel.length && units.length) setSel(units.slice(0, 2).map((u) => u.id)); }, [units]);

  const run = async (kind) => {
    setErr(''); setBusy(true);
    try {
      if (kind === 'cor') { const r = await api.get('/research/correlation', { params: { unit_ids: sel.join(','), x, y, method, ...range } }); setCor(r.data); }
      else { const r = await api.get('/research/compare', { params: { unit_ids: sel.join(','), metric, ...range } }); setCmp(r.data); }
    } catch (e) { setErr(e.response?.data?.message || e.response?.data?.errors?.map((z) => z.message).join(', ') || 'Failed'); } finally { setBusy(false); }
  };

  const msel = (v, set) => (
    <select value={v} onChange={(e) => set(e.target.value)} className="border rounded p-2 bg-white text-sm">{metrics.map((m) => <option key={m.key} value={m.key}>{lang === 'en' ? m.en : m.ne}</option>)}</select>
  );
  const line = cor && cor.stats && cor.points.length > 1 ? (() => { const xs = cor.points.map((p) => p.x); const lo = Math.min(...xs), hi = Math.max(...xs); return [{ x: lo, y: cor.stats.intercept + cor.stats.slope * lo }, { x: hi, y: cor.stats.intercept + cor.stats.slope * hi }]; })() : null;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4 space-y-2">
        <p className="text-sm font-medium">{t('ग्रीनहाउस छान्नुहोस्', 'Choose greenhouses')}</p>
        <UnitPicker units={units} value={sel} onChange={setSel} lang={lang} />
      </div>
      {err && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{err}</div>}

      <section className="bg-white rounded-lg shadow p-4 space-y-3">
        <h3 className="font-semibold text-gov-blue">{t('सहसम्बन्ध', 'Correlation')}</h3>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label>X<span className="block mt-1">{msel(x, setX)}</span></label>
          <label>Y<span className="block mt-1">{msel(y, setY)}</span></label>
          <label>{t('विधि', 'Method')}<select value={method} onChange={(e) => setMethod(e.target.value)} className="block mt-1 border rounded p-2 bg-white"><option value="pearson">Pearson</option><option value="spearman">Spearman (rank)</option></select></label>
          <button disabled={busy || !sel.length} onClick={() => run('cor')} className="bg-agri-green text-white px-4 py-2 rounded font-semibold disabled:opacity-50">{t('गणना गर्नुहोस्', 'Calculate')}</button>
        </div>
        {cor && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-4 gap-3 text-sm">
              {[['n (' + t('दिन', 'days') + ')', cor.n], ['r', f(cor.stats && cor.stats.r, 3)], ['p', fmtP(cor.stats && cor.stats.p)], ['R²', f(cor.stats && cor.stats.r2, 3)]].map(([k, v]) => (
                <div key={k} className="border rounded p-3"><p className="text-gray-500">{k}</p><p className="text-2xl font-bold text-terrace-800">{v}</p></div>
              ))}
            </div>
            {cor.points.length > 0 && (
              <div style={{ width: '100%', height: 340 }}>
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" dataKey="x" name={mname(mm, cor.x, lang)} domain={['auto', 'auto']} label={{ value: mname(mm, cor.x, lang), position: 'bottom', offset: 0, fontSize: 12 }} tick={{ fontSize: 12 }} />
                    <YAxis type="number" dataKey="y" name={mname(mm, cor.y, lang)} domain={['auto', 'auto']} width={55} tick={{ fontSize: 12 }} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter data={cor.points} fill="#15803d" />
                    {line && <Scatter data={line} line={{ stroke: '#dc2626', strokeWidth: 2 }} shape={() => <g />} legendType="none" />}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
            <Caveats list={cor.caveats} t={t} />
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg shadow p-4 space-y-3">
        <h3 className="font-semibold text-gov-blue">{t('ग्रीनहाउसहरूको तुलना', 'Compare greenhouses')}</h3>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label>{t('मापक', 'Metric')}<span className="block mt-1">{msel(metric, setMetric)}</span></label>
          <button disabled={busy || sel.length < 2} onClick={() => run('cmp')} className="bg-agri-green text-white px-4 py-2 rounded font-semibold disabled:opacity-50">{t('तुलना गर्नुहोस्', 'Compare')}</button>
          {sel.length < 2 && <span className="text-xs text-gray-500">{t('कम्तीमा दुई ग्रीनहाउस छान्नुहोस्', 'Select at least two greenhouses')}</span>}
        </div>
        {cmp && (
          <div className="space-y-3">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-gray-100 text-left"><tr><th className="p-2">{t('ग्रीनहाउस', 'Greenhouse')}</th><th className="p-2">n</th><th className="p-2">{t('औसत', 'Mean')}</th><th className="p-2">SD</th></tr></thead>
              <tbody>{cmp.stats.map((s) => <tr key={s.unit_id} className="border-t"><td className="p-2">{s.name}</td><td className="p-2">{s.n}</td><td className="p-2">{f(s.mean)}</td><td className="p-2">{f(s.sd)}</td></tr>)}</tbody>
            </table></div>
            {cmp.test ? (
              <p className="text-sm p-3 bg-terrace-50 rounded">
                {cmp.test.test === 'welch_t'
                  ? `Welch t = ${f(cmp.test.t)}, df = ${f(cmp.test.df, 1)}, p = ${fmtP(cmp.test.p)}; ${t('फरक', 'difference')} = ${f(cmp.test.mean_diff)} (95% CI ${f(cmp.test.ci95[0])} … ${f(cmp.test.ci95[1])}); Cohen d = ${f(cmp.test.cohens_d)}`
                  : `ANOVA F(${cmp.test.df1}, ${cmp.test.df2}) = ${f(cmp.test.F)}, p = ${fmtP(cmp.test.p)}, η² = ${f(cmp.test.eta2, 3)}`}
              </p>
            ) : <p className="text-sm text-gray-500">{t('परीक्षणका लागि पर्याप्त तथ्याङ्क छैन', 'Not enough data for a test')}</p>}
            <Caveats list={cmp.caveats} t={t} />
          </div>
        )}
      </section>
    </div>
  );
}

import { useEffect, useState } from 'react';
import api from '../../services/api';
import { f } from '../../components/research/formatters';

export default function AutomationTab({ units, lang, t }) {
  const [unitId, setUnitId] = useState('');
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  useEffect(() => { if (!unitId && units.length) setUnitId(String(units[0].id)); }, [units]);
  useEffect(() => { if (unitId) { setData(null); api.get(`/research/units/${unitId}/automation`, { params: { days } }).then((r) => setData(r.data)).catch(() => setData({ events: [], summary: null })); } }, [unitId, days]);
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-3 text-sm">
        <label>{t('ग्रीनहाउस', 'Greenhouse')}<select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="block mt-1 border rounded p-2 bg-white">{units.map((u) => <option key={u.id} value={u.id}>{lang === 'en' ? u.name_en : (u.name_ne || u.name_en)}</option>)}</select></label>
        <label>{t('दिन', 'Days')}<select value={days} onChange={(e) => setDays(Number(e.target.value))} className="block mt-1 border rounded p-2 bg-white">{[7, 14, 30, 60].map((d) => <option key={d}>{d}</option>)}</select></label>
      </div>
      {!data && <p className="text-gray-500">…</p>}
      {data && data.summary && (
        <div className="grid sm:grid-cols-4 gap-3">
          {[[t('सिँचाइ पटक', 'Irrigation runs'), data.summary.n, ''], [t('औसत माटो चिस्यान वृद्धि', 'Mean moisture gain'), f(data.summary.mean_delta), '%'], [t('प्रति मिनेट वृद्धि', 'Gain per minute'), f(data.summary.gain_per_minute), '%/min'], [t('औसत अवधि', 'Mean duration'), f(data.summary.mean_seconds / 60, 1), 'min']]
            .map(([k, v, u]) => <div key={k} className="bg-white rounded-lg shadow p-4"><p className="text-sm text-gray-600">{k}</p><p className="text-2xl font-bold text-terrace-800">{v} <span className="text-sm font-normal text-gray-500">{u}</span></p></div>)}
        </div>
      )}
      {data && data.note && <p className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded p-3">{data.note}</p>}
      {data && data.events.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left"><tr><th className="p-3">{t('सुरु', 'Started')}</th><th className="p-3">{t('अवधि', 'Duration')}</th><th className="p-3">{t('स्रोत', 'Trigger')}</th><th className="p-3">{t('अघि %', 'Before %')}</th><th className="p-3">{t('पछि %', 'After %')}</th><th className="p-3">Δ</th></tr></thead>
            <tbody>{data.events.map((e) => <tr key={e.id} className="border-t"><td className="p-3 whitespace-nowrap">{new Date(e.started_at).toLocaleString()}</td><td className="p-3">{Math.round(e.seconds / 60)} min</td><td className="p-3">{e.trigger}</td><td className="p-3">{f(e.before, 1)}</td><td className="p-3">{f(e.after, 1)}</td><td className={`p-3 font-semibold ${e.delta < 0.5 ? 'text-gov-red' : 'text-agri-green'}`}>{e.delta > 0 ? '+' : ''}{f(e.delta, 1)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {data && data.events.length === 0 && !data.note && <p className="text-gray-500 text-sm">{t('यो अवधिमा विश्लेषण योग्य सिँचाइ भेटिएन', 'No analysable irrigation runs in this period')}</p>}
    </div>
  );
}

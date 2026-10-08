import { useEffect, useState } from 'react';
import api from '../../services/api';
import DynamicForm from './DynamicForm';

export default function RecordsPanel({ farmerId, farms, kind, fields, columns, lookups, canEdit, lang, t, onChanged }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);
  const [farmId, setFarmId] = useState(farms[0] ? farms[0].id : '');

  const load = () => api.get(`/farmers/${farmerId}/${kind}`).then((r) => setRows(r.data)).catch((e) => setErr(e.response?.data?.message || 'Failed to load'));
  useEffect(() => { load(); }, [farmerId, kind]);
  useEffect(() => { if (!farmId && farms[0]) setFarmId(farms[0].id); }, [farms]);

  const add = (values) => api.post(`/farmers/farms/${farmId}/${kind}`, values).then((r) => { load(); if (onChanged) onChanged(); return r.data; });
  const remove = async (id) => {
    if (!window.confirm(t('यो अभिलेख मेट्ने?', 'Delete this record?'))) return;
    try { await api.delete(`/farmers/records/${kind}/${id}`); load(); if (onChanged) onChanged(); }
    catch (e) { setErr(e.response?.data?.message || 'Delete failed'); }
  };

  return (
    <div className="space-y-3">
      {err && <p className="p-3 bg-red-50 text-red-700 rounded text-sm">{err}</p>}
      {canEdit && (farms.length === 0
        ? <p className="p-3 bg-yellow-50 text-yellow-900 rounded text-sm">{t('पहिले फार्म थप्नुहोस् (फार्म ट्याबमा)', 'Add a farm first (Farms tab)')}</p>
        : <button onClick={() => setOpen(!open)} className="bg-agri-green text-white px-4 py-2 rounded text-sm font-semibold">+ {t('नयाँ अभिलेख', 'Add record')}</button>)}
      {open && farms.length > 0 && (
        <div className="space-y-2">
          {farms.length > 1 && (
            <label className="text-sm block">{t('फार्म', 'Farm')}:{' '}
              <select value={farmId} onChange={(e) => setFarmId(e.target.value)} className="border rounded p-1.5 bg-white">
                {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
          )}
          <DynamicForm key={farmId} fields={fields} onSubmit={add} lookups={lookups} lang={lang} t={t} resetOnSuccess />
        </div>
      )}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>{columns.map((c, i) => <th key={i} className="p-3 whitespace-nowrap">{lang === 'en' ? c.en : c.ne}</th>)}{canEdit && <th className="p-3" />}</tr>
          </thead>
          <tbody>
            {rows === null && <tr><td colSpan="20" className="p-4 text-center text-gray-500">…</td></tr>}
            {rows && rows.length === 0 && <tr><td colSpan="20" className="p-4 text-center text-gray-500">{t('कुनै अभिलेख छैन', 'No records yet')}</td></tr>}
            {rows && rows.map((row) => (
              <tr key={row.id} className="border-t">
                {columns.map((c, i) => <td key={i} className="p-3 whitespace-nowrap">{c.r(row, lang)}</td>)}
                {canEdit && <td className="p-3"><button onClick={() => remove(row.id)} className="text-gov-red text-xs underline">{t('मेट्नुहोस्', 'Delete')}</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

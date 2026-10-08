import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import api from '../../services/api';

const BAND = [
  ['low', 'कम (<४०)', 'Low (<40)', '#dc2626'], ['fair', 'मध्यम (४०–६९)', 'Fair (40–69)', '#d97706'],
  ['good', 'राम्रो (७०–८९)', 'Good (70–89)', '#65a30d'], ['excellent', 'उत्कृष्ट (९०+)', 'Excellent (90+)', '#15803d']
];
const MISS = [
  ['no_phone', 'फोन नम्बर नभएका कृषक', 'Farmers without phone'], ['no_local_level', 'स्थानीय तह नखुलेका', 'Without local level'],
  ['no_farm', 'फार्म दर्ता नभएका', 'Without a registered farm'], ['no_production', 'उत्पादन विवरण नभएका', 'Without production records'],
  ['no_consent', 'सहमति नलिइएका', 'Without consent'], ['unverified', 'प्रमाणित नभएका', 'Not yet verified'],
  ['pending_verification', 'प्रमाणीकरण पर्खिरहेका', 'Awaiting verification'], ['no_area', 'क्षेत्रफल नभएका फार्म', 'Farms without area'], ['no_gps', 'GPS नभएका फार्म', 'Farms without GPS']
];

export default function QualityTab({ lang, t }) {
  const [q, setQ] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get('/datacenter/quality').then((r) => setQ(r.data)).catch((e) => setErr(e.response?.data?.message || 'Failed to load')); }, []);
  if (err) return <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{err}</div>;
  if (!q) return <p className="text-gray-500">…</p>;
  const chart = BAND.map(([k, ne, en, color]) => ({ name: lang === 'en' ? en : ne, n: (q.distribution.find((d) => d.band === k) || { n: 0 }).n, color }));
  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-gov-blue mb-2">{t('तथ्याङ्क पूर्णताको वितरण (कृषक)', 'Completeness distribution (farmers)')}</h3>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} width={35} /><Tooltip />
                <Bar dataKey="n" radius={[4, 4, 0, 0]}>{chart.map((c, i) => <Cell key={i} fill={c.color} />)}</Bar></BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-gov-blue mb-2">{t('अपुग तथ्याङ्कको सारांश', 'Gaps at a glance')}</h3>
          <ul className="grid sm:grid-cols-2 gap-2 text-sm">
            {MISS.map(([k, ne, en]) => (
              <li key={k} className={`flex justify-between p-2 rounded ${q.missing[k] > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}><span>{lang === 'en' ? en : ne}</span><b>{q.missing[k] ?? 0}</b></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <h3 className="font-semibold text-gov-blue p-4 pb-2">{t('सबैभन्दा कम पूर्णता भएका कृषक (सुधार्नुपर्ने)', 'Farmers with the lowest completeness (to fix first)')}</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left"><tr><th className="p-3">{t('कोड', 'Code')}</th><th className="p-3">{t('नाम', 'Name')}</th><th className="p-3">%</th><th className="p-3">{t('अपुग', 'Missing')}</th></tr></thead>
          <tbody>
            {q.lowest.length === 0 && <tr><td colSpan="4" className="p-4 text-center text-gray-500">—</td></tr>}
            {q.lowest.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-3 whitespace-nowrap">{r.farmer_code}</td>
                <td className="p-3"><Link className="text-gov-blue hover:underline font-medium" to={`/app/farmers/${r.id}`}>{r.name}</Link></td>
                <td className="p-3">{r.completeness}</td>
                <td className="p-3"><div className="flex flex-wrap gap-1">{r.missing.slice(0, 6).map((m) => <span key={m.key} className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-900 text-xs">{lang === 'en' ? m.en : m.ne}</span>)}{r.missing.length > 6 && <span className="text-xs text-gray-500">+{r.missing.length - 6}</span>}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <h3 className="font-semibold text-gov-blue p-4 pb-1">🔎 {t('सम्भावित त्रुटि: असामान्य उत्पादकता', 'Possible entry errors: unusual yields')}</h3>
        <p className="text-xs text-gray-500 px-4 pb-2">{t('एउटै बाली र प्रणालीका कम्तीमा ८ अभिलेख भएपछि मात्र जाँचिन्छ। यो सङ्केत मात्र हो — सही हुन पनि सक्छ।', 'Checked only when a crop and system has at least 8 records. This is a flag to review, not proof of an error.')}</p>
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left"><tr><th className="p-3">{t('कृषक', 'Farmer')}</th><th className="p-3">{t('बाली', 'Crop')}</th><th className="p-3">{t('आ.व.', 'FY')}</th><th className="p-3">{t('उत्पादकता', 'Yield')}</th><th className="p-3">{t('सामान्य (मध्यक)', 'Typical (median)')}</th></tr></thead>
          <tbody>
            {q.outliers.length === 0 && <tr><td colSpan="5" className="p-4 text-center text-gray-500">{t('कुनै असामान्य अभिलेख भेटिएन (वा तथ्याङ्क पर्याप्त छैन)', 'Nothing flagged (or not enough data yet)')}</td></tr>}
            {q.outliers.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-3"><Link className="text-gov-blue hover:underline" to={`/app/farmers/${o.farmer_id}`}>{o.farmer_code}</Link> · {o.farm_name}</td>
                <td className="p-3">{lang === 'en' ? o.crop_en : o.crop_ne}</td><td className="p-3">{o.fiscal_year}</td>
                <td className="p-3 font-semibold text-gov-red">{o.yield_kg_ha} kg/ha</td><td className="p-3">{o.median_kg_ha} kg/ha</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

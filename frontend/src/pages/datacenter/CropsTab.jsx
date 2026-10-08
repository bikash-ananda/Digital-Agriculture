import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../../services/api';
import { formatLand, nf, val } from '../../utils/dc';

export default function CropsTab({ fy, lang, t }) {
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(null);
  const [trend, setTrend] = useState(null);

  useEffect(() => {
    setSel(null);
    api.get('/datacenter/crops', { params: { fy } }).then((r) => setData(r.data)).catch(() => setData({ crops: [] }));
  }, [fy]);
  useEffect(() => {
    if (!sel) { setTrend(null); return; }
    api.get('/datacenter/trends', { params: { crop_id: sel } }).then((r) => setTrend(r.data)).catch(() => setTrend([]));
  }, [sel]);

  if (!data) return <p className="text-gray-500">…</p>;
  const nm = (c) => (lang === 'en' ? c.name_en : c.name_ne);
  const chart = data.crops.slice(0, 10).map((c) => ({ name: nm(c), t: Math.round((c.production_kg / 1000) * 100) / 100 }));
  const heads = [t('बाली', 'Crop'), t('कृषक', 'Farmers'), t('क्षेत्रफल', 'Area'), `${t('उत्पादन', 'Production')} (t)`, `${t('उत्पादकता', 'Yield')} (kg/ha)`, t('बिक्री %', 'Sold %'), t('क्षति %', 'Loss %'), t('औसत मूल्य (रु./के.जी.)', 'Avg price (NPR/kg)')];
  return (
    <div className="space-y-5">
      {data.crops.length === 0 && <p className="p-4 bg-yellow-50 text-yellow-900 rounded text-sm">{t('यो आर्थिक वर्षमा कुनै उत्पादन अभिलेख छैन', 'No production records for this fiscal year')}</p>}
      {data.crops.length > 0 && (
        <>
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left"><tr>{heads.map((h, i) => <th key={i} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {data.crops.map((c) => (
                  <tr key={c.id} className={`border-t cursor-pointer hover:bg-gray-50 ${sel === c.id ? 'bg-green-50' : ''}`} onClick={() => setSel(sel === c.id ? null : c.id)}>
                    <td className="p-3 font-medium text-gov-blue">{nm(c)}</td><td className="p-3">{c.farmers}</td><td className="p-3 whitespace-nowrap">{formatLand(c.area_sqm, lang)}</td>
                    <td className="p-3">{nf(c.production_kg / 1000, 2)}</td><td className="p-3">{val(c.yield_kg_ha, 0)}</td><td className="p-3">{val(c.sold_pct, 0)}</td><td className="p-3">{val(c.loss_pct, 0)}</td><td className="p-3">{val(c.avg_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gov-blue mb-2">{t('उत्पादन अनुसार शीर्ष बाली (टन)', 'Top crops by production (tonnes)')}</h3>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis width={45} /><Tooltip />
                  <Bar dataKey="t" fill="#15803d" radius={[4, 4, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
      {sel && trend && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-gov-blue mb-2">{t('आर्थिक वर्ष अनुसार प्रवृत्ति', 'Trend by fiscal year')}</h3>
          {trend.length < 2 && <p className="text-xs text-gray-500 mb-2">{t('प्रवृत्ति देखाउन कम्तीमा दुई आर्थिक वर्षको तथ्याङ्क चाहिन्छ।', 'At least two fiscal years of data are needed to show a trend.')}</p>}
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={trend.map((x) => ({ fy: x.fiscal_year, t: Math.round((x.production_kg / 1000) * 100) / 100 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="fy" /><YAxis width={45} /><Tooltip /><Bar dataKey="t" name="tonnes" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="w-full text-sm mt-3">
            <thead className="bg-gray-100 text-left"><tr><th className="p-2">{t('आ.व.', 'FY')}</th><th className="p-2">{t('कृषक', 'Farmers')}</th><th className="p-2">{t('उत्पादकता (kg/ha)', 'Yield (kg/ha)')}</th></tr></thead>
            <tbody>{trend.map((x) => <tr key={x.fiscal_year} className="border-t"><td className="p-2">{x.fiscal_year}</td><td className="p-2">{x.farmers}</td><td className="p-2">{val(x.yield_kg_ha, 0)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">{t('उत्पादकता क्षेत्रफल र उत्पादन दुवै भएका अभिलेखबाट मात्र गणना गरिन्छ। बाली छानेर प्रवृत्ति हेर्नुहोस्।', 'Yield uses only records that have both area and production. Click a crop to see its trend.')}</p>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../../services/api';
import { formatLand, nf } from '../../utils/dc';

export default function LocalLevelsTab({ fy, lang, t }) {
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(null);
  const [wards, setWards] = useState(null);

  useEffect(() => {
    api.get('/datacenter/local-levels', { params: { fy } }).then((r) => setData(r.data)).catch(() => setData({ levels: [], unspecified: 0 }));
  }, [fy]);
  useEffect(() => {
    if (!sel) { setWards(null); return; }
    api.get('/datacenter/wards', { params: { local_level_id: sel } }).then((r) => setWards(r.data)).catch(() => setWards(null));
  }, [sel]);

  if (!data) return <p className="text-gray-500">…</p>;
  const name = (l) => (lang === 'en' ? l.name_en : l.name_ne);
  const chart = data.levels.map((l) => ({ name: name(l), farmers: l.farmers }));
  const heads = [t('स्थानीय तह', 'Local level'), t('वडा', 'Wards'), t('कृषक', 'Farmers'), t('फार्म', 'Farms'), t('जमिन', 'Land'), `${t('उत्पादन', 'Production')} (t)`, t('यन्त्र', 'Devices'), t('पूर्णता', 'Completeness')];
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left"><tr>{heads.map((h, i) => <th key={i} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {data.levels.map((l) => (
              <tr key={l.id} className={`border-t cursor-pointer hover:bg-gray-50 ${sel === l.id ? 'bg-green-50' : ''}`} onClick={() => setSel(sel === l.id ? null : l.id)}>
                <td className="p-3 font-medium text-gov-blue">{name(l)}</td><td className="p-3">{l.total_wards || '—'}</td><td className="p-3">{nf(l.farmers)}</td><td className="p-3">{nf(l.farms)}</td>
                <td className="p-3 whitespace-nowrap">{formatLand(l.area_sqm, lang)}</td><td className="p-3">{nf(l.production_kg / 1000, 2)}</td><td className="p-3">{l.devices}</td><td className="p-3">{l.completeness}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.unspecified > 0 && <p className="p-3 bg-yellow-50 text-yellow-900 rounded text-sm">⚠ {data.unspecified} {t('कृषकको स्थानीय तह खुलेको छैन', 'farmers have no local level recorded')}</p>}
      <p className="text-xs text-gray-500">{t('तालिकाको पङ्क्तिमा थिचेर वडा अनुसारको विवरण हेर्नुहोस्। कृषकको बसोबास स्थानको आधारमा गणना गरिएको।', 'Click a row for the ward breakdown. Counts use the farmer’s place of residence.')}</p>
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gov-blue mb-2">{t('स्थानीय तह अनुसार कृषक', 'Farmers by local level')}</h3>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={chart} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} width={40} /><Tooltip />
              <Bar dataKey="farmers" fill="#15803d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {wards && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-gov-blue mb-2">{name(wards.local_level)} — {t('वडा अनुसार', 'by ward')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left"><tr><th className="p-2">{t('वडा', 'Ward')}</th><th className="p-2">{t('कृषक', 'Farmers')}</th><th className="p-2">{t('फार्म', 'Farms')}</th><th className="p-2">{t('जमिन', 'Land')}</th></tr></thead>
              <tbody>
                {wards.wards.map((w) => (
                  <tr key={w.ward} className="border-t"><td className="p-2">{w.ward}</td><td className="p-2">{w.farmers}</td><td className="p-2">{w.farms}</td><td className="p-2 whitespace-nowrap">{w.area_sqm ? formatLand(w.area_sqm, lang) : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

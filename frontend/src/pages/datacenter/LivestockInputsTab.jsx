import { useEffect, useState } from 'react';
import api from '../../services/api';
import { lbl } from '../../utils/enumLabels';
import { formatLand, nf } from '../../utils/dc';

export default function LivestockInputsTab({ fy, lang, t }) {
  const [live, setLive] = useState(null);
  const [inp, setInp] = useState(null);
  useEffect(() => {
    api.get('/datacenter/livestock', { params: { fy } }).then((r) => setLive(r.data)).catch(() => setLive({ animals: [], outputs: [] }));
    api.get('/datacenter/inputs', { params: { fy } }).then((r) => setInp(r.data)).catch(() => setInp({ inputs: [] }));
  }, [fy]);
  if (!live || !inp) return <p className="text-gray-500">…</p>;
  const outputs = (type) => live.outputs.filter((o) => o.animal_type === type).map((o) => `${nf(o.qty, 1)} ${o.output_unit}`).join(', ') || '—';
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-gov-blue mb-2">🐄 {t('पशुपालन, माछा तथा मौरी', 'Livestock, fish and bees')} ({fy})</h3>
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left"><tr><th className="p-3">{t('प्रकार', 'Type')}</th><th className="p-3">{t('कृषक', 'Farmers')}</th><th className="p-3">{t('कुल संख्या', 'Total count')}</th><th className="p-3">{t('पोखरी क्षेत्र', 'Pond area')}</th><th className="p-3">{t('वार्षिक उत्पादन', 'Annual output')}</th></tr></thead>
            <tbody>
              {live.animals.length === 0 && <tr><td colSpan="5" className="p-4 text-center text-gray-500">{t('अभिलेख छैन', 'No records')}</td></tr>}
              {live.animals.map((a) => (
                <tr key={a.animal_type} className="border-t"><td className="p-3 font-medium">{lbl(a.animal_type, lang)}</td><td className="p-3">{a.farmers}</td><td className="p-3">{nf(a.heads)}</td>
                  <td className="p-3">{a.pond_area_sqm ? formatLand(a.pond_area_sqm, lang) : '—'}</td><td className="p-3">{outputs(a.animal_type)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-gov-blue mb-2">🧪 {t('मल, विषादी र बिउको प्रयोग', 'Fertilizer, pesticide and seed use')} ({fy})</h3>
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left"><tr><th className="p-3">{t('प्रकार', 'Type')}</th><th className="p-3">{t('कृषक', 'Farmers')}</th><th className="p-3">{t('कुल परिमाण', 'Total quantity')}</th><th className="p-3">{t('कुल लागत (रु.)', 'Total cost (NPR)')}</th></tr></thead>
            <tbody>
              {inp.inputs.length === 0 && <tr><td colSpan="4" className="p-4 text-center text-gray-500">{t('अभिलेख छैन', 'No records')}</td></tr>}
              {inp.inputs.map((x) => (
                <tr key={`${x.input_type}-${x.unit}`} className="border-t"><td className="p-3 font-medium">{lbl(x.input_type, lang)}</td><td className="p-3">{x.farmers}</td><td className="p-3">{nf(x.qty, 1)} {lbl(x.unit, lang)}</td><td className="p-3">{nf(x.cost)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

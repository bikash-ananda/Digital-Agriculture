import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/useAuth';

export default function ExportTab({ fy, t }) {
  const { can } = useAuth();
  const [sum, setSum] = useState(null);
  const [purpose, setPurpose] = useState('');
  const [allYears, setAllYears] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadSummary = () => api.get('/datacenter/export-summary').then((r) => setSum(r.data)).catch(() => setSum(null));
  useEffect(() => { loadSummary(); }, []);

  const download = async (dataset) => {
    setMsg(null); setBusy(true);
    try {
      const r = await api.get(`/datacenter/export/${dataset}`, { params: { purpose, fy: dataset === 'production' && !allYears ? fy : undefined }, responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = `kaski_${dataset}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
      setMsg({ ok: true, text: t('डाउनलोड भयो र लग गरियो', 'Downloaded and logged') });
      loadSummary();
    } catch (e) {
      let text = 'Export failed';
      try { text = JSON.parse(await e.response.data.text()).message || text; } catch { /* keep default */ }
      setMsg({ ok: false, text });
    } finally { setBusy(false); }
  };

  const okPurpose = purpose.trim().length >= 10;
  return (
    <div className="space-y-5 max-w-4xl">
      <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded p-4 text-sm space-y-1">
        <p className="font-semibold">🔒 {t('गोपनीयता नियम', 'Privacy rules')}</p>
        <ul className="list-disc pl-5">
          <li>{t('अनुसन्धान तथ्याङ्कमा केवल प्रमाणित र अनुसन्धान सहमति दिएका कृषक समावेश हुन्छन्।', 'The research dataset includes only verified farmers who gave research consent.')}</li>
          <li>{t('नाम, फोन, इमेल र ठ्याक्कै स्थान हटाइन्छ; कृषकको पहिचान सङ्केत (pseudonym) ले बदलिन्छ।', 'Names, phones, emails and exact locations are removed; farmers get stable pseudonymous IDs.')}</li>
          <li>{t('५ भन्दा कम कृषक भएको स्थानीय तह वा वडा खाली राखिन्छ (k = ५)।', 'A local level or ward with fewer than 5 farmers is blanked out (k = 5).')}</li>
          <li>{t('हरेक निर्यात उद्देश्यसहित लग हुन्छ।', 'Every export is logged with its purpose.')}</li>
        </ul>
      </div>

      {sum && (
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500">{t('सक्रिय कृषक', 'Active farmers')}</p><p className="text-2xl font-bold text-gov-blue">{sum.farmers_total}</p></div>
          <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500">{t('अनुसन्धानका लागि योग्य कृषक', 'Eligible for research export')}</p><p className="text-2xl font-bold text-agri-green">{sum.farmers_eligible}</p></div>
          <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500">{t('योग्य उत्पादन अभिलेख', 'Eligible production records')}</p><p className="text-2xl font-bold text-agri-green">{sum.production_records_eligible}</p></div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <label className="block text-sm"><span className="font-medium">{t('निर्यातको उद्देश्य (अनिवार्य, कम्तीमा १० अक्षर)', 'Purpose of this export (required, at least 10 characters)')}</span>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={255} className="mt-1 w-full border rounded p-2" placeholder={t('जस्तै: गोलभेंडा उत्पादकत्वको अध्ययन', 'e.g. Study of tomato yields in tunnels')} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allYears} onChange={(e) => setAllYears(e.target.checked)} /> {t('सबै आर्थिक वर्ष समावेश गर्ने', 'Include all fiscal years')} ({allYears ? t('सबै', 'all') : fy})</label>
        <div className="flex flex-wrap gap-3">
          <button disabled={!okPurpose || busy} onClick={() => download('production')} className="bg-agri-green hover:bg-green-800 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50">⬇ {t('अनुसन्धान डाटासेट (गुमनाम उत्पादन)', 'Research dataset (anonymized production)')}</button>
          {can('datacenter.export_identified') && (
            <button disabled={!okPurpose || busy} onClick={() => download('farmers')} className="border border-gov-red text-gov-red px-4 py-2 rounded text-sm font-semibold disabled:opacity-50">⬇ {t('कृषक सूची (पहिचान सहित)', 'Farmer list (identified)')}</button>
          )}
        </div>
        {can('datacenter.export_identified') && <p className="text-xs text-gray-500">{t('पहिचान सहितको सूचीमा फोन नम्बर हुन्छ — आधिकारिक कार्यका लागि मात्र प्रयोग गर्नुहोस्।', 'The identified list contains phone numbers. Use it for official work only.')}</p>}
        {msg && <p className={`p-2 rounded text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
      </div>

      {sum && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <h3 className="font-semibold text-gov-blue p-4 pb-2">{t('हालैका निर्यात', 'Recent exports')}</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left"><tr><th className="p-3">{t('मिति', 'Date')}</th><th className="p-3">{t('प्रयोगकर्ता', 'User')}</th><th className="p-3">{t('डाटासेट', 'Dataset')}</th><th className="p-3">{t('स्तर', 'Level')}</th><th className="p-3">{t('पङ्क्ति', 'Rows')}</th><th className="p-3">{t('उद्देश्य', 'Purpose')}</th></tr></thead>
            <tbody>
              {sum.recent.length === 0 && <tr><td colSpan="6" className="p-4 text-center text-gray-500">—</td></tr>}
              {sum.recent.map((e) => (
                <tr key={e.id} className="border-t"><td className="p-3 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td><td className="p-3">{e.username}</td><td className="p-3">{e.dataset}</td><td className="p-3">{e.privacy_level}</td><td className="p-3">{e.row_count}</td><td className="p-3">{e.purpose}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

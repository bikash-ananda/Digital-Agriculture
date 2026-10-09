import { useEffect, useState } from 'react';
import api from '../../services/api';
import UnitPicker from '../../components/research/UnitPicker';

const save = (blob, name) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); };

export default function ResearchExportTab({ units, range, lang, t }) {
  const [dataset, setDataset] = useState('daily');
  const [sel, setSel] = useState([]);
  const [purpose, setPurpose] = useState('');
  const [sim, setSim] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setSel(units.filter((u) => !u.is_simulated).map((u) => u.id)); }, [units]);

  const download = async () => {
    setMsg(null); setBusy(true);
    try {
      const r = await api.get(`/research/export/${dataset}`, { params: { ...range, purpose, unit_ids: sel.join(',') || undefined, include_simulated: sim ? '1' : undefined }, responseType: 'blob' });
      save(r.data, `research_${dataset}_${range.from}_${range.to}.csv`);
      setMsg({ ok: true, text: t('डाउनलोड भयो र लग गरियो', 'Downloaded and logged') });
    } catch (e) {
      let text = 'Export failed';
      try { text = JSON.parse(await e.response.data.text()).message || text; } catch { /* keep */ }
      setMsg({ ok: false, text });
    } finally { setBusy(false); }
  };
  const dict = async () => { try { const r = await api.get('/research/dictionary', { responseType: 'blob' }); save(r.data, 'research_data_dictionary.md'); } catch { setMsg({ ok: false, text: 'Download failed' }); } };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded p-4 text-sm space-y-1">
        <p className="font-semibold">{t('निर्यातका नियम', 'Export rules')}</p>
        <ul className="list-disc pl-5">
          <li>{t('कृषकका फार्ममा रहेका इकाई सहमति दिएका र प्रमाणित कृषकको मात्र समावेश हुन्छन्; पहिचान सङ्केत (pseudonym) ले बदलिन्छन्।', 'Greenhouses on farmer farms are included only for verified farmers with research consent, and identifiers are pseudonymous.')}</li>
          <li>{t('सिमुलेसन तथ्याङ्क डिफल्टमा समावेश हुँदैन।', 'Simulated data is excluded by default.')}</li>
          <li>{t('निर्यातसँगै डाटा शब्दकोश डाउनलोड गर्नुहोस् — मापकको परिभाषा र सीमा त्यहीँ छ।', 'Download the data dictionary with every export; it explains each metric and its limits.')}</li>
        </ul>
        <button onClick={dict} className="mt-2 bg-white border border-blue-300 px-3 py-1.5 rounded text-sm font-semibold">⬇ {t('डाटा शब्दकोश', 'Data dictionary')}</button>
      </div>
      <div className="bg-white rounded-lg shadow p-4 space-y-3 text-sm">
        <div className="flex flex-wrap gap-4">
          <label>{t('डाटासेट', 'Dataset')}<select value={dataset} onChange={(e) => setDataset(e.target.value)} className="block mt-1 border rounded p-2 bg-white"><option value="daily">{t('दैनिक (प्रति ग्रीनहाउस)', 'Daily (per greenhouse)')}</option><option value="hourly">{t('घण्टागत (प्रति सेन्सर, ६२ दिनसम्म)', 'Hourly (per sensor, up to 62 days)')}</option></select></label>
          <p className="pt-6 text-gray-600">{range.from} → {range.to}</p>
        </div>
        <UnitPicker units={units} value={sel} onChange={setSel} lang={lang} />
        <label className="flex items-center gap-2"><input type="checkbox" checked={sim} onChange={(e) => setSim(e.target.checked)} /> {t('सिमुलेसन इकाई समावेश गर्ने', 'Include simulated units')}</label>
        <label className="block">{t('उद्देश्य (अनिवार्य, कम्तीमा १० अक्षर)', 'Purpose (required, at least 10 characters)')}<input value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={255} className="mt-1 w-full border rounded p-2" /></label>
        <button disabled={busy || purpose.trim().length < 10} onClick={download} className="bg-agri-green text-white px-4 py-2 rounded font-semibold disabled:opacity-50">⬇ {t('CSV डाउनलोड', 'Download CSV')}</button>
        {msg && <p className={`p-2 rounded ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wifi, WifiOff, Plus } from 'lucide-react';
import api from '../../services/api';
import useLang from '../../utils/useLang';
import { listSurveys, newSurvey, saveSurvey, removeSurvey } from '../../utils/surveyStore';

export default function SurveyHome() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [items, setItems] = useState(listSurveys());
  const [online, setOnline] = useState(navigator.onLine);
  const [msg, setMsg] = useState('');
  const refresh = () => setItems(listSurveys());

  const syncAll = async () => {
    const queue = listSurveys().filter((s) => s.status === 'queued');
    let sent = 0;
    for (const s of queue) {
      const d = s.data;
      try {
        await api.post('/datacenter/survey', { client_uuid: s.id, farmer: d.farmer, farm: d.farm, crops: d.crops.filter((c) => c.crop_id), livestock: d.livestock.filter((l) => l.animal_type), consent: d.consent });
        removeSurvey(s.id); sent += 1;
      } catch (e) {
        if (!e.response) break;
        saveSurvey({ ...s, status: 'error', error: e.response.data?.message || 'Rejected by the server' });
      }
    }
    setMsg(sent ? t(`${sent} सर्वेक्षण पठाइयो`, `${sent} survey(s) sent`) : '');
    refresh();
  };

  useEffect(() => {
    const on = () => { setOnline(true); syncAll(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const create = () => { const s = newSurvey(); saveSurvey(s); navigate(`/app/data-center/survey/${s.id}`); };
  const del = (id) => { if (window.confirm(t('यो मस्यौदा मेट्ने? यसमा भरिएको विवरण यो यन्त्रबाट हट्नेछ।', 'Delete this draft? The details entered will be removed from this device.'))) { removeSurvey(id); refresh(); } };
  const STATUS = { draft: t('मस्यौदा', 'Draft'), queued: t('पठाउन बाँकी', 'Waiting to send'), error: t('समीक्षा चाहिन्छ', 'Needs review') };
  const COLOR = { draft: 'bg-gray-100 text-gray-700', queued: 'bg-blue-100 text-blue-800', error: 'bg-red-100 text-red-800' };

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/app/data-center" className="text-sm text-gov-blue underline">← {t('डाटा केन्द्र', 'Data Center')}</Link>
        <span className={`ml-auto flex items-center gap-1.5 text-sm ${online ? 'text-green-700' : 'text-red-700'}`}>{online ? <Wifi size={16} /> : <WifiOff size={16} />} {online ? t('अनलाइन', 'Online') : t('अफलाइन — विवरण यही यन्त्रमा सुरक्षित रहन्छ', 'Offline — your entries stay on this device')}</span>
      </div>
      <h2 className="text-2xl font-bold text-terrace-900">{t('क्षेत्रगत सर्वेक्षण', 'Field survey')}</h2>
      <p className="text-gray-700">{t('खेतमै कृषक दर्ता, फार्मको GPS स्थान, बाली र पशुपालन एकै पटक सङ्कलन गर्नुहोस्। पेश गरेपछि अधिकृतले प्रमाणित गर्छन्।', 'Register a farmer, capture the farm’s GPS location, crops and livestock in one visit. An officer verifies it after you submit.')}</p>
      <button onClick={create} className="flex items-center gap-2 bg-terrace-800 hover:bg-terrace-900 text-white px-6 py-3.5 rounded-md font-semibold text-lg w-full sm:w-auto justify-center"><Plus size={20} /> {t('नयाँ सर्वेक्षण सुरु गर्नुहोस्', 'Start a new survey')}</button>
      {msg && <p className="p-3 bg-green-50 text-green-800 rounded text-sm">{msg}</p>}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-terrace-900">{t('यो यन्त्रमा रहेका सर्वेक्षण', 'Surveys on this device')} ({items.length})</h3>
        {items.some((s) => s.status === 'queued') && <button onClick={syncAll} disabled={!online} className="text-sm border border-terrace-800 text-terrace-800 px-3 py-1.5 rounded disabled:opacity-50">{t('अहिले पठाउनुहोस्', 'Send now')}</button>}
      </div>
      <ul className="bg-white rounded-lg shadow divide-y">
        {items.length === 0 && <li className="p-5 text-gray-500 text-center">{t('कुनै सर्वेक्षण छैन', 'No surveys yet')}</li>}
        {items.map((s) => (
          <li key={s.id} className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-48">
              <p className="font-semibold text-terrace-900">{s.data.farmer.full_name_ne || s.data.farmer.full_name_en || t('नाम नभएको', 'Unnamed farmer')}</p>
              <p className="text-xs text-gray-500">{new Date(s.updated_at).toLocaleString()}</p>
              {s.status === 'error' && s.error && <p className="text-xs text-red-700 mt-1">{s.error}</p>}
            </div>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${COLOR[s.status] || COLOR.draft}`}>{STATUS[s.status] || s.status}</span>
            <Link to={`/app/data-center/survey/${s.id}`} className="text-gov-blue underline text-sm">{t('खोल्नुहोस्', 'Open')}</Link>
            <button onClick={() => del(s.id)} className="text-gov-red underline text-sm">{t('मेट्नुहोस्', 'Delete')}</button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">{t('मस्यौदामा व्यक्तिगत विवरण यो यन्त्रमा सुरक्षित हुन्छ। सफलतापूर्वक पठाएपछि हट्छ। साझा वा व्यक्तिगत फोनमा नराख्नुहोस्।', 'Drafts keep personal details on this device until they are sent successfully. Avoid using shared or personal phones.')}</p>
    </div>
  );
}

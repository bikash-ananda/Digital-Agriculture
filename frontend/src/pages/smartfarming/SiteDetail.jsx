import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import FormField, { inputCls } from '../../components/common/FormField';
import StatusBadge from '../../components/common/StatusBadge';
import { errMsgs } from '../../utils/errors';

const emptyUnit = { unit_type: 'greenhouse', name_en: '', name_ne: '', area_sqm: '' };
const emptyDev = { device_code: '', growing_unit_id: '', device_type: 'esp32' };
const emptyLocation = { latitude: '', longitude: '' };

export default function SiteDetail() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  const t = (ne, en) => (lang === 'en' ? en : ne);
  const { id } = useParams();
  const { can } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [unit, setUnit] = useState(emptyUnit);
  const [dev, setDev] = useState(emptyDev);
  const [location, setLocation] = useState(emptyLocation);
  const [showUnit, setShowUnit] = useState(false);
  const [showDev, setShowDev] = useState(false);
  const [errs, setErrs] = useState([]);
  const [newKey, setNewKey] = useState(null);

  const load = () => api.get(`/smart/sites/${id}`).then((r) => {
    setData(r.data);
    setLocation({ latitude: r.data.site.latitude ?? '', longitude: r.data.site.longitude ?? '' });
  }).catch((e) => setError(errMsgs(e)[0]));
  useEffect(() => { load(); }, [id]);

  const addUnit = async (e) => {
    e.preventDefault(); setErrs([]);
    try { await api.post(`/smart/sites/${id}/units`, unit); setUnit(emptyUnit); setShowUnit(false); load(); }
    catch (err) { setErrs(errMsgs(err)); }
  };
  const addDevice = async (e) => {
    e.preventDefault(); setErrs([]);
    try {
      const r = await api.post(`/smart/sites/${id}/devices`, dev);
      setNewKey({ code: r.data.device_code, key: r.data.api_key });
      setDev(emptyDev); setShowDev(false); load();
    } catch (err) { setErrs(errMsgs(err)); }
  };
  const saveLocation = async (e) => {
    e.preventDefault(); setErrs([]);
    try { await api.put(`/smart/sites/${id}/location`, location); load(); }
    catch (err) { setErrs(errMsgs(err)); }
  };

  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>;
  if (!data) return <p className="text-gray-500">...</p>;
  const { site, units, devices } = data;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <Link to="/app/smart-farming" className="text-sm text-gov-blue underline">← {t('स्मार्ट फार्मिङ', 'Smart Farming')}</Link>
        <h2 className="text-2xl font-bold text-gov-blue mt-1">{lang === 'en' ? site.name_en : site.name_ne}</h2>
        <p className="text-sm text-gray-600">{site.code} · {site.site_type} · {site.address || '-'}{site.latitude ? ` · ${site.latitude}, ${site.longitude}` : ''}</p>
      </div>

      {errs.length > 0 && <ul className="p-3 bg-red-50 text-red-700 rounded text-sm list-disc pl-6">{errs.map((x, i) => <li key={i}>{x}</li>)}</ul>}

      {can('smart_farming.create') && <form onSubmit={saveLocation} className="bg-white rounded-lg shadow p-4 grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2"><h3 className="font-semibold text-gov-blue">{t('साइटको स्थान तथा बाहिरी मौसम', 'Site location and outdoor weather')}</h3><p className="text-sm text-gray-600">{t('अक्षांश र देशान्तर राखेपछि स्थानीय मौसम यस साइटको कन्सोलमा देखिन्छ।', 'Set coordinates to show local outdoor weather in this site’s console.')}</p></div>
        <FormField label={t('अक्षांश', 'Latitude')}><input type="number" step="any" min="-90" max="90" value={location.latitude} onChange={(e) => setLocation({ ...location, latitude: e.target.value })} className={inputCls} /></FormField>
        <FormField label={t('देशान्तर', 'Longitude')}><input type="number" step="any" min="-180" max="180" value={location.longitude} onChange={(e) => setLocation({ ...location, longitude: e.target.value })} className={inputCls} /></FormField>
        <div className="sm:col-span-2"><button className="bg-agri-green text-white px-4 py-2 rounded text-sm">{t('स्थान सुरक्षित गर्नुहोस्', 'Save location')}</button></div>
      </form>}

      {newKey && (
        <div className="p-4 bg-yellow-50 border border-yellow-300 rounded">
          <p className="font-semibold">{t('यन्त्र API कुञ्जी (एक पटक मात्र देखिन्छ)', 'Device API key (shown only once)')}: {newKey.code}</p>
          <code className="block mt-2 p-2 bg-white border rounded break-all select-all">{newKey.key}</code>
          <p className="text-sm mt-2">{t('अहिले नै प्रतिलिपि गरी सुरक्षित राख्नुहोस्। यो ESP32 को कोडमा चाहिन्छ।', 'Copy and store it now. You will need it in the ESP32 firmware.')}</p>
          <button onClick={() => setNewKey(null)} className="mt-2 text-sm underline">{t('बन्द गर्नुहोस्', 'Dismiss')}</button>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gov-blue">{t('ग्रीनहाउस / टनेल / खेत', 'Greenhouses / Tunnels / Fields')} ({units.length})</h3>
          {can('smart_farming.create') && <button onClick={() => setShowUnit(!showUnit)} className="bg-agri-green text-white px-3 py-1.5 rounded text-sm">+ {t('थप्नुहोस्', 'Add')}</button>}
        </div>
        {showUnit && (
          <form onSubmit={addUnit} className="bg-white rounded shadow p-4 mb-3 grid sm:grid-cols-2 gap-3">
            <FormField label={t('प्रकार', 'Type')}>
              <select value={unit.unit_type} onChange={(e) => setUnit({ ...unit, unit_type: e.target.value })} className={inputCls}>
                {['greenhouse', 'tunnel', 'open_field'].map((x) => <option key={x}>{x}</option>)}
              </select>
            </FormField>
            <FormField label={`${t('नाम (अंग्रेजी)', 'Name (English)')} *`}><input required value={unit.name_en} onChange={(e) => setUnit({ ...unit, name_en: e.target.value })} className={inputCls} /></FormField>
            <FormField label={t('नाम (नेपाली)', 'Name (Nepali)')}><input value={unit.name_ne} onChange={(e) => setUnit({ ...unit, name_ne: e.target.value })} className={inputCls} /></FormField>
            <FormField label={t('क्षेत्रफल (वर्ग मि.)', 'Area (sq m)')}><input type="number" step="0.01" value={unit.area_sqm} onChange={(e) => setUnit({ ...unit, area_sqm: e.target.value })} className={inputCls} /></FormField>
            <div className="sm:col-span-2"><button className="bg-agri-green text-white px-4 py-2 rounded text-sm">{t('सुरक्षित गर्नुहोस्', 'Save')}</button></div>
          </form>
        )}
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left"><tr>
              <th className="p-3">{t('कोड', 'Code')}</th><th className="p-3">{t('नाम', 'Name')}</th><th className="p-3">{t('प्रकार', 'Type')}</th>
              <th className="p-3">{t('क्षेत्रफल', 'Area')}</th><th className="p-3">{t('यन्त्र', 'Devices')}</th><th className="p-3">{t('स्थिति', 'Status')}</th></tr></thead>
            <tbody>
              {units.length === 0 && <tr><td colSpan="6" className="p-4 text-center text-gray-500">-</td></tr>}
              {units.map((u) => (
                <tr key={u.id} className="border-t"><td className="p-3">{u.code}</td><td className="p-3 font-medium"><Link to={`/app/smart-farming/units/${u.id}`} className="text-gov-blue hover:underline">{lang === 'en' ? u.name_en : (u.name_ne || u.name_en)}</Link></td>
                  <td className="p-3">{u.unit_type}</td><td className="p-3">{u.area_sqm ?? '-'}</td><td className="p-3">{u.device_count}</td><td className="p-3"><StatusBadge value={u.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gov-blue">{t('आइओटी यन्त्रहरू', 'IoT Devices')} ({devices.length})</h3>
          {can('devices.create') && <button onClick={() => setShowDev(!showDev)} className="bg-agri-green text-white px-3 py-1.5 rounded text-sm">+ {t('यन्त्र दर्ता', 'Register Device')}</button>}
        </div>
        {showDev && (
          <form onSubmit={addDevice} className="bg-white rounded shadow p-4 mb-3 grid sm:grid-cols-3 gap-3">
            <FormField label={`${t('यन्त्र कोड', 'Device Code')} *`}><input required value={dev.device_code} onChange={(e) => setDev({ ...dev, device_code: e.target.value })} className={inputCls} placeholder="ESP32-02" /></FormField>
            <FormField label={t('ग्रीनहाउस / इकाई', 'Greenhouse / Unit')}>
              <select value={dev.growing_unit_id} onChange={(e) => setDev({ ...dev, growing_unit_id: e.target.value })} className={inputCls}>
                <option value="">-</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name_en}</option>)}
              </select>
            </FormField>
            <FormField label={t('प्रकार', 'Type')}>
              <select value={dev.device_type} onChange={(e) => setDev({ ...dev, device_type: e.target.value })} className={inputCls}>
                {['esp32', 'esp8266', 'other'].map((x) => <option key={x}>{x}</option>)}
              </select>
            </FormField>
            <div className="sm:col-span-3"><button className="bg-agri-green text-white px-4 py-2 rounded text-sm">{t('दर्ता गर्नुहोस्', 'Register')}</button></div>
          </form>
        )}
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left"><tr>
              <th className="p-3">{t('कोड', 'Code')}</th><th className="p-3">{t('इकाई', 'Unit')}</th><th className="p-3">{t('सेन्सर', 'Sensors')}</th>
              <th className="p-3">{t('एक्चुएटर', 'Actuators')}</th><th className="p-3">{t('अन्तिम सम्पर्क', 'Last Seen')}</th><th className="p-3">{t('स्थिति', 'Status')}</th></tr></thead>
            <tbody>
              {devices.length === 0 && <tr><td colSpan="6" className="p-4 text-center text-gray-500">-</td></tr>}
              {devices.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="p-3"><Link to={`/app/smart-farming/devices/${d.id}`} className="text-gov-blue hover:underline font-medium">{d.device_code}</Link></td>
                  <td className="p-3">{d.unit_name_en || '-'}</td><td className="p-3">{d.sensor_count}</td><td className="p-3">{d.actuator_count}</td>
                  <td className="p-3">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : '-'}</td>
                  <td className="p-3"><StatusBadge value={d.live_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}


import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import FormField, { inputCls } from '../../components/common/FormField';
import StatusBadge from '../../components/common/StatusBadge';
import { errMsgs } from '../../utils/errors';

const emptySensor = { sensor_type: 'temperature', name: '', unit: '', min_valid: '', max_valid: '' };
const emptyAct = { actuator_type: 'irrigation', name: '', max_runtime_seconds: '900' };

export default function DeviceDetail() {
  const { i18n } = useTranslation();
  const t = (ne, en) => (i18n.language === 'en' ? en : ne);
  const { id } = useParams();
  const { can } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [sensor, setSensor] = useState(emptySensor);
  const [act, setAct] = useState(emptyAct);
  const [errs, setErrs] = useState([]);
  const [newKey, setNewKey] = useState(null);

  const load = () => api.get(`/smart/devices/${id}`).then((r) => setData(r.data)).catch((e) => setError(errMsgs(e)[0]));
  useEffect(() => { load(); }, [id]);

  const post = async (path, body, reset) => {
    setErrs([]);
    try { await api.post(`/smart/devices/${id}/${path}`, body); reset(); load(); }
    catch (err) { setErrs(errMsgs(err)); }
  };
  const rotate = async () => {
    if (!window.confirm(t('पुरानो कुञ्जी काम गर्न छोड्नेछ। जारी राख्ने?', 'The old key will stop working. Continue?'))) return;
    try { const r = await api.post(`/smart/devices/${id}/rotate-key`); setNewKey(r.data.api_key); }
    catch (err) { setErrs(errMsgs(err)); }
  };

  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>;
  if (!data) return <p className="text-gray-500">...</p>;
  const { device, sensors, actuators } = data;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={`/app/smart-farming/sites/${device.site_id}`} className="text-sm text-gov-blue underline">← {device.site_name_en}</Link>
          <h2 className="text-2xl font-bold text-gov-blue mt-1">{device.device_code} <StatusBadge value={device.live_status} /></h2>
          <p className="text-sm text-gray-600">{device.device_type} · {device.unit_name_en || '-'} · {t('अन्तिम सम्पर्क', 'last seen')}: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : '-'}</p>
        </div>
        {can('devices.update') && <button onClick={rotate} className="border border-gov-red text-gov-red px-3 py-1.5 rounded text-sm">{t('API कुञ्जी बदल्नुहोस्', 'Rotate API Key')}</button>}
      </div>

      {errs.length > 0 && <ul className="p-3 bg-red-50 text-red-700 rounded text-sm list-disc pl-6">{errs.map((x, i) => <li key={i}>{x}</li>)}</ul>}
      {newKey && (
        <div className="p-4 bg-yellow-50 border border-yellow-300 rounded">
          <p className="font-semibold">{t('नयाँ API कुञ्जी (एक पटक मात्र देखिन्छ)', 'New API key (shown only once)')}</p>
          <code className="block mt-2 p-2 bg-white border rounded break-all select-all">{newKey}</code>
          <button onClick={() => setNewKey(null)} className="mt-2 text-sm underline">{t('बन्द गर्नुहोस्', 'Dismiss')}</button>
        </div>
      )}

      <section>
        <h3 className="text-lg font-semibold text-gov-blue mb-2">{t('सेन्सरहरू', 'Sensors')} ({sensors.length})</h3>
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left"><tr><th className="p-3">{t('नाम', 'Name')}</th><th className="p-3">{t('प्रकार', 'Type')}</th><th className="p-3">{t('इकाई', 'Unit')}</th>
              <th className="p-3">{t('मान्य दायरा', 'Valid range')}</th><th className="p-3">{t('अन्तिम मान', 'Last value')}</th><th className="p-3">{t('स्थिति', 'Status')}</th></tr></thead>
            <tbody>
              {sensors.map((s) => (
                <tr key={s.id} className="border-t"><td className="p-3 font-medium">{s.name}</td><td className="p-3">{s.sensor_type}</td><td className="p-3">{s.unit || '-'}</td>
                  <td className="p-3">{s.min_valid ?? '-'} … {s.max_valid ?? '-'}</td><td className="p-3">{s.last_value ?? '-'}</td><td className="p-3"><StatusBadge value={s.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {can('devices.create') && (
          <form onSubmit={(e) => { e.preventDefault(); post('sensors', sensor, () => setSensor(emptySensor)); }} className="bg-white rounded shadow p-4 mt-3 grid sm:grid-cols-5 gap-3 items-end">
            <FormField label={t('प्रकार', 'Type')}>
              <select value={sensor.sensor_type} onChange={(e) => setSensor({ ...sensor, sensor_type: e.target.value })} className={inputCls}>
                {['temperature', 'humidity', 'soil_moisture', 'ec', 'light', 'water_level', 'ph', 'other'].map((x) => <option key={x}>{x}</option>)}
              </select>
            </FormField>
            <FormField label={`${t('नाम', 'Name')} *`}><input required value={sensor.name} onChange={(e) => setSensor({ ...sensor, name: e.target.value })} className={inputCls} /></FormField>
            <FormField label={t('इकाई', 'Unit')}><input value={sensor.unit} onChange={(e) => setSensor({ ...sensor, unit: e.target.value })} className={inputCls} /></FormField>
            <FormField label="Min"><input type="number" step="any" value={sensor.min_valid} onChange={(e) => setSensor({ ...sensor, min_valid: e.target.value })} className={inputCls} /></FormField>
            <FormField label="Max"><input type="number" step="any" value={sensor.max_valid} onChange={(e) => setSensor({ ...sensor, max_valid: e.target.value })} className={inputCls} /></FormField>
            <div className="sm:col-span-5"><button className="bg-agri-green text-white px-4 py-2 rounded text-sm">+ {t('सेन्सर थप्नुहोस्', 'Add Sensor')}</button></div>
          </form>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gov-blue mb-2">{t('एक्चुएटरहरू', 'Actuators')} ({actuators.length})</h3>
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left"><tr><th className="p-3">{t('नाम', 'Name')}</th><th className="p-3">{t('प्रकार', 'Type')}</th><th className="p-3">{t('मोड', 'Mode')}</th>
              <th className="p-3">{t('अवस्था', 'State')}</th><th className="p-3">{t('अधिकतम समय (से.)', 'Max runtime (s)')}</th><th className="p-3">{t('स्थिति', 'Status')}</th></tr></thead>
            <tbody>
              {actuators.map((a) => (
                <tr key={a.id} className="border-t"><td className="p-3 font-medium">{a.name}</td><td className="p-3">{a.actuator_type}</td><td className="p-3">{a.control_mode}</td>
                  <td className="p-3"><StatusBadge value={a.current_state} /></td><td className="p-3">{a.max_runtime_seconds}</td><td className="p-3"><StatusBadge value={a.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {can('devices.create') && (
          <form onSubmit={(e) => { e.preventDefault(); post('actuators', act, () => setAct(emptyAct)); }} className="bg-white rounded shadow p-4 mt-3 grid sm:grid-cols-3 gap-3 items-end">
            <FormField label={t('प्रकार', 'Type')}>
              <select value={act.actuator_type} onChange={(e) => setAct({ ...act, actuator_type: e.target.value })} className={inputCls}>
                {['irrigation', 'misting', 'fan', 'light', 'other'].map((x) => <option key={x}>{x}</option>)}
              </select>
            </FormField>
            <FormField label={`${t('नाम', 'Name')} *`}><input required value={act.name} onChange={(e) => setAct({ ...act, name: e.target.value })} className={inputCls} /></FormField>
            <FormField label={t('अधिकतम समय (से.)', 'Max runtime (s)')}><input type="number" value={act.max_runtime_seconds} onChange={(e) => setAct({ ...act, max_runtime_seconds: e.target.value })} className={inputCls} /></FormField>
            <div className="sm:col-span-3"><button className="bg-agri-green text-white px-4 py-2 rounded text-sm">+ {t('एक्चुएटर थप्नुहोस्', 'Add Actuator')}</button></div>
          </form>
        )}
      </section>
    </div>
  );
}

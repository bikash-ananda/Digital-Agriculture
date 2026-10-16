import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../context/useAuth';
import FormField, { inputCls } from '../../components/common/FormField';
import StatusBadge from '../../components/common/StatusBadge';
import { errMsgs } from '../../utils/errors';
import HistoryChart from '../../components/greenhouse/HistoryChart';

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

  const load = useCallback(async () => {
    try {
      const response = await api.get('/smart/devices/' + id);
      setData(response.data);
      setError('');
    } catch (loadError) {
      setError(errMsgs(loadError)[0]);
    }
  }, [id]);

  useEffect(() => {
    const initial = window.setTimeout(load, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 15000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);

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

  if (error && !data) return (
    <div className="max-w-6xl space-y-6">
      <div>
        <Link to="/app/smart-farming" className="text-sm text-gov-blue underline">← {t('स्मार्ट फार्मिङ', 'Smart Farming')}</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gov-blue">{t('ESP32 यन्त्र', 'ESP32 device')} #{id}</h2>
            <p className="mt-1 text-sm text-gray-600">{t('ड्यासबोर्ड पूर्वावलोकन · सर्भरबाट यन्त्र विवरण आउन सकेन', 'Dashboard preview · device details could not be loaded from the server')}</p>
          </div>
          <button onClick={load} className="min-h-10 rounded border px-3 py-2 text-sm">{t('पुनः प्रयास गर्नुहोस्', 'Try again')}</button>
        </div>
      </div>

      <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">{t('यन्त्रको लाइभ डाटा अहिले उपलब्ध छैन', 'Live device data is currently unavailable')}</p>
        <p className="mt-1">{t('यो पूर्वावलोकनले सेन्सरको नमुना मान देखाउँछ। यसले वास्तविक सेन्सर रिडिङ जनाउँदैन।', 'This preview shows sample zero values. They are not real sensor readings.')}</p>
        <p className="mt-2 text-xs">{t('सर्भरको प्रतिक्रिया', 'Server response')}: {error}</p>
      </div>

      <section aria-label={t('यन्त्र अवस्था', 'Device status')} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">{t('ड्यासबोर्ड API', 'Dashboard API')}</p>
          <p className="mt-2 text-lg font-semibold text-red-700">{t('अनुपलब्ध', 'Unavailable')}</p>
          <p className="mt-1 text-xs text-gray-500">{t('यन्त्र विवरण अनुरोध असफल भयो', 'Device details request failed')}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">{t('ESP32 जडान', 'ESP32 connection')}</p>
          <p className="mt-2 text-lg font-semibold text-slate-700">{t('पुष्टि हुन सकेन', 'Unknown')}</p>
          <p className="mt-1 text-xs text-gray-500">{t('सर्भरको device status उपलब्ध छैन', 'Server device status is unavailable')}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">{t('अन्तिम डाटा', 'Last data received')}</p>
          <p className="mt-2 text-lg font-semibold text-slate-700">—</p>
          <p className="mt-1 text-xs text-gray-500">{t('अहिले पढ्न सकिएन', 'Could not be loaded')}</p>
        </article>
      </section>

      <section aria-label={t('नमुना सेन्सर मान', 'Sample sensor values')} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { key: 'temperature', label: t('तापक्रम', 'Temperature'), value: '0 °C' },
          { key: 'humidity', label: t('आर्द्रता', 'Humidity'), value: '0 %' },
          { key: 'soil', label: t('माटोको चिस्यान', 'Soil moisture'), value: '0 %' },
          { key: 'light', label: t('प्रकाश', 'Light'), value: '0 lux' }
        ].map((item) => (
          <article key={item.key} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-600">{item.label}</p>
            <p className="mt-3 text-3xl font-bold text-gov-blue">{item.value}</p>
            <p className="mt-2 text-xs text-gray-500">{t('नमुना मान · वास्तविक डाटा छैन', 'Sample value · no live reading')}</p>
          </article>
        ))}
      </section>
    </div>
  );
  if (!data) return <p className="text-gray-500">...</p>;
  const { device, sensors, actuators, telemetry } = data;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={`/app/smart-farming/sites/${device.site_id}`} className="text-sm text-gov-blue underline">← {device.site_name_en}</Link>
          <h2 className="text-2xl font-bold text-gov-blue mt-1">{device.device_code} <StatusBadge value={device.live_status} /></h2>
          <p className="text-sm text-gray-600">{device.device_type} · {device.unit_name_en || '-'} · {t('अन्तिम सम्पर्क', 'last seen')}: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : '-'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={load} className="border px-3 py-2 rounded text-sm min-h-10">{t('ताजा गर्नुहोस्', 'Refresh')}</button>
          <button onClick={() => window.print()} className="border px-3 py-2 rounded text-sm min-h-10">{t('छाप्नुहोस् / PDF', 'Print / PDF')}</button>
          {can('devices.update') && <button onClick={rotate} className="border border-gov-red text-gov-red px-3 py-2 rounded text-sm min-h-10">{t('API कुञ्जी बदल्नुहोस्', 'Rotate API Key')}</button>}
        </div>
      </div>

      {error && data && <div role="status" className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded text-sm">{t('सर्भरबाट नयाँ डाटा आउन सकेन। देखाइएको मान अन्तिम प्राप्त डाटा हो।', 'Could not refresh from the server. Values shown are the last received readings.')} {error}</div>}

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <article className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">{t('सर्भरमा अन्तिम डाटा', 'Last data received')}</p>
          <p className="mt-2 font-semibold text-sm">{device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : t('डाटा आएको छैन', 'No data received')}</p>
          <div className="mt-2"><StatusBadge value={device.live_status} /></div>
        </article>
        <article className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">{t('वाई-फाई संकेत', 'Wi-Fi signal')}</p>
          <p className="mt-2 text-2xl font-bold">{telemetry?.rssi == null ? '—' : String(telemetry.rssi) + ' dBm'}</p>
          <p className="mt-1 text-xs text-gray-500">{telemetry?.recorded_at ? new Date(telemetry.recorded_at).toLocaleString() : t('स्वास्थ्य डाटा छैन', 'No health telemetry yet')}</p>
        </article>
        <article className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">{t('चालू अवधि', 'Uptime')}</p>
          <p className="mt-2 text-2xl font-bold">{telemetry?.uptime_s == null ? '—' : Math.floor(Number(telemetry.uptime_s) / 3600) + ' h'}</p>
          <p className="mt-1 text-xs text-gray-500">{t('फर्मवेयर', 'Firmware')}: {telemetry?.firmware || device.firmware_version || '—'}</p>
        </article>
        <article className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">{t('यन्त्र त्रुटि', 'Device errors')}</p>
          <p className="mt-2 text-2xl font-bold">{telemetry?.sensor_errors ?? '—'} <span className="text-xs font-normal text-gray-500">{t('सेन्सर', 'sensor')}</span></p>
          <p className="mt-1 text-xs text-gray-500">HTTP: {telemetry?.http_failures ?? '—'} · Wi-Fi {t('पुनःजडान', 'reconnects')}: {telemetry?.wifi_reconnects ?? '—'}</p>
        </article>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {sensors.map((s) => {
          const hasValue = s.last_value !== null && s.last_value !== undefined && Number.isFinite(Number(s.last_value));
          const value = hasValue ? Number(s.last_value) : null;
          const inRange = hasValue && (s.min_valid == null || value >= Number(s.min_valid)) && (s.max_valid == null || value <= Number(s.max_valid));
          const age = s.age_seconds == null ? null : Number(s.age_seconds);
          const offline = device.live_status === 'offline' || device.live_status === 'disabled' || (age != null && age > 900);
          const stale = age != null && age > 180 && !offline;
          const state = age == null ? t('डाटा छैन', 'No reading') : offline ? t('अफलाइन', 'Offline') : stale ? t('पुरानो डाटा', 'Stale') : t('लाइभ', 'Live');
          const stateClass = age == null || offline ? 'bg-slate-100 text-slate-700' : stale ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
          return (
            <article key={s.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{s.name}</h3>
                <span className={'rounded-full px-2 py-1 text-xs ' + stateClass}>{state}</span>
              </div>
              <p className="mt-3 text-3xl font-bold text-gov-blue">{hasValue ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'} <span className="text-base font-medium">{s.unit || ''}</span></p>
              <p className="mt-2 text-xs text-gray-500">{s.last_reading_at ? t('अन्तिम प्राप्त', 'Last received') + ': ' + new Date(s.last_reading_at).toLocaleString() : t('अहिलेसम्म डाटा आएको छैन', 'No reading received yet')}</p>
              {(s.min_valid != null || s.max_valid != null) && <p className={'mt-2 text-xs ' + (inRange ? 'text-emerald-700' : hasValue ? 'text-amber-700' : 'text-gray-500')}>{t('दर्ता गरिएको दायरा', 'Configured range')}: {s.min_valid ?? '−∞'}–{s.max_valid ?? '+∞'} {inRange ? '· ' + t('दायराभित्र', 'within range') : hasValue ? '· ' + t('दायराबाहिर', 'out of range') : ''}</p>}
            </article>
          );
        })}
        {!sensors.length && <p className="col-span-full p-5 text-center bg-white rounded-lg text-gray-600">{t('यस यन्त्रमा सेन्सर दर्ता छैन', 'No sensors are registered for this device')}</p>}
      </section>

      {sensors.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-lg font-semibold text-gov-blue">{t('सेन्सर इतिहास', 'Sensor history')}</h3>
          <HistoryChart sensors={sensors} parameters={[]} t={t} live />
        </section>
      )}

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

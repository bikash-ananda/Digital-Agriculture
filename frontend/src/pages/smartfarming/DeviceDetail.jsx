import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../context/useAuth';
import FormField, { inputCls } from '../../components/common/FormField';
import StatusBadge from '../../components/common/StatusBadge';
import { errMsgs } from '../../utils/errors';
import HistoryChart from '../../components/greenhouse/HistoryChart';

const emptySensor = { sensor_type: 'temperature', name: '', channel_key: '', unit: '', min_valid: '', max_valid: '' };
const emptyAct = { actuator_type: 'irrigation', name: '', relay_channel: '', max_runtime_seconds: '900' };

export default function DeviceDetail() {
  const { i18n } = useTranslation();
  const t = (ne, en) => (i18n.language === 'en' ? en : ne);
  const { id } = useParams();
  const { can, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [sensor, setSensor] = useState(emptySensor);
  const [act, setAct] = useState(emptyAct);
  const [editingActuator, setEditingActuator] = useState(null);
  const [errs, setErrs] = useState([]);
  const [newKey, setNewKey] = useState(null);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(false);
  const [rotateError, setRotateError] = useState('');
  const [rotateNeedsLogin, setRotateNeedsLogin] = useState(false);
  const [keyCopyMessage, setKeyCopyMessage] = useState('');

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
    const initial = (!showRotateConfirm && !newKey) ? window.setTimeout(load, 0) : null;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !showRotateConfirm && !newKey) load();
    }, 15000);
    return () => {
      if (initial !== null) window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load, showRotateConfirm, newKey]);

  const post = async (path, body, reset) => {
    setErrs([]);
    try { await api.post(`/smart/devices/${id}/${path}`, body); reset(); load(); }
    catch (err) { setErrs(errMsgs(err)); }
  };
  const saveActuator = async (event) => {
    event.preventDefault();
    if (!editingActuator) return;
    setErrs([]);
    const body = {
      actuator_type: editingActuator.actuator_type,
      name: editingActuator.name,
      relay_channel: editingActuator.relay_channel ? Number(editingActuator.relay_channel) : null,
      max_runtime_seconds: Number(editingActuator.max_runtime_seconds)
    };
    try {
      await api.put(`/smart/devices/${id}/actuators/${editingActuator.id}`, body);
      setEditingActuator(null);
      await load();
    } catch (err) { setErrs(errMsgs(err)); }
  };
  const rotate = async () => {
    setRotatingKey(true);
    setRotateError('');
    setRotateNeedsLogin(false);
    try {
      // Preserve this page on a 401 so the user can see the sign-in guidance in the dialog.
      const r = await api.post(`/smart/devices/${id}/rotate-key`, undefined, {
        timeout: 30000,
        preserveAuthOnUnauthorized: true
      });
      if (!r.data?.api_key) {
        setRotateError(t('सर्भरले नयाँ कुञ्जी फर्काएन। कुञ्जी बदलिएको हुन सक्छ। पुनः प्रयास गर्दा पछिल्लो देखिएको कुञ्जी मात्र प्रयोग गर्नुहोस्।', 'The server did not return the new key. Rotation may have completed. If you retry, use only the latest key shown.'));
        return;
      }
      setNewKey(r.data.api_key);
      setKeyCopyMessage('');
      setShowRotateConfirm(false);
    } catch (err) {
      const status = err.response?.status;
      const serverMessage = err.response?.data?.message;
      if (status === 401) {
        setRotateNeedsLogin(true);
        setRotateError(t('तपाईंको लगइन सत्र सकिएको छ। फेरि लगइन गरेर यो प्रक्रिया दोहोर्‍याउनुहोस्।', 'Your sign-in session expired. Sign in again, then repeat this action.'));
      }
      else if (status === 403) setRotateError(t('तपाईंको खातालाई यन्त्र कुञ्जी बदल्ने अनुमति छैन। साइट प्रशासकलाई devices.update अनुमति दिन भन्नुहोस्।', 'Your account cannot rotate device keys. Ask a site administrator for the devices.update permission.'));
      else if (status === 404) setRotateError(t('यो यन्त्र भेटिएन। पृष्ठ ताजा गरेर फेरि प्रयास गर्नुहोस्।', 'This device could not be found. Refresh the page and try again.'));
      else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') setRotateError(t('सर्भरको जवाफ आउन ढिलो भयो। कुञ्जी बदलिएको हुन सक्छ। फेरि प्रयास गर्दा पछिल्लो देखिएको कुञ्जी मात्र ESP32 मा राख्नुहोस्।', 'The server response timed out. Rotation may have completed. If you retry, save only the latest key returned to the ESP32.'));
      else if (!err.response) setRotateError(t('सर्भरमा जडान हुन सकेन। इन्टरनेट जाँच गरेर फेरि प्रयास गर्नुहोस्।', 'Could not reach the server. Check your connection and try again.'));
      else setRotateError(serverMessage || t('कुञ्जी बदल्न सकिएन। केही समयपछि फेरि प्रयास गर्नुहोस्।', 'The key could not be rotated. Please try again.'));
    } finally {
      setRotatingKey(false);
    }
  };
  const copyNewKey = async () => {
    try {
      await navigator.clipboard.writeText(newKey);
      setKeyCopyMessage(t('कुञ्जी प्रतिलिपि भयो। यसलाई ESP32 secrets.h मा सुरक्षित गर्नुहोस्।', 'Key copied. Save it in the ESP32 secrets.h file.'));
    } catch {
      setKeyCopyMessage(t('स्वचालित प्रतिलिपि हुन सकेन। कुञ्जी चयन गरेर प्रतिलिपि गर्नुहोस्।', 'Could not copy automatically. Select the key and copy it manually.'));
    }
  };
  const signInAgain = async () => {
    try { await logout(); } catch { /* The expired session may reject logout; local state still clears. */ }
    navigate('/login', { replace: true });
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
          {can('devices.update') && <button type="button" onClick={() => { setRotateError(''); setRotateNeedsLogin(false); setShowRotateConfirm(true); }} className="border border-gov-red text-gov-red px-3 py-2 rounded text-sm min-h-10">{t('API कुञ्जी बदल्नुहोस्', 'Rotate API Key')}</button>}
        </div>
      </div>

      {error && data && <div role="status" className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded text-sm">{t('सर्भरबाट नयाँ डाटा आउन सकेन। देखाइएको मान अन्तिम प्राप्त डाटा हो।', 'Could not refresh from the server. Values shown are the last received readings.')} {error}</div>}

      {(showRotateConfirm || newKey) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="device-key-dialog-title" className="w-full max-w-xl space-y-4 rounded-xl bg-white p-6 shadow-xl">
            {newKey ? (
              <>
                <h3 id="device-key-dialog-title" className="text-xl font-bold text-gov-blue">{t('नयाँ API कुञ्जी', 'New API key')}</h3>
                <div role="alert" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  {t('यो कुञ्जी एक पटक मात्र देखिन्छ। पुरानो कुञ्जी तुरुन्तै निष्क्रिय भयो। बन्द गर्नुअघि नयाँ कुञ्जी ESP32 secrets.h मा राखेर फर्मवेयर अपलोड गर्नुहोस्।', 'This key is shown only once. The old key stopped working immediately. Save this key in the ESP32 secrets.h file and upload the firmware before closing this dialog.')}
                </div>
                <code className="block max-h-40 overflow-auto break-all rounded border bg-slate-50 p-3 text-sm select-all">{newKey}</code>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={copyNewKey} className="min-h-10 rounded bg-gov-blue px-4 py-2 text-sm font-medium text-white">{t('कुञ्जी प्रतिलिपि गर्नुहोस्', 'Copy key')}</button>
                  <button type="button" onClick={() => setNewKey(null)} className="min-h-10 rounded border px-4 py-2 text-sm">{t('मैले सुरक्षित गरेँ', 'I saved it')}</button>
                </div>
                {keyCopyMessage && <p role="status" aria-live="polite" className="text-sm text-emerald-800">{keyCopyMessage}</p>}
              </>
            ) : (
              <>
                <h3 id="device-key-dialog-title" className="text-xl font-bold text-gov-blue">{t('API कुञ्जी बदल्ने?', 'Rotate this device key?')}</h3>
                <p className="text-sm text-slate-700">{t('यसले हालको कुञ्जी तुरुन्तै बन्द गर्छ। नयाँ कुञ्जी एक पटक मात्र देखिनेछ, त्यसैले अहिले ESP32 secrets.h अद्यावधिक गर्न तयार हुनुहोस्।', 'This immediately disables the current key. The replacement is shown only once, so be ready to update the ESP32 secrets.h file now.')}</p>
                {rotateError && <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{rotateError}</div>}
                {rotateNeedsLogin && <button type="button" onClick={signInAgain} className="inline-block text-sm font-medium text-gov-blue underline">{t('फेरि लगइन गर्नुहोस्', 'Sign in again')}</button>}
                {rotatingKey && <p role="status" aria-live="polite" className="text-sm text-slate-600">{t('सर्भरसँग जडान गर्दैछ… यो संवाद खुला राख्नुहोस्।', 'Contacting the server… Keep this dialog open.')}</p>}
                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" disabled={rotatingKey} onClick={() => { setShowRotateConfirm(false); setRotateError(''); }} className="min-h-10 rounded border px-4 py-2 text-sm disabled:opacity-50">{t('रद्द गर्नुहोस्', 'Cancel')}</button>
                  <button type="button" disabled={rotatingKey} onClick={rotate} className="min-h-10 rounded bg-gov-red px-4 py-2 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60">{rotatingKey ? t('बदल्दै…', 'Rotating…') : t('कुञ्जी बदल्नुहोस्', 'Rotate key')}</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

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
      <section>
        <h3 className="text-lg font-semibold text-gov-blue mb-2">{t('सेन्सरहरू', 'Sensors')} ({sensors.length})</h3>
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left"><tr><th className="p-3">{t('नाम', 'Name')}</th><th className="p-3">{t('प्रकार', 'Type')}</th><th className="p-3">{t('डाटा कुञ्जी', 'Data key')}</th><th className="p-3">{t('इकाई', 'Unit')}</th>
              <th className="p-3">{t('मान्य दायरा', 'Valid range')}</th><th className="p-3">{t('अन्तिम मान', 'Last value')}</th><th className="p-3">{t('स्थिति', 'Status')}</th></tr></thead>
            <tbody>
              {sensors.map((s) => (
                <tr key={s.id} className="border-t"><td className="p-3 font-medium">{s.name}</td><td className="p-3">{s.sensor_type}</td><td className="p-3 font-mono text-xs">{s.channel_key || s.sensor_type}</td><td className="p-3">{s.unit || '-'}</td>
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
            <FormField label={t('डाटा कुञ्जी (वैकल्पिक)', 'Data key (optional)')}><input pattern="[a-z0-9_]{2,30}" value={sensor.channel_key} onChange={(e) => setSensor({ ...sensor, channel_key: e.target.value })} placeholder="soil_moisture_raw" className={inputCls} /></FormField>
            <FormField label={t('इकाई', 'Unit')}><input value={sensor.unit} onChange={(e) => setSensor({ ...sensor, unit: e.target.value })} className={inputCls} /></FormField>
            <FormField label="Min"><input type="number" step="any" value={sensor.min_valid} onChange={(e) => setSensor({ ...sensor, min_valid: e.target.value })} className={inputCls} /></FormField>
            <FormField label="Max"><input type="number" step="any" value={sensor.max_valid} onChange={(e) => setSensor({ ...sensor, max_valid: e.target.value })} className={inputCls} /></FormField>
            <div className="sm:col-span-5"><p className="mb-2 text-xs text-gray-500">{t('माटोको प्रतिशत वास्तविक probe बाट सुख्खा र भिजेको अवस्थामा क्यालिब्रेट गर्नुपर्छ। कच्चा ADC हेर्न प्रकार Other, नाम Soil probe raw, कुञ्जी soil_moisture_raw, इकाई ADC राख्नुहोस्।', 'Soil moisture percentage needs dry and wet calibration from the installed probe. To display its raw value, use type Other, name Soil probe raw, key soil_moisture_raw, and unit ADC.')}</p><button className="bg-agri-green text-white px-4 py-2 rounded text-sm">+ {t('सेन्सर थप्नुहोस्', 'Add Sensor')}</button></div>
          </form>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gov-blue mb-2">{t('एक्चुएटरहरू', 'Actuators')} ({actuators.length})</h3>
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left"><tr><th className="p-3">{t('नाम', 'Name')}</th><th className="p-3">{t('प्रकार', 'Type')}</th><th className="p-3">{t('रिले च्यानल', 'Relay channel')}</th><th className="p-3">{t('मोड', 'Mode')}</th>
              <th className="p-3">{t('अवस्था', 'State')}</th><th className="p-3">{t('अधिकतम समय (से.)', 'Max runtime (s)')}</th><th className="p-3">{t('स्थिति', 'Status')}</th>{can('devices.update') && <th className="p-3">{t('कार्य', 'Action')}</th>}</tr></thead>
            <tbody>
              {actuators.map((a) => (
                <tr key={a.id} className="border-t"><td className="p-3 font-medium">{a.name}</td><td className="p-3">{a.actuator_type}</td><td className="p-3">{a.relay_channel ?? t('नतोकिएको', 'Unassigned')}</td><td className="p-3">{a.control_mode}</td>
                  <td className="p-3"><StatusBadge value={a.current_state} /></td><td className="p-3">{a.max_runtime_seconds}</td><td className="p-3"><StatusBadge value={a.status} /></td>
                  {can('devices.update') && <td className="p-3"><button type="button" onClick={() => setEditingActuator({ id: a.id, actuator_type: a.actuator_type, name: a.name, relay_channel: a.relay_channel == null ? '' : String(a.relay_channel), max_runtime_seconds: String(a.max_runtime_seconds || 900) })} className="text-sm text-gov-blue underline">{t('Засвар', 'Configure')}</button></td>}</tr>
              ))}
            </tbody>
          </table>
        </div>
        {editingActuator && can('devices.update') && (
          <form onSubmit={saveActuator} className="bg-white rounded shadow p-4 mt-3 grid sm:grid-cols-2 xl:grid-cols-5 gap-3 items-end">
            <div className="sm:col-span-2 xl:col-span-5 flex items-center justify-between"><h4 className="font-semibold">{t('एक्चुएटर रिले म्यापिङ', 'Configure actuator relay mapping')}</h4><button type="button" onClick={() => setEditingActuator(null)} className="text-sm underline">{t('रद्द गर्नुहोस्', 'Cancel')}</button></div>
            <FormField label={t('प्रकार', 'Type')}><select value={editingActuator.actuator_type} onChange={(e) => setEditingActuator({ ...editingActuator, actuator_type: e.target.value })} className={inputCls}>{['irrigation', 'pump', 'misting', 'fan', 'light', 'other'].map((x) => <option key={x}>{x}</option>)}</select></FormField>
            <FormField label={`${t('नाम', 'Name')} *`}><input required value={editingActuator.name} onChange={(e) => setEditingActuator({ ...editingActuator, name: e.target.value })} className={inputCls} /></FormField>
            <FormField label={t('GPIO रिले च्यानल', 'GPIO relay channel')}><select value={editingActuator.relay_channel} onChange={(e) => setEditingActuator({ ...editingActuator, relay_channel: e.target.value })} className={inputCls}><option value="">{t('नतोकिएको', 'Unassigned')}</option>{[1, 2].map((channel) => { const occupied = actuators.some((other) => other.id !== editingActuator.id && other.status === 'active' && Number(other.relay_channel) === channel); const purpose = channel === 1 ? t('सिँचाइ पम्प', 'irrigation pump') : t('स्प्रिंकलर पम्प', 'sprinkler pump'); return <option key={channel} value={channel} disabled={occupied}>{channel} · GPIO{channel === 1 ? 26 : 27} · {purpose}{occupied ? ` (${t('पहिले नै प्रयोगमा', 'already assigned')})` : ''}</option>; })}</select></FormField>
            <FormField label={t('अधिकतम समय (से.)', 'Max runtime (s)')}><input type="number" min="1" max="86400" required value={editingActuator.max_runtime_seconds} onChange={(e) => setEditingActuator({ ...editingActuator, max_runtime_seconds: e.target.value })} className={inputCls} /></FormField>
            <div><button className="bg-agri-green text-white px-4 py-2 rounded text-sm">{t('म्यापिङ सुरक्षित गर्नुहोस्', 'Save mapping')}</button></div>
          </form>
        )}
        {can('devices.create') && (
          <form onSubmit={(e) => { e.preventDefault(); post('actuators', { ...act, relay_channel: act.relay_channel ? Number(act.relay_channel) : null, max_runtime_seconds: Number(act.max_runtime_seconds) }, () => setAct(emptyAct)); }} className="bg-white rounded shadow p-4 mt-3 grid sm:grid-cols-2 xl:grid-cols-4 gap-3 items-end">
            <FormField label={t('प्रकार', 'Type')}>
              <select value={act.actuator_type} onChange={(e) => setAct({ ...act, actuator_type: e.target.value })} className={inputCls}>
                {['irrigation', 'pump', 'misting', 'fan', 'light', 'other'].map((x) => <option key={x}>{x}</option>)}
              </select>
            </FormField>
            <FormField label={`${t('नाम', 'Name')} *`}><input required value={act.name} onChange={(e) => setAct({ ...act, name: e.target.value })} className={inputCls} /></FormField>
            <FormField label={t('GPIO रिले च्यानल', 'GPIO relay channel')}><select value={act.relay_channel} onChange={(e) => setAct({ ...act, relay_channel: e.target.value })} className={inputCls}><option value="">{t('नतोकिएको', 'Unassigned')}</option>{[1, 2].map((channel) => { const occupied = actuators.some((other) => other.status === 'active' && Number(other.relay_channel) === channel); const purpose = channel === 1 ? t('सिँचाइ पम्प', 'irrigation pump') : t('स्प्रिंकलर पम्प', 'sprinkler pump'); return <option key={channel} value={channel} disabled={occupied}>{channel} · GPIO{channel === 1 ? 26 : 27} · {purpose}{occupied ? ` (${t('पहिले नै प्रयोगमा', 'already assigned')})` : ''}</option>; })}</select></FormField>
            <FormField label={t('अधिकतम समय (से.)', 'Max runtime (s)')}><input type="number" min="1" max="86400" required value={act.max_runtime_seconds} onChange={(e) => setAct({ ...act, max_runtime_seconds: e.target.value })} className={inputCls} /></FormField>
            <div className="xl:col-span-4"><button className="bg-agri-green text-white px-4 py-2 rounded text-sm">+ {t('एक्चुएटर थप्नुहोस्', 'Add Actuator')}</button></div>
          </form>
        )}
      </section>
    </div>
  );
}

import { useEffect, useState } from 'react';
import api from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import { errMsgs } from '../../utils/errors';

const blank = { method: '', reference_instrument: '', point1_measured: '', point1_reference: '', point2_measured: '', point2_reference: '', notes: '' };

export default function DeviceHealthTab({ units, lang, t, can }) {
  const [health, setHealth] = useState(null);
  const [unitId, setUnitId] = useState('');
  const [sensors, setSensors] = useState([]);
  const [sensorId, setSensorId] = useState('');
  const [form, setForm] = useState(blank);
  const [hist, setHist] = useState([]);
  const [msg, setMsg] = useState(null);

  useEffect(() => { api.get('/research/devices/health').then((r) => setHealth(r.data)).catch(() => setHealth([])); }, []);
  useEffect(() => { if (!unitId && units.length) setUnitId(String(units.find((u) => !u.is_simulated)?.id || units[0].id)); }, [units]);
  useEffect(() => {
    if (!unitId) return;
    api.get(`/research/units/${unitId}/summary`).then((r) => { setSensors(r.data.sensors); setSensorId(r.data.sensors[0] ? String(r.data.sensors[0].id) : ''); }).catch(() => setSensors([]));
  }, [unitId]);
  useEffect(() => { if (sensorId) api.get(`/research/sensors/${sensorId}/calibrations`).then((r) => setHist(r.data)).catch(() => setHist([])); }, [sensorId]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setMsg(null);
    const body = { method: form.method, notes: form.notes || undefined, reference_instrument: form.reference_instrument || undefined, point1_measured: form.point1_measured, point1_reference: form.point1_reference };
    if (form.point2_measured !== '' && form.point2_reference !== '') { body.point2_measured = form.point2_measured; body.point2_reference = form.point2_reference; }
    try {
      const r = await api.post(`/research/sensors/${sensorId}/calibrate`, body);
      setMsg({ ok: true, text: `${t('सुरक्षित भयो', 'Saved')}: offset ${r.data.offset.toFixed(4)}, scale ${r.data.scale.toFixed(4)}. ${r.data.note}` });
      setForm(blank);
      api.get(`/research/sensors/${sensorId}/calibrations`).then((x) => setHist(x.data));
    } catch (err) { setMsg({ ok: false, text: errMsgs(err).join(' · ') }); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <h3 className="font-semibold text-gov-blue p-4 pb-2">{t('यन्त्रको स्वास्थ्य', 'Device health')}</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left"><tr>{[t('यन्त्र', 'Device'), t('ग्रीनहाउस', 'Greenhouse'), t('स्थिति', 'Status'), 'Wi-Fi (dBm)', t('चालू अवधि', 'Uptime'), t('खाली मेमोरी', 'Free heap'), t('रिस्टार्ट (२४घ)', 'Restarts (24h)'), t('सेन्सर त्रुटि', 'Sensor errors'), t('फर्मवेयर', 'Firmware')].map((h, i) => <th key={i} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {health && health.length === 0 && <tr><td colSpan="9" className="p-4 text-center text-gray-500">—</td></tr>}
            {health && health.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="p-3 font-medium">{d.device_code}</td><td className="p-3">{d.unit_name || '—'}</td><td className="p-3"><StatusBadge value={d.live} /></td>
                <td className={`p-3 ${d.rssi !== null && d.rssi < -80 ? 'text-gov-red font-semibold' : ''}`}>{d.rssi ?? '—'}</td>
                <td className="p-3">{d.uptime_s === null ? '—' : `${Math.round(d.uptime_s / 3600)} h`}</td><td className="p-3">{d.free_heap === null ? '—' : `${Math.round(d.free_heap / 1024)} kB`}</td>
                <td className={`p-3 ${d.reboots_24h > 1 ? 'text-gov-red font-semibold' : ''}`}>{d.reboots_24h}</td><td className="p-3">{d.sensor_errors ?? '—'}</td><td className="p-3">{d.firmware_version || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-500 p-3">{t('कमजोर Wi-Fi (−८० भन्दा कम), बारम्बार रिस्टार्ट वा बढ्दो सेन्सर त्रुटिले तथ्याङ्कमा खाडल ल्याउँछ।', 'Weak Wi-Fi (below −80), frequent restarts or rising sensor errors cause gaps in the data.')}</p>
      </div>

      {can('research.manage') && (
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <h3 className="font-semibold text-gov-blue">{t('सेन्सर क्यालिब्रेसन', 'Sensor calibration')}</h3>
          <div className="flex flex-wrap gap-3 text-sm">
            <label>{t('ग्रीनहाउस', 'Greenhouse')}<select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="block mt-1 border rounded p-2 bg-white">{units.map((u) => <option key={u.id} value={u.id}>{u.name_en}</option>)}</select></label>
            <label>{t('सेन्सर', 'Sensor')}<select value={sensorId} onChange={(e) => setSensorId(e.target.value)} className="block mt-1 border rounded p-2 bg-white">{sensors.map((s) => <option key={s.id} value={s.id}>{s.name} (offset {Number(s.calibration_offset).toFixed(2)}, scale {Number(s.calibration_scale).toFixed(3)})</option>)}</select></label>
          </div>
          <p className="text-xs text-gray-600">{t('“मापन” भनेको ड्यासबोर्डले देखाएको मान हो; “सन्दर्भ” भनेको मानक उपकरणले देखाएको सही मान। एक बिन्दुले ऑफसेट मात्र सुधार्छ, दुई बिन्दुले ऑफसेट र स्केल दुवै।', '“Measured” is what the dashboard showed; “reference” is the true value from a trusted instrument. One point corrects the offset only; two points correct offset and scale.')}</p>
          <form onSubmit={submit} className="grid sm:grid-cols-3 gap-3 text-sm">
            <label>{t('विधि', 'Method')} *<input required value={form.method} onChange={set('method')} placeholder="e.g. 2-point, ice bath / room temp" className="mt-1 w-full border rounded p-2" /></label>
            <label>{t('सन्दर्भ उपकरण', 'Reference instrument')}<input value={form.reference_instrument} onChange={set('reference_instrument')} className="mt-1 w-full border rounded p-2" /></label>
            <span />
            <label>{t('बिन्दु १ मापन', 'Point 1 measured')} *<input required type="number" step="any" value={form.point1_measured} onChange={set('point1_measured')} className="mt-1 w-full border rounded p-2" /></label>
            <label>{t('बिन्दु १ सन्दर्भ', 'Point 1 reference')} *<input required type="number" step="any" value={form.point1_reference} onChange={set('point1_reference')} className="mt-1 w-full border rounded p-2" /></label>
            <span />
            <label>{t('बिन्दु २ मापन', 'Point 2 measured')}<input type="number" step="any" value={form.point2_measured} onChange={set('point2_measured')} className="mt-1 w-full border rounded p-2" /></label>
            <label>{t('बिन्दु २ सन्दर्भ', 'Point 2 reference')}<input type="number" step="any" value={form.point2_reference} onChange={set('point2_reference')} className="mt-1 w-full border rounded p-2" /></label>
            <label>{t('टिप्पणी', 'Notes')}<input value={form.notes} onChange={set('notes')} className="mt-1 w-full border rounded p-2" /></label>
            <div className="sm:col-span-3"><button disabled={!sensorId} className="bg-agri-green text-white px-4 py-2 rounded font-semibold disabled:opacity-50">{t('क्यालिब्रेसन सुरक्षित गर्नुहोस्', 'Save calibration')}</button></div>
          </form>
          {msg && <p className={`p-2 rounded text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
          {hist.length > 0 && (
            <table className="w-full text-xs">
              <thead className="bg-gray-100 text-left"><tr><th className="p-2">{t('मिति', 'Date')}</th><th className="p-2">{t('विधि', 'Method')}</th><th className="p-2">offset</th><th className="p-2">scale</th><th className="p-2">{t('प्रयोगकर्ता', 'User')}</th></tr></thead>
              <tbody>{hist.map((h) => <tr key={h.id} className="border-t"><td className="p-2 whitespace-nowrap">{new Date(h.performed_at).toLocaleString()}</td><td className="p-2">{h.method}</td><td className="p-2">{Number(h.offset_before).toFixed(3)} → {Number(h.offset_after).toFixed(3)}</td><td className="p-2">{Number(h.scale_before).toFixed(3)} → {Number(h.scale_after).toFixed(3)}</td><td className="p-2">{h.username}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

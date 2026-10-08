import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import StatusBadge from '../common/StatusBadge';
import DynamicForm from './DynamicForm';
import { DEVICE_FIELDS } from '../../utils/dcFields';
import { lbl } from '../../utils/enumLabels';

export default function DevicesTab({ farmerId, farms, canCreate, lang, t, reload }) {
  const [rows, setRows] = useState(null);
  const [key, setKey] = useState(null);
  const load = () => api.get(`/farmers/${farmerId}/devices`).then((r) => setRows(r.data)).catch(() => setRows([]));
  useEffect(() => { load(); }, [farmerId]);
  const provision = (v) => api.post(`/farmers/farms/${v.farm_id}/devices`, v).then((r) => { setKey(r.data); load(); reload(); return {}; });
  const heads = [t('यन्त्र', 'Device'), t('फार्म', 'Farm'), t('इकाई', 'Unit'), t('स्वामित्व', 'Ownership'), t('सेन्सर', 'Sensors'), t('एक्चुएटर', 'Actuators'), t('अन्तिम सम्पर्क', 'Last seen'), t('स्थिति', 'Status')];
  return (
    <div className="space-y-4">
      {key && (
        <div className="p-4 bg-yellow-50 border border-yellow-300 rounded">
          <p className="font-semibold">{t('यन्त्र API कुञ्जी (एक पटक मात्र देखिन्छ)', 'Device API key (shown only once)')}: {key.device_code}</p>
          <code className="block mt-2 p-2 bg-white border rounded break-all select-all">{key.api_key}</code>
          {key.unit_id && <Link to={`/app/smart-farming/units/${key.unit_id}`} className="inline-block mt-2 text-sm text-gov-blue underline">{t('नियन्त्रण केन्द्र खोल्नुहोस्', 'Open the control center')} →</Link>}
          <button onClick={() => setKey(null)} className="ml-4 text-sm underline">{t('बन्द गर्नुहोस्', 'Dismiss')}</button>
        </div>
      )}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left"><tr>{heads.map((h, i) => <th key={i} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {rows && rows.length === 0 && <tr><td colSpan="8" className="p-4 text-center text-gray-500">{t('यो कृषकको फार्ममा यन्त्र जडान गरिएको छैन', 'No devices installed on this farmer’s farms')}</td></tr>}
            {rows && rows.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="p-3 font-medium"><Link className="text-gov-blue hover:underline" to={`/app/smart-farming/devices/${d.id}`}>{d.device_code}</Link></td>
                <td className="p-3">{d.farm_name}</td>
                <td className="p-3">{d.growing_unit_id ? <Link className="text-gov-blue hover:underline" to={`/app/smart-farming/units/${d.growing_unit_id}`}>{d.unit_name}</Link> : '—'}</td>
                <td className="p-3">{lbl(d.ownership, lang)}</td><td className="p-3">{d.sensor_count}</td><td className="p-3">{d.actuator_count}</td>
                <td className="p-3">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : '—'}</td>
                <td className="p-3"><StatusBadge value={d.live_status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canCreate && farms.length > 0 && (
        <div>
          <h3 className="font-semibold text-gov-blue mb-2">{t('यो कृषकको फार्ममा नयाँ यन्त्र जडान', 'Install a device on this farmer’s farm')}</h3>
          <DynamicForm fields={DEVICE_FIELDS} initial={{ farm_id: farms[0].id }} lookups={{ farms }} onSubmit={provision} submitLabel={t('दर्ता गर्नुहोस्', 'Register device')} lang={lang} t={t} />
        </div>
      )}
    </div>
  );
}

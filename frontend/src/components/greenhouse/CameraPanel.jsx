import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function CameraPanel({ unitId, t }) {
  const [cams, setCams] = useState([]);
  const [camId, setCamId] = useState(null);
  const [snaps, setSnaps] = useState([]);
  const [view, setView] = useState(null);
  const [tick, setTick] = useState(Date.now());
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    api.get(`/smart/units/${unitId}/cameras`).then((r) => { setCams(r.data); if (r.data.length) setCamId(r.data[0].id); }).catch(() => setCams([]));
  }, [unitId]);

  useEffect(() => {
    if (!camId) return;
    setBroken(false); setView(null);
    api.get(`/smart/cameras/${camId}/snapshots`, { params: { limit: 12 } }).then((r) => setSnaps(r.data)).catch(() => setSnaps([]));
  }, [camId, tick]);

  if (!cams.length) return <p className="text-gray-500">{t('कुनै क्यामेरा दर्ता छैन', 'No cameras registered for this unit')}</p>;
  const cam = cams.find((c) => c.id === camId) || cams[0];
  const src = view ? `/api/smart/snapshots/${view}/image` : `/api/smart/cameras/${cam.id}/latest?ts=${tick}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={cam.id} onChange={(e) => setCamId(Number(e.target.value))} className="border rounded p-2 bg-white text-sm">
          {cams.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={() => { setView(null); setTick(Date.now()); }} className="bg-gov-blue text-white px-3 py-2 rounded text-sm">↻ {t('ताजा गर्नुहोस्', 'Refresh')}</button>
        {cam.stream_url && <a href={cam.stream_url} target="_blank" rel="noreferrer" className="text-sm text-gov-blue underline">{t('लाइभ स्ट्रिम खोल्नुहोस्', 'Open live stream')}</a>}
        <span className="text-sm text-gray-500 ml-auto">{t('अन्तिम फोटो', 'Last snapshot')}: {cam.last_snapshot_at ? new Date(cam.last_snapshot_at).toLocaleString() : '—'} · {cam.snapshot_count} {t('फोटो', 'stored')}</span>
      </div>

      <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: 280 }}>
        {broken
          ? <p className="text-gray-300 p-10 text-center">{t('अहिलेसम्म कुनै फोटो छैन', 'No snapshot yet')}</p>
          : <img src={src} alt={cam.name} onError={() => setBroken(true)} className="max-h-[480px] w-auto max-w-full" />}
      </div>

      {snaps.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gov-blue mb-2">{t('हालैका फोटोहरू (टाइम-ल्याप्स)', 'Recent snapshots (time-lapse)')}</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {snaps.map((s) => (
              <button key={s.id} onClick={() => { setView(s.id); setBroken(false); }} className={`shrink-0 rounded overflow-hidden border-2 ${view === s.id ? 'border-agri-green' : 'border-transparent'}`}>
                <img src={`/api/smart/snapshots/${s.id}/image`} alt="" loading="lazy" className="h-20 w-28 object-cover" />
                <span className="block text-[10px] text-gray-500 bg-white">{new Date(s.captured_at).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock3, Wifi, WifiOff } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../../services/api';
import { ageText, fv, meta, ZERO_SENSOR_TILES } from '../../utils/console';

function SensorCard({ tile, lang, t }) {
  const info = meta(tile.type);
  const points = tile.spark || [];
  const previous = points.length > 1 ? Number(points[points.length - 2].v) : null;
  const current = points.length ? Number(points[points.length - 1].v) : null;
  const change = previous === null || current === null ? null : current - previous;
  const hasValue = tile.value !== null && tile.value !== undefined && Number.isFinite(Number(tile.value));
  const status = tile.placeholder ? t('लाइभ पठन छैन', 'No live reading') : !hasValue ? t('पठन छैन', 'No reading') : tile.stale ? t('पुरानो', 'Stale') : t('लाइभ', 'Live');

  return (
    <article className="min-w-0 rounded-2xl border border-white/10 bg-[#0d2118] p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-emerald-100/75">{info.icon} {tile.name || info[lang] || tile.type.replaceAll('_', ' ')}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">{hasValue ? fv(tile.value, info.d) : '—'} <span className="text-base font-medium text-emerald-100/65">{tile.unit || info.unit}</span></p>
        </div>
        {change !== null && <span className={`shrink-0 text-xs font-semibold ${change > 0 ? 'text-emerald-300' : change < 0 ? 'text-rose-300' : 'text-slate-300'}`} aria-label={t('हालको परिवर्तन', 'Recent change')}>
          {change > 0 ? '↗' : change < 0 ? '↘' : '→'} {Math.abs(change).toFixed(info.d)}
        </span>}
      </div>
      <div className="mt-2 h-10" aria-hidden="true">
        {points.length > 1 && <ResponsiveContainer width="100%" height="100%"><LineChart data={points}><Line type="monotone" dataKey="v" stroke={info.color || '#34d399'} strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
        <span className={`inline-flex items-center gap-1.5 ${hasValue && !tile.stale ? 'text-emerald-300' : 'text-amber-200'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>
        <span className="truncate text-emerald-100/55">{ageText(tile.age_s, t)}</span>
      </div>
    </article>
  );
}

export default function SensorOverviewTab({ id, ov, lang, t }) {
  const displayTiles = ov.tiles.length ? ov.tiles : ZERO_SENSOR_TILES;
  const types = useMemo(() => displayTiles.map((tile) => tile.type), [displayTiles]);
  const [selectedType, setSelectedType] = useState('');
  const activeType = types.includes(selectedType) ? selectedType : (types.includes('temperature') ? 'temperature' : types[0] || '');
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const online = ov.devices.filter((device) => device.live === 'online').length;
  const locale = lang === 'ne' ? 'ne-NP' : 'en-GB';

  useEffect(() => {
    if (!activeType) { setPoints([]); setLoading(false); setHistoryError(''); return undefined; }
    setPoints([]);
    setLoading(true);
    setHistoryError('');
    let alive = true;
    let firstLoad = true;
    const load = async () => {
      if (firstLoad) setLoading(true);
      try {
        const response = await api.get(`/console/units/${id}/series`, { params: { hours: 24, types: activeType } });
        if (alive) {
          setPoints(response.data.series?.[activeType] || []);
          setHistoryError('');
        }
      } catch (error) {
        if (alive) setHistoryError(error.response?.data?.message || t('इतिहास लोड हुन सकेन।', 'Could not load sensor history.'));
      } finally {
        if (alive && firstLoad) { firstLoad = false; setLoading(false); }
      }
    };
    load();
    const timer = window.setInterval(load, 45000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [id, activeType, t]);

  const formatTime = (seconds) => new Date(Number(seconds) * 1000).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const sensorMeta = activeType ? meta(activeType) : null;
  const latest = ov.devices.reduce((best, device) => device.age_s !== null && device.age_s !== undefined && device.age_s < best ? device.age_s : best, Infinity);

  return (
    <div className="space-y-5">
      <section aria-label={t('हालका सेन्सर मापन', 'Current sensor readings')}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><h3 className="text-lg font-bold text-white">{t('सेन्सर अवस्था', 'Sensor conditions')}</h3><p className="text-sm text-emerald-100/55">{ov._offlineFallback || !ov.tiles.length ? t('ESP32 बाट प्रत्यक्ष मापनको प्रतीक्षा', 'Waiting for live readings from ESP32') : t('डाटाबेसमा प्राप्त पछिल्लो मापन', 'Latest readings received and stored by the server')}</p></div>
          {ov.unit.is_simulated && <span className="rounded-full border border-violet-300/30 bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-200">SIMULATED</span>}
        </div>
        {!ov.tiles.length && <p className="mb-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">{t('अहिले लाइभ मापन उपलब्ध छैन। ० मानहरू नमुना हुन्; यन्त्र जडान भएपछि वास्तविक मापन देखिनेछ।', 'Live readings are unavailable. Zeroes are placeholders; real measurements will appear when a device connects.')}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{displayTiles.map((tile) => <SensorCard key={tile.type} tile={tile} lang={lang} t={t} />)}</div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(17rem,0.8fr)]">
        <section className="min-w-0 rounded-2xl border border-white/10 bg-[#0d2118] p-4 shadow-lg sm:p-5" aria-label={t('२४ घण्टे सेन्सर प्रवृत्ति', '24-hour sensor trend')}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-bold text-white">{t('२४ घण्टे सेन्सर प्रवृत्ति', '24-hour sensor trend')}</h3><p className="mt-1 text-xs text-emerald-100/55">{t('सर्भरमा सुरक्षित ऐतिहासिक मापन', 'Historical readings stored by the server')}</p></div>
            {types.length > 1 && <label className="flex items-center gap-2 text-xs text-emerald-100/70"><span>{t('सेन्सर', 'Sensor')}</span><select aria-label={t('चार्टका लागि सेन्सर छान्नुहोस्', 'Choose sensor for chart')} value={activeType} onChange={(event) => setSelectedType(event.target.value)} className="min-h-9 max-w-48 rounded-lg border border-white/15 bg-[#07160f] px-2 text-white">{types.map((type) => <option key={type} value={type}>{meta(type)[lang] || type.replaceAll('_', ' ')}</option>)}</select></label>}
          </div>
          {!activeType && <p className="py-14 text-center text-sm text-emerald-100/55">{t('चार्टका लागि सेन्सर दर्ता गरिएको छैन।', 'No sensors are registered for the chart.')}</p>}
          {activeType && loading && !points.length && <p role="status" className="py-14 text-center text-sm text-emerald-100/55">{t('इतिहास लोड हुँदैछ…', 'Loading history…')}</p>}
          {activeType && !loading && historyError && <p role="status" className="py-8 text-center text-sm text-amber-200">{historyError}</p>}
          {activeType && !loading && !historyError && !points.length && <p className="py-14 text-center text-sm text-emerald-100/55">{t('यो अवधिका लागि ऐतिहासिक मापन छैन।', 'No historical readings are available for this period.')}</p>}
          {points.length > 0 && sensorMeta && <div className="mt-4 h-64 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#284237" />
              <XAxis dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={formatTime} tick={{ fill: '#a7c2b1', fontSize: 11 }} minTickGap={28} />
              <YAxis width={48} domain={['auto', 'auto']} tick={{ fill: '#a7c2b1', fontSize: 11 }} />
              <Tooltip labelFormatter={(value) => new Date(Number(value) * 1000).toLocaleString(locale)} formatter={(value) => [`${fv(value, sensorMeta.d)} ${ov.tiles.find((tile) => tile.type === activeType)?.unit || sensorMeta.unit}`, sensorMeta[lang] || activeType]} contentStyle={{ background: '#0d2118', border: '1px solid #355444', borderRadius: 12, color: '#fff' }} />
              <Line type="monotone" dataKey="v" name={sensorMeta[lang] || activeType} stroke={sensorMeta.color || '#34d399'} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls />
            </LineChart></ResponsiveContainer>
          </div>}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0d2118] p-4 shadow-lg sm:p-5" aria-label={t('हालका अलर्ट', 'Recent alerts')}>
          <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-white">{t('हालका अलर्ट', 'Recent alerts')}</h3><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-emerald-100/75">{ov.alerts.length}</span></div>
          {ov.alerts.length ? <ul className="mt-3 space-y-2">{ov.alerts.map((alert) => {
            const critical = alert.severity === 'critical';
            const color = critical ? 'border-rose-400/35 bg-rose-400/10 text-rose-100' : alert.severity === 'warning' ? 'border-amber-300/30 bg-amber-300/10 text-amber-100' : 'border-sky-300/25 bg-sky-300/10 text-sky-100';
            return <li key={alert.id} className={`rounded-xl border p-3 ${color}`}><div className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /><div className="min-w-0"><p className="text-sm leading-snug">{alert.message}</p><p className="mt-1 text-xs opacity-70">{new Date(alert.triggered_at).toLocaleString(locale)} · {alert.severity}</p></div></div></li>;
          })}</ul> : <div className="mt-3 rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-emerald-100/55">{t('खुला अलर्ट छैन।', 'No open alerts.')}</div>}
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#0d2118] p-4 shadow-lg" aria-label={t('यन्त्र स्थिति', 'Device status')}>
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-white">{t('यन्त्र स्थिति', 'Device status')}</h3><p className="text-xs text-emerald-100/55">{t('अन्तिम यन्त्र सम्पर्क', 'Last device contact')}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${online === ov.devices.length && online > 0 ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-300/15 text-amber-100'}`}>{online} / {ov.devices.length} {t('अनलाइन', 'online')}</span></div>
        {ov.devices.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{ov.devices.map((device) => <div key={device.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-[#07160f] p-3"><span className={device.live === 'online' ? 'text-emerald-300' : 'text-amber-200'}>{device.live === 'online' ? <Wifi size={17} aria-hidden="true" /> : <WifiOff size={17} aria-hidden="true" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{device.device_code}</p><p className="text-xs text-emerald-100/55">{device.live} · {ageText(device.age_s, t)}</p></div>{device.firmware_version && <span className="max-w-28 truncate text-xs text-emerald-100/45">{device.firmware_version}</span>}</div>)}</div> : <div className="mt-3 flex items-center gap-2 text-sm text-amber-100/75"><WifiOff size={16} aria-hidden="true" />{ov._offlineFallback ? t('ESP32: हृदयस्पन्दन डाटा उपलब्ध छैन।', 'ESP32: heartbeat data unavailable.') : t('यन्त्र दर्ता गरिएको छैन।', 'No devices are registered for this unit.')}</div>}
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-100/45"><Clock3 size={13} aria-hidden="true" />{t('अन्तिम सम्पर्क', 'Latest contact')}: {Number.isFinite(latest) ? ageText(latest, t) : '—'}</p>
      </section>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../../services/api';
import { SENSOR_LABEL, fmt } from '../../utils/greenhouse';

const RANGES = [{ id: '24h', hours: 24 }, { id: '7d', hours: 168 }];
const COLORS = ['#15803d', '#2563eb', '#d97706', '#9333ea', '#0891b2', '#dc2626', '#4f46e5', '#65a30d'];
const LABELS = {
  temperature: ['Temperature', 'तापक्रम'], humidity: ['Humidity', 'आर्द्रता'], soil_moisture: ['Soil moisture', 'माटोको चिस्यान'],
  soil_temperature: ['Soil temperature', 'माटोको तापक्रम'], ec: ['Electrical conductivity', 'विद्युत चालकता'],
  vpd: ['Vapor pressure deficit', 'वाष्प चाप कमी'], dli: ['Daily light integral', 'दैनिक प्रकाश मात्रा'], light: ['Light intensity', 'प्रकाशको तीव्रता']
};
const labelOf = (type, lang) => LABELS[type]?.[lang === 'en' ? 0 : 1] || SENSOR_LABEL[type]?.[lang] || type.replaceAll('_', ' ');
const dateString = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const dayStart = (value) => new Date(`${value}T00:00:00`).toISOString();
const nextDayStart = (value) => { const date = new Date(`${value}T00:00:00`); date.setDate(date.getDate() + 1); return date.toISOString(); };

export default function SensorComparisonChart({ unitId, sensors, parameters, lang, t }) {
  const groups = useMemo(() => {
    const byType = new Map();
    sensors.filter((sensor) => sensor.status !== 'disabled').forEach((sensor) => {
      const unit = sensor.unit || '';
      const key = `${sensor.sensor_type}|${unit}`;
      if (!byType.has(key)) byType.set(key, { key, sensor_type: sensor.sensor_type, unit, sensors: [] });
      byType.get(key).sensors.push(sensor);
    });
    return [...byType.values()];
  }, [sensors]);
  const today = dateString(new Date());
  const week = new Date(); week.setDate(week.getDate() - 6);
  const [groupKey, setGroupKey] = useState('');
  const [rangeMode, setRangeMode] = useState('24h');
  const [intervalMinutes, setIntervalMinutes] = useState('auto');
  const [draft, setDraft] = useState({ from: dateString(week), to: today });
  const [dates, setDates] = useState({ from: dateString(week), to: today });
  const [customError, setCustomError] = useState('');
  const [selectedByGroup, setSelectedByGroup] = useState({});
  const [history, setHistory] = useState([]);
  const [historyKey, setHistoryKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [refresh, setRefresh] = useState(0);

  const activeKey = groups.some((item) => item.key === groupKey) ? groupKey : (groups[0]?.key || '');
  const group = groups.find((item) => item.key === activeKey);
  const selectedIds = useMemo(() => !group ? [] : (selectedByGroup[group.key] || group.sensors.map((sensor) => sensor.id)).filter((id) => group.sensors.some((sensor) => sensor.id === id)), [group, selectedByGroup]);
  const selected = useMemo(() => group ? group.sensors.filter((sensor) => selectedIds.includes(sensor.id)) : [], [group, selectedIds]);
  const preset = RANGES.find((range) => range.id === rangeMode);
  const hours = preset?.hours || 168;
  const appliedKey = rangeMode === 'custom' ? `${dates.from}|${dates.to}` : '';
  const requestKey = `${activeKey}|${rangeMode}|${appliedKey}|${selectedIds.slice().sort().join(',')}|${refresh}`;
  const visible = useMemo(() => (historyKey === requestKey ? history : []), [historyKey, requestKey, history]);
  const selectionError = group && selected.length === 0 ? t('कम्तीमा एउटा सेन्सर छान्नुहोस्।', 'Select at least one sensor.') : '';
  const exportTooMany = selectedIds.length > 24;

  useEffect(() => {
    if (!group || !selected.length) return undefined;
    let active = true;
    setLoading(true); setError('');
    const params = rangeMode === 'custom' ? { from: dayStart(dates.from), to: nextDayStart(dates.to) } : { hours };
    Promise.allSettled(selected.map((sensor) => api.get(`/smart/sensors/${sensor.id}/history`, { params }).then((res) => ({ sensor, points: res.data.points || [] }))))
      .then((results) => {
        if (!active) return;
        const good = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
        const failed = results.length - good.length;
        setHistory(good); setHistoryKey(requestKey);
        if (!good.length) setError(t('इतिहास डाटा लोड भएन। फेरि प्रयास गर्नुहोस्।', 'Could not load history. Please try again.'));
        else if (failed) setError(`${failed} ${t('सेन्सर अनुरोध असफल भयो। बाँकी डाटा देखाइएको छ।', 'sensor history request(s) failed. Showing available data.')}`);
      }).catch(() => { if (active) setError(t('इतिहास डाटा लोड भएन।', 'Could not load history.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [group, selected, requestKey, hours, rangeMode, dates, t]);

  const applyDates = (event) => {
    event.preventDefault();
    const from = new Date(`${draft.from}T00:00:00`); const to = new Date(`${draft.to}T00:00:00`);
    const days = (to - from) / 86400000;
    if (!draft.from || !draft.to || !Number.isFinite(days) || days < 0) { setCustomError(t('सुरु र अन्तिम मिति जाँच्नुहोस्।', 'Check the start and end dates.')); return; }
    if (days > 29) { setCustomError(t('एक पटकमा बढीमा ३० दिनको डाटा छान्नुहोस्।', 'Choose a range of 30 days or less.')); return; }
    setCustomError(''); setDates({ ...draft }); setRangeMode('custom');
  };

  const downloadReport = async (format) => {
    if (!unitId || !selectedIds.length) return;
    setExporting(true); setExportError('');
    const params = rangeMode === 'custom'
      ? { from: dayStart(dates.from), to: nextDayStart(dates.to) }
      : { hours };
    params.sensor_ids = selectedIds.join(',');
    params.time_zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    if (intervalMinutes !== 'auto') params.interval_minutes = intervalMinutes;
    try {
      const response = await api.get(`/smart/units/${unitId}/report.${format}`, { params, responseType: 'blob' });
      const mime = format === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = new Blob([response.data], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `smart-farming-${unitId}-${rangeMode === 'custom' ? dates.from : rangeMode}.${format}`;
      document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      let message = t('प्रतिवेदन डाउनलोड गर्न सकिएन।', 'Could not download the report.');
      const payload = requestError.response?.data;
      if (payload instanceof Blob) {
        try { message = JSON.parse(await payload.text()).message || message; } catch { /* use translated fallback */ }
      } else if (payload?.message) message = payload.message;
      setExportError(message);
    } finally { setExporting(false); }
  };

  const rows = useMemo(() => {
    const buckets = new Map();
    visible.forEach(({ sensor, points }) => points.forEach((point) => {
      const ts = new Date(point.t).getTime(); if (!Number.isFinite(ts)) return;
      const row = buckets.get(ts) || { ts }; const value = Number(point.avg);
      row[String(sensor.id)] = Number.isFinite(value) ? value : null; buckets.set(ts, row);
    }));
    return [...buckets.values()].sort((a, b) => a.ts - b.ts);
  }, [visible]);
  const summaries = useMemo(() => visible.map(({ sensor, points }) => {
    const valid = points.filter((point) => Number.isFinite(Number(point.avg)));
    const n = valid.reduce((sum, point) => sum + Number(point.n || 0), 0);
    const avg = n ? valid.reduce((sum, point) => sum + Number(point.avg) * Number(point.n || 0), 0) / n : null;
    return { sensor, min: valid.length ? Math.min(...valid.map((point) => Number(point.min))) : null, mean: avg, max: valid.length ? Math.max(...valid.map((point) => Number(point.max))) : null, samples: n };
  }), [visible]);
  const target = parameters.find((parameter) => parameter.key === group?.sensor_type)?.target;
  const span = rangeMode === 'custom' ? Math.max(1, (new Date(nextDayStart(dates.to)) - new Date(dayStart(dates.from))) / 3600000) : hours;
  const tick = (value) => span <= 48 ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const decimals = group?.sensor_type === 'ec' ? 3 : group?.sensor_type === 'light' ? 0 : 2;
  const period = rangeMode === 'custom' ? `${dates.from} – ${dates.to}` : rangeMode;

  if (!groups.length) return <div className="rounded-xl bg-white p-5 text-sm text-gray-600 shadow-sm">{t('चार्टका लागि सेन्सर डाटा छैन।', 'No sensor data is available for charts yet.')}</div>;
  return <section className="space-y-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 md:p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start"><div className="flex-1"><h3 className="text-lg font-bold text-gov-blue">{t('सेन्सर समय शृङ्खला', 'Sensor time series')}</h3><p className="mt-1 text-sm text-gray-600">{t('औसत मापन समयसँगै; हरियो क्षेत्र बालीको लक्ष्य दायरा हो।', 'Average readings over time; the green band shows the configured target range.')}</p></div><label className="sf-no-print flex min-h-11 items-center gap-2 text-sm"><span>{t('मापन', 'Measurement')}</span><select value={activeKey} onChange={(e) => setGroupKey(e.target.value)} aria-label={t('मापन छान्नुहोस्', 'Choose measurement')} className="min-h-11 min-w-0 rounded-lg border bg-white px-3">{groups.map((item) => <option key={item.key} value={item.key}>{labelOf(item.sensor_type, lang)}{item.unit ? ` (${item.unit})` : ''}</option>)}</select></label></div>
    <div className="sf-no-print flex flex-wrap items-center gap-2">{RANGES.map((range) => <button type="button" key={range.id} onClick={() => { setRangeMode(range.id); setCustomError(''); }} aria-pressed={rangeMode === range.id} className={`min-h-11 rounded-lg border px-4 text-sm font-semibold ${rangeMode === range.id ? 'border-agri-green bg-agri-green text-white' : 'border-gray-300 bg-white text-gray-700'}`}>{range.id}</button>)}<button type="button" onClick={() => setRangeMode('custom')} aria-pressed={rangeMode === 'custom'} className={`min-h-11 rounded-lg border px-4 text-sm font-semibold ${rangeMode === 'custom' ? 'border-agri-green bg-agri-green text-white' : 'border-gray-300 bg-white text-gray-700'}`}>{t('आफ्नो मिति', 'Custom')}</button><label className="flex min-h-11 items-center gap-2 text-sm"><span>{t('XLSX अन्तराल', 'XLSX interval')}</span><select value={intervalMinutes} onChange={(event) => setIntervalMinutes(event.target.value)} className="min-h-11 rounded-lg border border-gray-300 bg-white px-2"><option value="auto">{t('स्वतः', 'Auto')}</option><option value="15">15 min</option><option value="60">1 h</option><option value="240">4 h</option></select></label><button type="button" onClick={() => setRefresh((v) => v + 1)} className="ml-auto min-h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold">↻ {t('ताजा', 'Refresh')}</button><button type="button" onClick={() => downloadReport('csv')} disabled={exporting || !selectedIds.length || exportTooMany} className="min-h-11 rounded-lg border border-emerald-800 px-4 text-sm font-semibold text-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">{t('CSV कच्चा डाटा', 'Raw CSV')}</button><button type="button" onClick={() => downloadReport('xlsx')} disabled={exporting || !selectedIds.length || exportTooMany} className="min-h-11 rounded-lg bg-emerald-800 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{exporting ? t('प्रतिवेदन बनाउँदै…', 'Preparing report…') : `⇩ ${t('XLSX डाउनलोड', 'Download XLSX')}`}</button></div>
    {exportTooMany && <p role="status" className="text-sm text-amber-800">{t('प्रतिवेदनका लागि बढीमा २४ सेन्सर छान्नुहोस्।', 'Select no more than 24 sensors for an export.')}</p>}
    {exportError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{exportError}</p>}
    {rangeMode === 'custom' && <form onSubmit={applyDates} className="sf-no-print flex flex-col gap-3 rounded-lg bg-gray-50 p-3 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-medium">{t('सुरु मिति', 'From')}<input type="date" required max={today} value={draft.from} onChange={(e) => setDraft((v) => ({ ...v, from: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3" /></label><label className="flex-1 text-sm font-medium">{t('अन्तिम मिति', 'To')}<input type="date" required min={draft.from} max={today} value={draft.to} onChange={(e) => setDraft((v) => ({ ...v, to: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3" /></label><button className="min-h-11 rounded-lg bg-terrace-800 px-5 text-sm font-semibold text-white">{t('अवधि लागू गर्नुहोस्', 'Apply range')}</button>{customError && <p role="alert" className="basis-full text-sm text-red-700">{customError}</p>}</form>}
    {group && group.sensors.length > 1 && <fieldset className="sf-no-print flex flex-wrap gap-x-4 gap-y-2 text-sm"><legend className="mb-1 text-xs font-semibold text-gray-600">{t('तुलनाका सेन्सर', 'Sensors to compare')}</legend>{group.sensors.map((sensor, i) => <label key={sensor.id} className="inline-flex min-h-10 items-center gap-2"><input type="checkbox" checked={selectedIds.includes(sensor.id)} onChange={(e) => setSelectedByGroup((prev) => { const cur = prev[group.key] || group.sensors.map((s) => s.id); return { ...prev, [group.key]: e.target.checked ? [...cur, sensor.id] : cur.filter((id) => id !== sensor.id) }; })} /><span style={{ color: COLORS[i % COLORS.length] }}>{sensor.name}</span></label>)}</fieldset>}
    {selectionError && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{selectionError}</p>}{loading && <p role="status" aria-live="polite" className="inline-flex items-center gap-2 py-4 text-sm text-gray-600"><span className="h-4 w-4 animate-spin rounded-full border-2 border-agri-green border-r-transparent" />{t('इतिहास डाटा लोड हुँदैछ…', 'Loading chart data…')}</p>}{!loading && historyKey === requestKey && error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}{!loading && historyKey === requestKey && !error && !rows.length && <p className="rounded-lg bg-gray-50 py-10 text-center text-sm text-gray-600">{t('यस अवधिमा मापन प्राप्त भएको छैन।', 'No readings were received in this period.')}</p>}
    {rows.length > 0 && <><div className="sf-comparison-chart" role="img" aria-label={`${labelOf(group.sensor_type, lang)} ${t('समय शृङ्खला चार्ट', 'time-series chart')}`} style={{ width: '100%', height: 340 }}><ResponsiveContainer><LineChart data={rows} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={tick} tick={{ fontSize: 11 }} minTickGap={24} /><YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={58} /><Tooltip labelFormatter={(value) => new Date(value).toLocaleString(lang === 'en' ? 'en-GB' : 'ne-NP')} formatter={(value, name) => [`${fmt(value, decimals)}${group.unit ? ` ${group.unit}` : ''}`, name]} /><Legend />{target && <ReferenceArea y1={target.opt_min} y2={target.opt_max} fill="#86efac" fillOpacity={0.2} />}{selected.map((sensor) => { const i = group.sensors.findIndex((s) => s.id === sensor.id); return <Line key={sensor.id} type="monotone" dataKey={String(sensor.id)} name={sensor.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls={false} />; })}</LineChart></ResponsiveContainer></div><div className="flex flex-wrap justify-between gap-2 text-xs text-gray-600"><span>{target ? `🟩 ${t('लक्षित दायरा', 'Target range')}: ${target.opt_min}–${target.opt_max} ${group.unit}` : t('यस मापनका लागि लक्ष्य सीमा कन्फिगर गरिएको छैन।', 'No thresholds are configured for this measurement.')}</span><span>{t('टिपमा समय स्थानीय समयअनुसार देखिन्छ।', 'Chart tooltips show local timestamps.')}</span></div>
      <div><h4 className="mb-2 font-semibold text-gov-blue">{t('अवधिको सारांश', 'Period summary')} · {period}</h4><div className="sf-comparison-chart" style={{ width: '100%', height: Math.max(220, Math.min(360, summaries.length * 48 + 70)) }}><ResponsiveContainer><BarChart data={summaries.map((item) => ({ name: item.sensor.name, min: item.min, mean: item.mean, max: item.max }))} margin={{ top: 6, right: 18, left: 4, bottom: 18 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={summaries.length > 3 ? -15 : 0} textAnchor={summaries.length > 3 ? 'end' : 'middle'} /><YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={52} /><Tooltip formatter={(v, name) => [`${fmt(v, decimals)}${group.unit ? ` ${group.unit}` : ''}`, name]} /><Legend /><Bar dataKey="min" name={t('न्यूनतम', 'Minimum')} fill="#60a5fa" /><Bar dataKey="mean" name={t('भारित औसत', 'Weighted mean')} fill="#15803d" /><Bar dataKey="max" name={t('अधिकतम', 'Maximum')} fill="#f97316" /></BarChart></ResponsiveContainer></div></div>
      <div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr className="bg-gray-50 text-left"><th className="border p-2">{t('सेन्सर', 'Sensor')}</th><th className="border p-2">{t('न्यूनतम', 'Min')}</th><th className="border p-2">{t('भारित औसत', 'Weighted mean')}</th><th className="border p-2">{t('अधिकतम', 'Max')}</th><th className="border p-2">{t('नमूना', 'Samples')}</th></tr></thead><tbody>{summaries.map((s) => <tr key={s.sensor.id}><td className="border p-2 font-medium">{s.sensor.name}</td><td className="border p-2">{fmt(s.min, decimals)} {group.unit}</td><td className="border p-2">{fmt(s.mean, decimals)} {group.unit}</td><td className="border p-2">{fmt(s.max, decimals)} {group.unit}</td><td className="border p-2">{s.samples.toLocaleString()}</td></tr>)}</tbody></table></div></>}
  </section>;
}

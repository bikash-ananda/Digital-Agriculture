import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import api from '../../services/api';
import { SENSOR_LABEL, fmt } from '../../utils/greenhouse';

const RANGES = [[6, '6h'], [24, '24h'], [72, '3d'], [168, '7d'], [720, '30d']];
const COLORS = ['#15803d', '#2563eb', '#d97706', '#9333ea', '#0891b2', '#dc2626', '#4f46e5', '#65a30d'];
const PARAM_LABEL = {
  temperature: { en: 'Temperature', ne: 'तापक्रम' },
  humidity: { en: 'Humidity', ne: 'आर्द्रता' },
  soil_moisture: { en: 'Soil moisture', ne: 'माटोको चिस्यान' },
  soil_temperature: { en: 'Soil temperature', ne: 'माटोको तापक्रम' },
  ec: { en: 'Electrical conductivity', ne: 'विद्युत चालकता' },
  vpd: { en: 'Vapor pressure deficit', ne: 'वाष्प चाप कमी' },
  dli: { en: 'Daily light integral', ne: 'दैनिक प्रकाश मात्रा' }
};
const metricLabel = (type, lang) => PARAM_LABEL[type]?.[lang] || SENSOR_LABEL[type]?.[lang] || type.replaceAll('_', ' ');

export default function SensorComparisonChart({ sensors, parameters, lang, t }) {
  const groups = useMemo(() => {
    const map = new Map();
    sensors.filter((sensor) => sensor.status !== 'disabled').forEach((sensor) => {
      const unit = sensor.unit || '';
      const key = sensor.sensor_type + '|' + unit;
      if (!map.has(key)) map.set(key, { key, sensor_type: sensor.sensor_type, unit, sensors: [] });
      map.get(key).sensors.push(sensor);
    });
    return [...map.values()];
  }, [sensors]);
  const [groupKey, setGroupKey] = useState('');
  const [hours, setHours] = useState(24);
  const [selectedByGroup, setSelectedByGroup] = useState({});
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!groups.some((item) => item.key === groupKey)) setGroupKey(groups[0]?.key || '');
  }, [groups, groupKey]);

  const group = groups.find((item) => item.key === groupKey);
  const selectedIds = useMemo(() => {
    if (!group) return [];
    return (selectedByGroup[group.key] || group.sensors.map((sensor) => sensor.id))
      .filter((id) => group.sensors.some((sensor) => sensor.id === id));
  }, [group, selectedByGroup]);
  const selectedSensors = useMemo(() => group
    ? group.sensors.filter((sensor) => selectedIds.includes(sensor.id))
    : [], [group, selectedIds]);

  const queryRef = useRef({ group, selectedSensors });
  queryRef.current = { group, selectedSensors };
  const requestKey = groupKey + '|' + hours + '|' + selectedIds.slice().sort().join(',') + '|' + refreshKey;

  useEffect(() => {
    const current = queryRef.current;
    if (!current.group || !current.selectedSensors.length) {
      setHistory([]);
      setError(current.group ? t('चयन गर्न कम्तीमा एउटा सेन्सर छान्नुहोस्', 'Select at least one sensor') : '');
      return undefined;
    }
    let alive = true;
    setHistory([]);
    setError('');
    Promise.allSettled(current.selectedSensors.map((sensor) =>
      api.get('/smart/sensors/' + sensor.id + '/history', { params: { hours } })
        .then((response) => ({ sensor, points: response.data.points || [] }))))
      .then((results) => {
        if (!alive) return;
        const successful = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
        const failedCount = results.length - successful.length;
        setHistory(successful);
        if (!successful.length) setError(t('इतिहास डाटा लोड भएन', 'Could not load sensor history'));
        else if (failedCount) setError(failedCount + ' ' + t('सेन्सरको डाटा लोड भएन', 'sensor history request(s) failed'));
      });
    return () => { alive = false; };
  }, [requestKey, hours, t]);

  const rows = useMemo(() => {
    const map = new Map();
    history.forEach(({ sensor, points }) => points.forEach((point) => {
      const ts = new Date(point.t).getTime();
      if (!Number.isFinite(ts)) return;
      const row = map.get(ts) || { ts };
      const value = Number(point.avg);
      row[String(sensor.id)] = Number.isFinite(value) ? value : null;
      map.set(ts, row);
    }));
    return [...map.values()].sort((a, b) => a.ts - b.ts);
  }, [history]);

  const summaries = useMemo(() => history.map(({ sensor, points }) => {
    const valid = points.filter((point) => Number.isFinite(Number(point.avg)));
    const samples = valid.reduce((sum, point) => sum + Number(point.n || 0), 0);
    const weighted = valid.reduce((sum, point) => sum + Number(point.avg) * Number(point.n || 0), 0);
    return {
      sensor,
      min: valid.length ? Math.min(...valid.map((point) => Number(point.min))) : null,
      mean: samples ? weighted / samples : null,
      max: valid.length ? Math.max(...valid.map((point) => Number(point.max))) : null,
      samples
    };
  }), [history]);

  const target = (parameters || []).find((parameter) => parameter.key === group?.sensor_type)?.target;
  const tick = (value) => hours <= 48
    ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const digits = group?.sensor_type === 'ec' ? 3 : 2;

  if (!groups.length) return <div className="bg-white rounded-lg shadow p-4 text-sm text-gray-500">{t('तुलना गर्न सेन्सर डाटा छैन', 'No sensor data available for comparison')}</div>;

  return (
    <section className="bg-white rounded-lg shadow p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h3 className="font-semibold text-gov-blue">{t('वैज्ञानिक सेन्सर तुलना', 'Scientific sensor comparison')}</h3>
          <p className="text-xs text-gray-500">{t('एउटै मापन प्रकार र एकाइ भएका सेन्सर मात्र तुलना गरिएका छन्। रेखाले समय खण्डको औसत देखाउँछ।', 'Only sensors with the same measurement type and unit are compared. Lines show bucket averages.')}</p>
        </div>
        <label className="sf-no-print text-sm flex items-center gap-2">
          <span>{t('मापन', 'Measurement')}</span>
          <select aria-label={t('मापन छान्नुहोस्', 'Choose measurement')} value={groupKey} onChange={(event) => setGroupKey(event.target.value)} className="border rounded p-2 bg-white">
            {groups.map((item) => <option key={item.key} value={item.key}>{metricLabel(item.sensor_type, lang)}{item.unit ? ' (' + item.unit + ')' : ''}</option>)}
          </select>
        </label>
        <div className="sf-no-print flex gap-1">
          {RANGES.map(([value, label]) => <button type="button" key={value} onClick={() => setHours(value)} aria-pressed={hours === value} className={'px-2.5 py-1.5 rounded text-sm border ' + (hours === value ? 'bg-agri-green text-white border-agri-green' : 'bg-white')}>{label}</button>)}
          <button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="px-2.5 py-1.5 rounded text-sm border bg-white">{t('ताजा', 'Refresh')}</button>
        </div>
      </div>

      {group && group.sensors.length > 1 && (
        <fieldset className="sf-no-print flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <legend className="sr-only">{t('तुलना गर्ने सेन्सर', 'Sensors to compare')}</legend>
          {group.sensors.map((sensor, index) => (
            <label key={sensor.id} className="inline-flex items-center gap-2">
              <input type="checkbox" checked={selectedIds.includes(sensor.id)} onChange={(event) => {
                setSelectedByGroup((previous) => {
                  const current = previous[group.key] || group.sensors.map((item) => item.id);
                  return { ...previous, [group.key]: event.target.checked ? [...current, sensor.id] : current.filter((id) => id !== sensor.id) };
                });
              }} />
              <span style={{ color: COLORS[index % COLORS.length] }}>{sensor.name}</span>
            </label>
          ))}
        </fieldset>
      )}

      {error && <p role="status" className="p-2 bg-yellow-50 text-yellow-800 rounded text-sm">{error}</p>}
      {!history.length && !error && <p className="text-gray-500 text-sm py-8 text-center">{t('डाटा लोड हुँदैछ…', 'Loading history…')}</p>}
      {history.length > 0 && rows.length === 0 && <p className="text-gray-500 text-sm py-8 text-center">{t('यस अवधिमा डाटा छैन', 'No data in this period')}</p>}

      {rows.length > 0 && (
        <>
          <div className="sf-comparison-chart" style={{ width: '100%', height: 330 }}>
            <ResponsiveContainer>
              <LineChart data={rows} margin={{ top: 10, right: 20, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={tick} tick={{ fontSize: 11 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={52} />
                <Tooltip labelFormatter={(value) => new Date(value).toLocaleString()} formatter={(value, name) => [fmt(value, digits) + ' ' + (group?.unit || ''), name]} />
                <Legend />
                {target && <ReferenceArea y1={target.opt_min} y2={target.opt_max} fill="#86efac" fillOpacity={0.22} />}
                {selectedSensors.map((sensor) => {
                  const index = group.sensors.findIndex((item) => item.id === sensor.id);
                  return <Line key={sensor.id} type="monotone" dataKey={String(sensor.id)} name={sensor.name} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={false} connectNulls={false} />;
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {target && <p className="text-xs text-gray-500">🟩 {t('हरियो क्षेत्र = बालीको उपयुक्त दायरा', 'Green band = crop optimum range')}: {target.opt_min}–{target.opt_max} {group.unit}</p>}

          <div>
            <h4 className="font-medium text-gov-blue mb-2">{t('अवधिको तथ्याङ्क', 'Period statistics')} · {hours <= 24 ? hours + 'h' : Math.round(hours / 24) + 'd'}</h4>
            <div className="sf-comparison-chart" style={{ width: '100%', height: Math.max(220, Math.min(360, summaries.length * 48 + 70)) }}>
              <ResponsiveContainer>
                <BarChart data={summaries.map((item) => ({ name: item.sensor.name, min: item.min, mean: item.mean, max: item.max }))} margin={{ top: 6, right: 18, left: 4, bottom: 18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={summaries.length > 3 ? -15 : 0} textAnchor={summaries.length > 3 ? 'end' : 'middle'} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={52} />
                  <Tooltip formatter={(value, name) => [fmt(value, digits) + ' ' + (group?.unit || ''), name]} />
                  <Legend />
                  <Bar dataKey="min" name={t('न्यूनतम', 'Minimum')} fill="#60a5fa" />
                  <Bar dataKey="mean" name={t('भारित औसत', 'Weighted mean')} fill="#15803d" />
                  <Bar dataKey="max" name={t('अधिकतम', 'Maximum')} fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-gray-50 text-left">
                <th className="p-2 border">{t('सेन्सर', 'Sensor')}</th><th className="p-2 border">{t('न्यूनतम', 'Min')}</th><th className="p-2 border">{t('भारित औसत', 'Weighted mean')}</th><th className="p-2 border">{t('अधिकतम', 'Max')}</th><th className="p-2 border">{t('नमूना', 'Samples')}</th>
              </tr></thead>
              <tbody>{summaries.map((item) => <tr key={item.sensor.id}>
                <td className="p-2 border font-medium">{item.sensor.name}</td><td className="p-2 border">{fmt(item.min, digits)} {group.unit}</td><td className="p-2 border">{fmt(item.mean, digits)} {group.unit}</td><td className="p-2 border">{fmt(item.max, digits)} {group.unit}</td><td className="p-2 border">{item.samples.toLocaleString()}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}


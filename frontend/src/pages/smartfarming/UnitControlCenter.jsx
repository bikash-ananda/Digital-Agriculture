import { useCallback, useEffect, useState } from 'react';
import './UnitControlCenter.css';
import { Link, useParams } from 'react-router-dom';
import api from '../../services/api';
import useLang from '../../utils/useLang';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import HealthRing from '../../components/greenhouse/HealthRing';
import ParamCard from '../../components/greenhouse/ParamCard';
import SensorComparisonChart from '../../components/greenhouse/SensorComparisonChart';
import ControlPanel from '../../components/greenhouse/ControlPanel';
import CropPanel from '../../components/greenhouse/CropPanel';
import AutomationPanel from '../../components/greenhouse/AutomationPanel';
import CameraPanel from '../../components/greenhouse/CameraPanel';
import { DerivedChips, Recommendations, PlantDescription } from '../../components/greenhouse/InfoCards';
import { PARAM_ICON, SENSOR_LABEL, ACT_LABEL, ageText, fmt } from '../../utils/greenhouse';

const SENSOR_NAMES = {
  temperature: { en: 'Temperature', ne: 'तापक्रम', icon: '🌡️' },
  humidity: { en: 'Humidity', ne: 'आर्द्रता', icon: '💧' },
  soil_moisture: { en: 'Soil moisture', ne: 'माटोको चिस्यान', icon: '🌱' },
  soil_temperature: { en: 'Soil temperature', ne: 'माटोको तापक्रम', icon: '🪴' },
  ec: { en: 'Electrical conductivity', ne: 'विद्युत चालकता', icon: '🧪' },
  vpd: { en: 'Vapor pressure deficit', ne: 'वाष्प चाप कमी', icon: '🌫️' },
  dli: { en: 'Daily light integral', ne: 'दैनिक प्रकाश मात्रा', icon: '☀️' }
};

function LiveSensorGrid({ sensors, analysis, lang, t }) {
  const parameters = new Map((analysis?.parameters || []).map((parameter) => [parameter.key, parameter]));
  return (
    <section className="sf-live-readings space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gov-blue">{t('हालको सेन्सर पठन', 'Current sensor readings')}</h3>
          <p className="text-xs text-gray-500">{t('प्रत्येक यन्त्रबाट प्राप्त पछिल्लो मापन', 'Latest measurement received from each sensor')}</p>
        </div>
        <span className="text-xs text-gray-500">{sensors.length} {t('सेन्सर', 'sensors')}</span>
      </div>
      {sensors.length === 0 ? <p className="bg-white rounded-lg shadow p-4 text-sm text-gray-500">{t('यस इकाईमा सेन्सर दर्ता गरिएको छैन', 'No sensors are registered for this unit')}</p> : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {sensors.map((sensor) => {
            const meta = SENSOR_NAMES[sensor.sensor_type] || SENSOR_LABEL[sensor.sensor_type] || SENSOR_LABEL.other;
            const stale = sensor.age_seconds === null || sensor.age_seconds > 300;
            const value = sensor.last_value === null || sensor.last_value === undefined ? NaN : Number(sensor.last_value);
            const target = parameters.get(sensor.sensor_type)?.target;
            const inRange = target && Number.isFinite(value) && value >= target.opt_min && value <= target.opt_max;
            return (
              <article key={sensor.id} className="bg-white rounded-lg shadow p-4 border-l-4" style={{ borderLeftColor: stale ? '#d97706' : '#16a34a' }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-700">{meta.icon || PARAM_ICON[sensor.sensor_type] || '📟'} {lang === 'en' ? meta.en : meta.ne} · {sensor.name}</p>
                  <span className={'text-xs font-medium ' + (stale ? 'text-amber-700' : 'text-green-700')}>{stale ? t('पुरानो', 'Stale') : t('ताजा', 'Fresh')}</span>
                </div>
                <p className="mt-2 text-3xl font-bold text-gov-blue">{fmt(sensor.last_value, sensor.sensor_type === 'ec' ? 3 : 1)} <span className="text-base font-normal text-gray-500">{sensor.unit}</span></p>
                <div className="mt-2 flex flex-wrap justify-between gap-1 text-xs text-gray-500">
                  <span>{t('पठन', 'Reading')}: {ageText(sensor.age_seconds)} {t('अघि', 'ago')}</span>
                  {sensor.last_reading_at && <span>{new Date(sensor.last_reading_at).toLocaleTimeString()}</span>}
                </div>
                {target && Number.isFinite(value) && <p className={'mt-2 text-xs ' + (inRange ? 'text-green-700' : 'text-amber-700')}>
                  {inRange ? t('उपयुक्त दायराभित्र', 'Within optimum range') : (Number.isFinite(value) && value < target.opt_min ? t('उपयुक्त दायराभन्दा कम', 'Below optimum range') : t('उपयुक्त दायराभन्दा बढी', 'Above optimum range'))}
                  : {target.opt_min}–{target.opt_max} {sensor.unit}
                </p>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function UnitControlCenter() {
  const { id } = useParams();
  const { lang, t } = useLang();
  const { can } = useAuth();
  const canAnalysis = can('analysis.view');
  const [live, setLive] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');

  const loadLive = useCallback(() => api.get(`/smart/units/${id}/live`)
    .then((r) => { setLive(r.data); setError(''); })
    .catch((e) => setError(e.response?.data?.message || 'Failed to load')), [id]);
  const loadAnalysis = useCallback(() => (canAnalysis
    ? api.get(`/smart/units/${id}/analysis`).then((r) => setAnalysis(r.data)).catch(() => {})
    : Promise.resolve()), [id, canAnalysis]);

  useEffect(() => {
    loadLive(); loadAnalysis();
    const a = setInterval(loadLive, 10000);
    const b = setInterval(loadAnalysis, 30000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [loadLive, loadAnalysis]);

  if (error && !live) return <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>;
  if (!live) return <p className="text-gray-500">…</p>;

  const unit = live.unit;
  const online = live.devices.some((d) => d.live_status === 'online');
  const dq = analysis ? analysis.data_quality : null;

  const tabs = [
    ['overview', '📊', t('सिंहावलोकन', 'Overview'), true],
    ['charts', '📈', t('ग्राफ', 'Charts'), true],
    ['control', '🎛️', t('नियन्त्रण', 'Control'), can('irrigation_control.view')],
    ['crop', '🌱', t('बाली तथा अवलोकन', 'Crop & Observations'), can('crop_cycles.view')],
    ['automation', '🤖', t('स्वचालन', 'Automation'), can('automation.view')],
    ['camera', '📷', t('क्यामेरा', 'Camera'), can('cameras.view')]
  ].filter((x) => x[3]);

  const reload = () => { loadLive(); loadAnalysis(); };

  return (
    <div className="sf-dashboard space-y-5 max-w-7xl">
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center gap-5 border-t-4 border-agri-green">
        {analysis && <HealthRing health={analysis.health} lang={lang} />}
        <div className="flex-1 min-w-60">
          <Link to="/app/smart-farming" className="text-xs text-gov-blue underline">← {t('स्मार्ट फार्मिङ', 'Smart Farming')}</Link>
          <h2 className="text-2xl font-bold text-gov-blue">{lang === 'en' ? unit.name_en : (unit.name_ne || unit.name_en)}</h2>
          <p className="text-sm text-gray-600">{lang === 'en' ? unit.site_name_en : unit.site_name_ne} · {unit.code} · {unit.unit_type}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {live.devices.map((d) => <span key={d.id} className="text-sm flex items-center gap-1">📟 {d.device_code} <StatusBadge value={d.live_status} /></span>)}
            {live.open_alerts > 0 && <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">🔔 {live.open_alerts} {t('खुला अलर्ट', 'open alerts')}</span>}
            <span className="text-xs text-gray-400">{t('अद्यावधिक', 'Updated')}: {new Date(live.server_time).toLocaleTimeString()}</span>
          </div>
        </div>
        {analysis && <DerivedChips d={analysis.derived} t={t} />}
        <button type="button" onClick={() => window.print()} className="sf-no-print border border-agri-green text-agri-green hover:bg-green-50 px-3 py-2 rounded text-sm font-medium">📄 {t('PDF प्रतिवेदन', 'Export PDF')}</button>
      </div>
      <div className="sf-print-only">
        <h1 className="text-2xl font-bold">{t('स्मार्ट फार्मिङ सेन्सर प्रतिवेदन', 'Smart Farming Sensor Report')}</h1>
        <p className="text-sm">{lang === 'en' ? unit.site_name_en : unit.site_name_ne} · {lang === 'en' ? unit.name_en : (unit.name_ne || unit.name_en)} · {new Date().toLocaleString()}</p>
      </div>

      {!online && <div className="p-3 bg-yellow-50 border border-yellow-300 text-yellow-900 rounded text-sm">⚠ {t('कुनै पनि यन्त्र अनलाइन छैन — देखाइएको डाटा पुरानो हुन सक्छ र नियन्त्रण बन्द छ।', 'No device is online — values shown may be stale and controls are disabled.')}</div>}
      {dq && (dq.stale_sensors.length > 0 || dq.stuck_sensors.length > 0) && (
        <div className="p-3 bg-yellow-50 border border-yellow-300 text-yellow-900 rounded text-sm">
          {dq.stale_sensors.length > 0 && <p>🕒 {t('पुरानो डाटा भएका सेन्सर', 'Sensors with stale data')}: {dq.stale_sensors.map((s) => s.name).join(', ')}</p>}
          {dq.stuck_sensors.length > 0 && <p>📌 {t('अड्किएको जस्तो देखिने', 'Possibly stuck')}: {dq.stuck_sensors.join(', ')}</p>}
        </div>
      )}

      <LiveSensorGrid sensors={live.sensors} analysis={analysis} lang={lang} t={t} />

<div className="sf-no-print flex gap-1 overflow-x-auto border-b">
        {tabs.map(([k, icon, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-agri-green text-agri-green' : 'border-transparent text-gray-600 hover:text-gov-blue'}`}>{icon} {label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          {analysis ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {analysis.parameters.map((p) => <ParamCard key={p.key} p={p} lang={lang} t={t} />)}
            </div>
          ) : <p className="text-gray-500 text-sm">{canAnalysis ? '…' : t('विश्लेषण हेर्ने अनुमति छैन', 'No permission to view analysis')}</p>}


          <div>
            <h3 className="font-semibold text-gov-blue mb-2">{t('एक्चुएटर अवस्था', 'Actuator status')}</h3>
            <div className="flex flex-wrap gap-2">
              {live.actuators.map((a) => {
                const m = ACT_LABEL[a.actuator_type] || ACT_LABEL.other;
                return (
                  <span key={a.id} className="bg-white rounded-lg shadow px-3 py-2 text-sm flex items-center gap-2">
                    {m.icon} {a.name} <StatusBadge value={a.current_state} /> <span className="text-xs text-gray-400">{a.control_mode}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {analysis && (
            <div className="grid lg:grid-cols-2 gap-5">
              <PlantDescription analysis={analysis} lang={lang} t={t} />
              <Recommendations recs={analysis.recommendations} risks={analysis.risks} lang={lang} t={t} />
            </div>
          )}
        </div>
      )}

      {tab === 'charts' && <SensorComparisonChart sensors={live.sensors} parameters={analysis ? analysis.parameters : []} lang={lang} t={t} />}
      {tab === 'control' && <div className="sf-print-hide"><ControlPanel actuators={live.actuators} devices={live.devices} canControl={can('irrigation_control.control')} canConfigure={can('irrigation_control.configure')} onDone={reload} lang={lang} t={t} /></div>}
      {tab === 'crop' && <div className="sf-print-hide"><CropPanel unitId={id} analysis={analysis} can={can} onChanged={reload} lang={lang} t={t} /></div>}
      {tab === 'automation' && <div className="sf-print-hide"><AutomationPanel unitId={id} live={live} can={can} lang={lang} t={t} /></div>}
      {tab === 'camera' && <div className="sf-print-hide"><CameraPanel unitId={id} t={t} /></div>}
    </div>
  );
}


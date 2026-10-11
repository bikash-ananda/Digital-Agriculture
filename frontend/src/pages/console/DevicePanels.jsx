import { useEffect, useState } from 'react';
import { errMsgs } from '../../utils/errors';
import { CMD } from '../../utils/console';

export function CmdChip({ c, lang }) {
  const m = CMD[c.status] || CMD.queued;
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${m.cls}`}>{m[lang]}{c.message ? ` · ${c.message}` : ''}</span>;
}

export function WifiPanel({ health, send, canEdit, cmds, lang, t }) {
  const h = health && health.latest;
  const saved = (h && h.wifi_saved) || [];
  const [ssid, setSsid] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState(null);
  const recent = cmds.filter((c) => c.type.startsWith('wifi')).slice(0, 4);

  const add = async (e) => {
    e.preventDefault(); setMsg(null);
    try { await send('wifi_add', { ssid, password: pw }); setSsid(''); setPw(''); setMsg({ ok: true, text: t('आदेश लाइनमा राखियो। यन्त्रले करिब १० सेकेन्डमा लिन्छ।', 'Queued. The device collects it within about 10 seconds.') }); }
    catch (err) { setMsg({ ok: false, text: errMsgs(err).join(' · ') }); }
  };
  const remove = async (name) => {
    const last = saved.length <= 1;
    if (!window.confirm(last ? t(`“${name}” एक्लो सुरक्षित नेटवर्क हो। हटाए यन्त्र अफलाइन हुन सक्छ। पक्का?`, `“${name}” is the ONLY saved network. Removing it can leave the device offline. Are you sure?`) : t(`“${name}” हटाउने?`, `Remove “${name}”?`))) return;
    setMsg(null);
    try { await send('wifi_remove', { ssid: name, confirm_last: last }); setMsg({ ok: true, text: t('आदेश लाइनमा राखियो', 'Queued') }); } catch (err) { setMsg({ ok: false, text: errMsgs(err).join(' · ') }); }
  };

  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-3">
      <h4 className="font-display font-bold text-terrace-900">📶 {t('Wi-Fi नेटवर्क', 'Wi-Fi networks')}</h4>
      <p className="text-xs text-gray-600">{t('नयाँ नेटवर्क थप्दा पुराना हट्दैनन् — टाइपो भए पनि यन्त्र लक हुँदैन। पासवर्ड यन्त्रमा मात्र पठाइन्छ, कहिल्यै देखाइँदैन।', 'Adding a network never removes the old ones, so a typo cannot lock the device out. Passwords are only sent to the device and are never shown.')}</p>
      <ul className="divide-y border rounded-md">
        {saved.length === 0 && <li className="p-3 text-sm text-gray-500">{t('सूची उपलब्ध छैन (यन्त्रले अझै रिपोर्ट गरेको छैन)', 'List not available (the device has not reported yet)')}</li>}
        {saved.map((n) => (
          <li key={n} className="p-3 flex items-center gap-3 text-sm"><span className="font-medium">{n}</span>{h && h.ssid === n && <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs">{t('जोडिएको', 'connected')}</span>}
            {canEdit && <button onClick={() => remove(n)} className="ml-auto text-gov-red text-xs underline">{t('हटाउनुहोस्', 'Remove')}</button>}</li>
        ))}
      </ul>
      {canEdit && (
        <form onSubmit={add} className="grid sm:grid-cols-3 gap-3 text-sm items-end">
          <label>{t('नेटवर्कको नाम', 'Network name')}<input required maxLength={32} value={ssid} onChange={(e) => setSsid(e.target.value)} className="mt-1 w-full border rounded-md p-2" autoComplete="off" /></label>
          <label>{t('पासवर्ड', 'Password')}<div className="relative"><input type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1 w-full border rounded-md p-2 pr-14" autoComplete="new-password" /><button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-3 text-xs text-gray-600 underline">{show ? t('लुकाउनु', 'hide') : t('देखाउनु', 'show')}</button></div></label>
          <button className="bg-agri-green text-white px-4 py-2 rounded-md font-semibold">{t('थप्नुहोस्', 'Add network')}</button>
        </form>
      )}
      {msg && <p className={`text-sm rounded p-2 ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
      {recent.length > 0 && <ul className="text-xs space-y-1">{recent.map((c) => <li key={c.id} className="flex items-center gap-2"><span>{c.type === 'wifi_add' ? '+' : '−'} {c.summary && c.summary.ssid}</span><CmdChip c={c} lang={lang} /></li>)}</ul>}
      <p className="text-xs text-gray-500">{t('सबै नेटवर्क ५ मिनेट असफल भए यन्त्रले “GreenHouse-greenhouse-kaski-01” हटस्पट खोल्छ (192.168.4.1)।', 'If every saved network fails for 5 minutes, the device opens the hotspot “GreenHouse-greenhouse-kaski-01” (192.168.4.1).')}</p>
    </div>
  );
}

const FIELDS = [
  ['soil_dry', 'माटो सुक्खा (raw)', 'Soil dry (raw)', 0, 4095, 1], ['soil_wet', 'माटो भिजेको (raw)', 'Soil wet (raw)', 0, 4095, 1],
  ['temp_offset_c', 'तापक्रम सुधार (°C)', 'Temperature offset (°C)', -10, 10, 0.1], ['hum_offset_pct', 'आर्द्रता सुधार (%)', 'Humidity offset (%)', -20, 20, 0.5], ['lux_scale', 'प्रकाश गुणक', 'Light scale', 0.1, 10, 0.01]
];
const LIMITS = [['max_irrigation_s', 'सिँचाइ अधिकतम (से.)', 'Max irrigation run (s)', 10, 3600, 10], ['max_misting_s', 'मिस्टिङ अधिकतम (से.)', 'Max misting run (s)', 10, 1800, 10], ['min_off_s', 'न्यूनतम आराम (से.)', 'Minimum rest (s)', 0, 3600, 5]];

export function CalibPanel({ health, ov, send, canEdit, cmds, lang, t }) {
  const cfg = (health && health.latest && health.latest.config) || {};
  const key = JSON.stringify(cfg);
  const [vals, setVals] = useState({});
  const [msg, setMsg] = useState(null);
  const [ref, setRef] = useState({ temp: '', hum: '' });
  useEffect(() => { setVals({ ...cfg }); }, [key]);
  const tile = (type) => (ov.tiles.find((x) => x.type === type) || {}).value;
  const lastSoil = cmds.find((c) => c.type === 'calibrate_soil');

  const apply = async (fields) => {
    setMsg(null);
    const changed = {};
    fields.forEach(([k]) => { if (vals[k] !== undefined && vals[k] !== '' && String(vals[k]) !== String(cfg[k])) changed[k] = Number(vals[k]); });
    if (!Object.keys(changed).length) { setMsg({ ok: false, text: t('कुनै परिवर्तन छैन', 'Nothing changed') }); return; }
    try { await send('set_config', { config: changed }); setMsg({ ok: true, text: t('सेटिङ लाइनमा राखियो। लागू भएपछि नयाँ मान आउँछन्।', 'Queued. New values appear once the device applies it.') }); }
    catch (err) { setMsg({ ok: false, text: errMsgs(err).join(' · ') }); }
  };
  const capture = async (point) => { setMsg(null); try { await send('calibrate_soil', { point }); setMsg({ ok: true, text: t('आदेश लाइनमा राखियो', 'Queued') }); } catch (err) { setMsg({ ok: false, text: errMsgs(err).join(' · ') }); } };
  const suggest = (type, refVal, offKey, d) => {
    const shown = tile(type);
    if (shown === undefined || shown === null || refVal === '') return null;
    return Math.round((Number(cfg[offKey] || 0) + (Number(refVal) - Number(shown))) * 10 ** d) / 10 ** d;
  };
  const st = suggest('temperature', ref.temp, 'temp_offset_c', 1);
  const sh = suggest('humidity', ref.hum, 'hum_offset_pct', 1);
  const num = (f) => (
    <label key={f[0]} className="text-sm">{lang === 'en' ? f[2] : f[1]}
      <input type="number" min={f[3]} max={f[4]} step={f[5]} value={vals[f[0]] ?? ''} onChange={(e) => setVals({ ...vals, [f[0]]: e.target.value })} disabled={!canEdit} className="mt-1 w-full border rounded-md p-2 bg-white" /></label>
  );

  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-4">
      <h4 className="font-display font-bold text-terrace-900">🎯 {t('क्यालिब्रेसन र सीमा', 'Calibration and limits')}</h4>
      {Object.keys(cfg).length === 0 && <p className="text-sm text-gray-500">{t('यन्त्रको हालको सेटिङ अझै प्राप्त भएको छैन।', 'The device’s current settings have not arrived yet.')}</p>}

      <div className="border rounded-md p-3 space-y-2">
        <p className="font-semibold text-sm">{t('१. माटो प्रोब', '1. Soil probe')}</p>
        <p className="text-xs text-gray-600">{t('प्रोब सुक्खा हावामा राखेर “सुक्खा” थिच्नुहोस्; त्यसपछि पानीमा (चिन्हसम्म) राखेर “भिजेको” थिच्नुहोस्। अन्तिम रूपमा वास्तविक माटोमै पुनः जाँच गर्नुहोस्।', 'Hold the probe in dry air and press “Dry”; then put it in water up to the mark and press “Wet”. Re-check in the real soil afterwards.')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={!canEdit} onClick={() => capture('dry')} className="px-3 py-1.5 border rounded-md text-sm disabled:opacity-50">{t('सुक्खा कैद गर्नुहोस्', 'Capture dry')}</button>
          <button disabled={!canEdit} onClick={() => capture('wet')} className="px-3 py-1.5 border rounded-md text-sm disabled:opacity-50">{t('भिजेको कैद गर्नुहोस्', 'Capture wet')}</button>
          {lastSoil && <CmdChip c={lastSoil} lang={lang} />}
          <span className="text-sm text-gray-600 ml-2">{t('हाल', 'Now')}: dry {cfg.soil_dry ?? '—'} · wet {cfg.soil_wet ?? '—'} · {t('प्रदर्शित', 'shown')} {tile('soil_moisture') === undefined || tile('soil_moisture') === null ? '—' : `${Number(tile('soil_moisture')).toFixed(1)}%`}</span>
        </div>
      </div>

      <div className="border rounded-md p-3 space-y-3">
        <p className="font-semibold text-sm">{t('२. तापक्रम, आर्द्रता र प्रकाश', '2. Temperature, humidity and light')}</p>
        <p className="text-xs text-gray-600">{t('भरपर्दो थर्मोमिटर/हाइग्रोमिटरको मान लेख्नुहोस् — सुझाव निकालिन्छ।', 'Type the value from a trusted thermometer or hygrometer and a suggested offset is calculated.')}</p>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <label>{t('सन्दर्भ तापक्रम (°C)', 'Reference temperature (°C)')}<input type="number" step="0.1" value={ref.temp} onChange={(e) => setRef({ ...ref, temp: e.target.value })} className="mt-1 w-full border rounded-md p-2" /></label>
            <p className="text-xs mt-1">{t('प्रदर्शित', 'Shown')}: {tile('temperature') === undefined || tile('temperature') === null ? '—' : Number(tile('temperature')).toFixed(1)} °C {st !== null && <button type="button" onClick={() => setVals({ ...vals, temp_offset_c: st })} className="ml-2 underline text-gov-blue">{t('सुझाव प्रयोग', 'use suggested')} {st}</button>}</p>
          </div>
          <div>
            <label>{t('सन्दर्भ आर्द्रता (%)', 'Reference humidity (%)')}<input type="number" step="0.5" value={ref.hum} onChange={(e) => setRef({ ...ref, hum: e.target.value })} className="mt-1 w-full border rounded-md p-2" /></label>
            <p className="text-xs mt-1">{t('प्रदर्शित', 'Shown')}: {tile('humidity') === undefined || tile('humidity') === null ? '—' : Number(tile('humidity')).toFixed(0)} % {sh !== null && <button type="button" onClick={() => setVals({ ...vals, hum_offset_pct: sh })} className="ml-2 underline text-gov-blue">{t('सुझाव प्रयोग', 'use suggested')} {sh}</button>}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">{FIELDS.slice(2).map(num)}</div>
        <p className="text-xs text-gray-500">{t(`प्रकाश: हाल ${tile('light') === undefined || tile('light') === null ? '—' : Math.round(tile('light'))} lux। गुणक सन्दर्भ लक्स मिटरसँग मिलाउन प्रयोग गर्नुहोस्।`, `Light now: ${tile('light') === undefined || tile('light') === null ? '—' : Math.round(tile('light'))} lux. Use the scale to match a reference lux meter.`)}</p>
      </div>

      <div className="border rounded-md p-3 space-y-3">
        <p className="font-semibold text-sm">{t('३. पम्प सुरक्षा सीमा', '3. Pump safety limits')}</p>
        <div className="grid sm:grid-cols-3 gap-3">{LIMITS.map(num)}</div>
        <p className="text-xs text-gray-500">{t('यी सीमा यन्त्रमै लागू हुन्छन्, इन्टरनेट बिग्रे पनि।', 'These limits are enforced on the device itself, even if the internet fails.')}</p>
      </div>

      {canEdit && <div className="flex gap-3"><button onClick={() => apply([...FIELDS, ...LIMITS])} className="bg-agri-green text-white px-5 py-2 rounded-md font-semibold">{t('परिवर्तन यन्त्रमा पठाउनुहोस्', 'Send changes to the device')}</button></div>}
      {msg && <p className={`text-sm rounded p-2 ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
    </div>
  );
}

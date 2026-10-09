import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../../services/api';
import { lbl } from '../../utils/enumLabels';
import { formatLand } from '../../utils/dc';

const DEV = { online: '#15803d', offline: '#dc2626', none: '#64748b' };
const VER = { verified: '#15803d', submitted: '#2563eb', draft: '#94a3b8', rejected: '#dc2626' };
const devState = (f) => (f.devices > 0 ? (f.online > 0 ? 'online' : 'offline') : 'none');
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };

export default function MapTab({ lang, t }) {
  const navigate = useNavigate();
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState('devices');
  const [level, setLevel] = useState('');
  const [ver, setVer] = useState('');
  const [onlyDev, setOnlyDev] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => { api.get('/datacenter/map').then((r) => setData(r.data)).catch((e) => setErr(e.response?.data?.message || 'Failed to load the map data')); }, []);

  useEffect(() => {
    const map = L.map(divRef.current).setView([28.26, 83.97], 10);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const levels = useMemo(() => {
    if (!data) return [];
    const m = new Map();
    data.farms.forEach((f) => { if (f.local_level_id) m.set(f.local_level_id, lang === 'en' ? f.level_en : f.level_ne); });
    return [...m.entries()];
  }, [data, lang]);

  const farms = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    return data.farms.filter((f) => (!level || String(f.local_level_id) === level) && (!ver || f.verification_status === ver) && (!onlyDev || f.devices > 0)
      && (!s || `${f.full_name_en} ${f.full_name_ne || ''} ${f.farmer_code} ${f.farm_name}`.toLowerCase().includes(s)));
  }, [data, level, ver, onlyDev, q]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const pts = [];
    farms.forEach((f) => {
      const color = mode === 'devices' ? DEV[devState(f)] : VER[f.verification_status] || '#94a3b8';
      const m = L.circleMarker([f.latitude, f.longitude], { radius: 8, color: '#ffffff', weight: 2, fillColor: color, fillOpacity: 0.92 }).addTo(layer);
      m.bindTooltip(f.farm_name);
      const box = el('div', undefined, 'text-sm');
      box.appendChild(el('strong', (lang === 'en' ? f.full_name_en : f.full_name_ne || f.full_name_en)));
      box.appendChild(el('div', `${f.farmer_code} · ${f.farm_name}`));
      box.appendChild(el('div', `${t('जमिन', 'Land')}: ${formatLand(f.area_sqm, lang)}`));
      const crops = lang === 'en' ? f.crops_en : f.crops_ne;
      if (crops) box.appendChild(el('div', `${t('बाली', 'Crops')}: ${crops}`));
      box.appendChild(el('div', `${t('यन्त्र', 'Devices')}: ${f.devices}${f.devices ? ` (${f.online} ${t('अनलाइन', 'online')})` : ''}`));
      const btn = el('button', t('कृषक अभिलेख खोल्नुहोस्', 'Open farmer record'), 'mt-2 underline text-blue-800');
      btn.onclick = () => navigate(`/app/farmers/${f.farmer_id}`);
      box.appendChild(btn);
      m.bindPopup(box);
      pts.push([f.latitude, f.longitude]);
    });
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 15 });
  }, [farms, mode, lang]);

  const legend = mode === 'devices'
    ? [[DEV.online, t('यन्त्र अनलाइन', 'Device online')], [DEV.offline, t('यन्त्र अफलाइन', 'Device offline')], [DEV.none, t('यन्त्र छैन', 'No device')]]
    : Object.keys(VER).map((k) => [VER[k], lbl(k, lang)]);

  return (
    <div className="space-y-4">
      {err && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{err}</div>}
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-3 text-sm">
        <label>{t('रङ्ग', 'Color by')}
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="block mt-1 border rounded p-2 bg-white"><option value="devices">{t('यन्त्र अवस्था', 'Device status')}</option><option value="verification">{t('प्रमाणीकरण', 'Verification')}</option></select></label>
        <label>{t('स्थानीय तह', 'Local level')}
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="block mt-1 border rounded p-2 bg-white"><option value="">{t('सबै', 'All')}</option>{levels.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
        <label>{t('प्रमाणीकरण', 'Verification')}
          <select value={ver} onChange={(e) => setVer(e.target.value)} className="block mt-1 border rounded p-2 bg-white"><option value="">{t('सबै', 'All')}</option>{Object.keys(VER).map((k) => <option key={k} value={k}>{lbl(k, lang)}</option>)}</select></label>
        <label className="flex items-center gap-2 pb-2"><input type="checkbox" checked={onlyDev} onChange={(e) => setOnlyDev(e.target.checked)} /> {t('यन्त्र भएका मात्र', 'Only farms with devices')}</label>
        <label className="flex-1 min-w-48">{t('खोज्नुहोस्', 'Search')}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('नाम, कोड वा फार्म', 'Name, code or farm')} className="block mt-1 w-full border rounded p-2" /></label>
      </div>
      <div className="relative z-0 isolate rounded-lg overflow-hidden border border-terrace-100">
        <div ref={divRef} style={{ height: 560 }} />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-700">
        {legend.map(([c, n]) => <span key={n} className="flex items-center gap-1.5"><span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white shadow" style={{ background: c }} /> {n}</span>)}
        <span className="ml-auto">{farms.length} {t('फार्म देखाइँदै', 'farms shown')}{data && data.without_gps > 0 ? ` · ${data.without_gps} ${t('फार्ममा GPS छैन', 'farms have no GPS')}` : ''}</span>
      </div>
      <p className="text-xs text-gray-500">{t('ठ्याक्कै स्थान संवेदनशील तथ्याङ्क हो — यो नक्सा आन्तरिक प्रयोगका लागि मात्र हो र निर्यातमा समावेश गरिँदैन।', 'Exact locations are sensitive. This map is for internal use only and is never part of exports.')}</p>
    </div>
  );
}

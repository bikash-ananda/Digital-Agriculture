import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../../services/googleMaps';

const nepaliDigits = (value) => String(value || '').replace(/[०-९]/g, (digit) => '०१२३४५६७८९'.indexOf(digit));
const wardFromResult = (result) => {
  for (const component of (result?.address_components || [])) {
    const text = nepaliDigits(component.long_name);
    const match = text.match(/\bward\s*(?:no\.?\s*)?(\d+)\b/i);
    if (match) return Number(match[1]);
  }
  return null;
};

function localLevelFromResult(result, levels) {
  const parts = (result?.address_components || []).map((part) => String(part.long_name || '').toLowerCase());
  const address = String(result?.formatted_address || '').toLowerCase();
  return levels.find((level) => {
    const name = String(level.name_en || '').toLowerCase();
    const base = name.replace(/\s+(metropolitan city|rural municipality|municipality)$/i, '').trim();
    return parts.some((part) => part === name || part === base) || address.includes(name) || address.includes(base + ',');
  }) || null;
}

export default function GoogleFarmLocationPicker({ value, levels = [], onChange, lang, t }) {
  const mapElement = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const geocoder = useRef(null);
  const changeRef = useRef(onChange);
  const valueRef = useRef(value);
  const levelsRef = useRef(levels);
  const [status, setStatus] = useState('');
  const [mapError, setMapError] = useState('');
  const [busy, setBusy] = useState(false);

  changeRef.current = onChange;
  valueRef.current = value;
  levelsRef.current = levels;

  const t0 = (ne, en) => (lang === 'en' ? en : ne);
  const hasPoint = value.latitude !== '' && value.latitude !== null && value.latitude !== undefined
    && value.longitude !== '' && value.longitude !== null && value.longitude !== undefined;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);

  const setPoint = async (lat, lng, source, accuracy) => {
    const location = { lat: Number(lat), lng: Number(lng) };
    const current = valueRef.current || {};
    changeRef.current({
      ...current,
      latitude: location.lat.toFixed(6), longitude: location.lng.toFixed(6),
      gps_accuracy_m: accuracy === undefined ? '' : accuracy,
      location_source: source,
      local_level_id: current.local_level_id || '',
      ward_no: current.ward_no || ''
    });
    setStatus(t0('स्थान राखियो। ठेगाना जाँच्दै…', 'Location saved. Looking up the address…'));
    setMapError('');
    try {
      const loaded = await loadGoogleMaps();
      if (!geocoder.current) geocoder.current = new loaded.Geocoder();
      const response = await geocoder.current.geocode({ location });
      const result = response.results && response.results[0];
      if (!result) {
        setStatus(t0('स्थान राखियो; Google बाट ठेगाना भेटिएन।', 'Location saved; Google did not return an address.'));
        return;
      }
      const level = localLevelFromResult(result, levelsRef.current);
      const ward = wardFromResult(result);
      const updated = {
        ...(valueRef.current || {}),
        latitude: location.lat.toFixed(6), longitude: location.lng.toFixed(6),
        gps_accuracy_m: accuracy === undefined ? '' : accuracy,
        location_source: source, address: String(result.formatted_address || '').slice(0, 255),
        local_level_id: level ? String(level.id) : '',
        ward_no: ''
      };
      if (ward && level && (!level.total_wards || ward <= Number(level.total_wards))) updated.ward_no = String(ward);
      changeRef.current(updated);
      setStatus(t0('Google Maps बाट ठेगाना भरियो — पालिका र वडा जाँच्नुहोस्।', 'Address filled from Google Maps. Please check the local level and ward.'));
    } catch {
      setStatus(t0('स्थान सुरक्षित भयो। ठेगाना जाँच्न वा भर्नुहोस्।', 'Location saved. Please check or enter the address.'));
      setMapError(t0('Google reverse-geocoding उपलब्ध भएन। Maps JavaScript API र Geocoding API सक्षम भएको जाँच्नुहोस्।', 'Google reverse geocoding is unavailable. Check that Maps JavaScript API and Geocoding API are enabled.'));
    }
  };

  useEffect(() => {
    if (!hasPoint || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !mapElement.current) return undefined;
    let cancelled = false;
    loadGoogleMaps().then(({ Map, Marker, Geocoder }) => {
      if (cancelled || !mapElement.current) return;
      const position = { lat: latitude, lng: longitude };
      if (!geocoder.current) geocoder.current = new Geocoder();
      if (!map.current) {
        map.current = new Map(mapElement.current, { center: position, zoom: 15, mapTypeControl: false, streetViewControl: false, fullscreenControl: true });
        marker.current = new Marker({ map: map.current, position, draggable: true, title: t0('फार्मको स्थान', 'Farm location') });
        map.current.addListener('click', (event) => {
          if (event.latLng) setPoint(event.latLng.lat(), event.latLng.lng(), 'google_map');
        });
        marker.current.addListener('dragend', () => {
          const point = marker.current?.getPosition();
          if (point) setPoint(point.lat(), point.lng(), 'google_map');
        });
      } else {
        map.current.setCenter(position);
        marker.current?.setPosition(position);
      }
      setMapError('');
    }).catch(() => {
      if (!cancelled) setMapError(t0('Google Maps लोड भएन। स्थानका लागि GPS प्रयोग गर्न सक्नुहुन्छ।', 'Google Maps could not load. You can still capture the GPS location.'));
    });
    return () => { cancelled = true; };
  }, [hasPoint, latitude, longitude]);

  const capture = () => {
    if (!navigator.geolocation) {
      setStatus(t0('यो यन्त्रमा GPS उपलब्ध छैन।', 'GPS is not available on this device.'));
      return;
    }
    setBusy(true);
    setStatus(t0('स्थान खोज्दै…', 'Getting location…'));
    navigator.geolocation.getCurrentPosition((position) => {
      const accuracy = Math.round(position.coords.accuracy);
      setBusy(false);
      setPoint(position.coords.latitude, position.coords.longitude, 'gps', accuracy);
    }, () => {
      setBusy(false);
      setStatus(t0('स्थान प्राप्त भएन। ब्राउजरको स्थान अनुमति दिनुहोस् र फेरि प्रयास गर्नुहोस्।', 'Could not get a location. Allow location access in your browser and try again.'));
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={capture} disabled={busy} className="bg-gov-blue text-white px-5 py-3 rounded-md font-semibold disabled:opacity-60">
          📍 {busy ? t0('स्थान खोज्दै…', 'Getting location…') : t0('फार्मको हालको स्थान लिनुहोस्', 'Use current farm location')}
        </button>
        {value.latitude && value.longitude && <a className="text-sm text-gov-blue underline" href={'https://www.google.com/maps?q=' + encodeURIComponent(value.latitude + ',' + value.longitude)} target="_blank" rel="noreferrer">{t0('Google Maps मा खोल्नुहोस्', 'Open in Google Maps')}</a>}
      </div>
      <p className="text-xs text-gray-600">{t0('स्थान लिनुहोस् थिचेपछि मात्र GPS प्रयोग हुन्छ। कृपया खेतको स्थान राख्नुहोस्, घरको होइन। नक्साको पिन तानेर वा नक्सामा थिचेर मिलाउन सकिन्छ।', 'GPS is used only after you press the button. Use the farm location, not the home address. Drag the pin or click the map to adjust it.')}</p>
      {status && <p role="status" className="text-sm text-gray-700">{status}{value.gps_accuracy_m ? ' (±' + value.gps_accuracy_m + ' m)' : ''}</p>}
      {mapError && <p role="alert" className="p-2 bg-yellow-50 text-yellow-900 rounded text-xs">{mapError}</p>}
      {hasPoint && <div ref={mapElement} className="w-full h-72 rounded-lg border border-gray-300" aria-label={t0('फार्मको Google नक्सा', 'Farm Google map')} />}
      {hasPoint && <p className="text-xs text-gray-500">{Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}</p>}
    </div>
  );
}

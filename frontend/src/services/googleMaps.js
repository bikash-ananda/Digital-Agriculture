import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

let librariesPromise;

export function loadGoogleMaps() {
  if (!librariesPromise) {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!key) return Promise.reject(new Error('Google Maps key is not configured'));
    setOptions({ key, region: 'NP' });
    librariesPromise = Promise.all([importLibrary('maps'), importLibrary('geocoding')]).then(([maps, geocoding]) => ({
      Map: maps.Map,
      Marker: maps.Marker,
      Geocoder: geocoding.Geocoder
    }));
  }
  return librariesPromise;
}

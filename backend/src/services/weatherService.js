const cache = new Map();
const pending = new Map();
const CACHE_MS = 55 * 60 * 1000;

function numeric(value) { return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null; }
function temperature(value) { return value ? numeric(value.degrees) : null; }
function condition(value) {
  return value ? {
    text: value.description && value.description.text ? value.description.text : value.type || null,
    icon: value.iconBaseUri ? `${value.iconBaseUri}.svg` : null
  } : { text: null, icon: null };
}
function pressure(value) {
  return value ? numeric(value.meanSeaLevelMillibars) : null;
}
function wind(value) {
  return {
    speed_kmh: value && value.speed ? numeric(value.speed.value) : null,
    gust_kmh: value && value.gust ? numeric(value.gust.value) : null,
    direction_degrees: value && value.direction ? numeric(value.direction.degrees) : null
  };
}
function precipitation(value) {
  return {
    probability_pct: value && value.probability ? numeric(value.probability.percent) : null,
    rain_mm: value && value.qpf ? numeric(value.qpf.quantity) : null,
    type: value && value.probability ? value.probability.type : null
  };
}

async function request(path, lat, lng, apiKey, languageCode) {
  const url = new URL(`https://weather.googleapis.com/v1/${path}`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('location.latitude', String(lat));
  url.searchParams.set('location.longitude', String(lng));
  url.searchParams.set('unitsSystem', 'METRIC');
  url.searchParams.set('languageCode', languageCode);
  if (path.startsWith('forecast/hours')) {
    url.searchParams.set('hours', '24');
    url.searchParams.set('pageSize', '24');
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Google Weather API returned HTTP ${response.status}`);
  return response.json();
}

function normalize(current, forecast, generatedAt) {
  return {
    generated_at: generatedAt,
    expires_at: new Date(new Date(generatedAt).getTime() + CACHE_MS).toISOString(),
    time_zone: current.timeZone && current.timeZone.id || forecast.timeZone && forecast.timeZone.id || 'Asia/Kathmandu',
    current: {
      observed_at: current.currentTime || generatedAt,
      condition: condition(current.weatherCondition),
      temperature_c: temperature(current.temperature),
      feels_like_c: temperature(current.feelsLikeTemperature),
      humidity_pct: numeric(current.relativeHumidity),
      pressure_hpa: pressure(current.airPressure),
      precipitation: precipitation(current.precipitation),
      wind: wind(current.wind),
      cloud_cover_pct: numeric(current.cloudCover),
      uv_index: numeric(current.uvIndex)
    },
    hourly: (forecast.forecastHours || []).map((h) => ({
      time: h.interval && h.interval.startTime || null,
      condition: condition(h.weatherCondition),
      temperature_c: temperature(h.temperature),
      humidity_pct: numeric(h.relativeHumidity),
      pressure_hpa: pressure(h.airPressure),
      precipitation: precipitation(h.precipitation),
      wind: wind(h.wind),
      cloud_cover_pct: numeric(h.cloudCover)
    }))
  };
}

async function getWeather(latitude, longitude, languageCode = 'en') {
  const apiKey = process.env.GOOGLE_WEATHER_API_KEY;
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined || latitude === '' || longitude === '')
    return { configured: Boolean(apiKey), available: false, reason: 'location_missing' };
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)
    return { configured: Boolean(apiKey), available: false, reason: 'location_missing' };
  if (!apiKey) return { configured: false, available: false, reason: 'api_key_missing' };

  const key = `${lat.toFixed(4)},${lng.toFixed(4)},${languageCode}`;
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expires) return { configured: true, available: true, source: 'Google Maps Platform Weather API', ...cached.data };
  if (cached) cache.delete(key);
  if (pending.has(key)) return pending.get(key);

  const load = (async () => {
    const generatedAt = new Date().toISOString();
    const [current, forecast] = await Promise.all([
      request('currentConditions:lookup', lat, lng, apiKey, languageCode),
      request('forecast/hours:lookup', lat, lng, apiKey, languageCode)
    ]);
    const data = normalize(current, forecast, generatedAt);
    cache.set(key, { expires: Date.now() + CACHE_MS, data });
    if (cache.size > 200) {
      for (const [cacheKey, value] of cache) if (Date.now() >= value.expires) cache.delete(cacheKey);
      while (cache.size > 200) cache.delete(cache.keys().next().value);
    }
    return { configured: true, available: true, source: 'Google Maps Platform Weather API', ...data };
  })();
  pending.set(key, load);
  try {
    return await load;
  } finally {
    pending.delete(key);
  }
}

module.exports = { getWeather };

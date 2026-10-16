export const PRIMARY_METRICS = [
  { key: 'temperature', en: 'Air temperature', ne: 'हावाको तापक्रम', icon: '🌡️', digits: 1 },
  { key: 'humidity', en: 'Humidity', ne: 'आर्द्रता', icon: '💧', digits: 1 },
  { key: 'soil_moisture', en: 'Soil moisture', ne: 'माटोको चिस्यान', icon: '🌱', digits: 1 },
  { key: 'light', en: 'Light', ne: 'प्रकाश', icon: '☀️', digits: 0 }
];

const count = (value) => Math.max(0, Number(value) || 0);

export function getSiteConnectivity(site) {
  const total = count(site.device_count);
  const disabled = count(site.disabled_device_count);
  const active = Math.max(0, total - disabled);
  const online = count(site.online_device_count);
  const offline = count(site.offline_device_count);
  const awaiting = count(site.awaiting_device_count);

  if (!total) return 'unconfigured';
  if (!active) return 'disabled';
  if (online === active) return 'online';
  if (online > 0) return 'mixed';
  if (offline > 0) return 'offline';
  if (awaiting > 0) return 'awaiting';
  return 'unknown';
}

export function summarizeSites(sites) {
  return sites.reduce((summary, site) => {
    summary.sites += 1;
    summary.units += count(site.unit_count);
    summary.devices += count(site.device_count);
    summary.activeDevices += Math.max(0, count(site.device_count) - count(site.disabled_device_count));
    summary.online += count(site.online_device_count);
    summary.offline += count(site.offline_device_count);
    summary.awaiting += count(site.awaiting_device_count);
    summary.disabled += count(site.disabled_device_count);
    summary.sensors += count(site.sensor_count);
    summary.sensorFaults += count(site.faulty_sensor_count);
    summary.alerts += count(site.open_alert_count);
    return summary;
  }, { sites: 0, units: 0, devices: 0, activeDevices: 0, online: 0, offline: 0, awaiting: 0, disabled: 0, sensors: 0, sensorFaults: 0, alerts: 0 });
}

export function filterSites(sites, query, filter, lang) {
  const search = String(query || '').trim().toLocaleLowerCase();
  return sites.filter((site) => {
    const state = getSiteConnectivity(site);
    const matchesFilter = filter === 'all'
      || (filter === 'attention' && (state !== 'online' || count(site.open_alert_count) > 0))
      || (filter === 'online' && state === 'online')
      || (filter === 'unconfigured' && state === 'unconfigured');
    if (!matchesFilter) return false;
    if (!search) return true;
    const fields = [site.code, site.name_en, site.name_ne, site.address, site.local_level_en, site.local_level_ne];
    return fields.some((value) => String(value || '').toLocaleLowerCase().includes(search))
      || (lang === 'en' ? String(site.name_en || '') : String(site.name_ne || site.name_en || ''))
        .toLocaleLowerCase().includes(search);
  });
}

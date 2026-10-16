import assert from 'node:assert/strict';
import test from 'node:test';
import { filterSites, getSiteConnectivity, summarizeSites } from './siteOverview.js';

const sites = [
  { id: 1, code: 'SITE-01', name_en: 'North Farm', device_count: 2, online_device_count: 2, offline_device_count: 0, awaiting_device_count: 0, sensor_count: 4, unit_count: 1, open_alert_count: 0 },
  { id: 2, code: 'SITE-02', name_en: 'River Farm', device_count: 2, online_device_count: 1, offline_device_count: 1, awaiting_device_count: 0, sensor_count: 2, unit_count: 2, open_alert_count: 1 },
  { id: 3, code: 'SITE-03', name_en: 'New Farm', device_count: 1, online_device_count: 0, offline_device_count: 0, awaiting_device_count: 1, sensor_count: 0, unit_count: 1, open_alert_count: 0 },
  { id: 4, code: 'SITE-04', name_en: 'Unwired Farm', device_count: 0, online_device_count: 0, offline_device_count: 0, awaiting_device_count: 0, sensor_count: 0, unit_count: 0, open_alert_count: 0 }
];

test('connectivity distinguishes live, partial, offline, awaiting, and unconfigured sites', () => {
  assert.deepEqual(sites.map(getSiteConnectivity), ['online', 'mixed', 'awaiting', 'unconfigured']);
  assert.equal(getSiteConnectivity({ device_count: 1, offline_device_count: 1 }), 'offline');
});

test('summary totals farm, unit, device, sensor, and alert counts', () => {
  assert.deepEqual(summarizeSites(sites), {
    sites: 4, units: 4, devices: 5, activeDevices: 5, online: 3, offline: 1, awaiting: 1,
    disabled: 0, sensors: 6, sensorFaults: 0, alerts: 1
  });
});

test('filters farm cards by status and case-insensitive site details', () => {
  assert.deepEqual(filterSites(sites, '', 'online', 'en').map((site) => site.id), [1]);
  assert.deepEqual(filterSites(sites, '', 'attention', 'en').map((site) => site.id), [2, 3, 4]);
  assert.deepEqual(filterSites(sites, 'river', 'all', 'en').map((site) => site.id), [2]);
});

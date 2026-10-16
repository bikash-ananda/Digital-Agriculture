const assert = require('node:assert/strict');
const test = require('node:test');
const { indexSensors, resolveTelemetrySensor, toSensorTypeKey } = require('./sensorMapping');

const configured = indexSensors([
  { id: 1, sensor_type: 'temperature', channel_key: null },
  { id: 2, sensor_type: 'other', channel_key: 'soil_moisture_raw' },
  { id: 3, sensor_type: 'light', channel_key: 'light' }
]);

test('standard firmware telemetry keys resolve through the registered sensor type', () => {
  assert.equal(toSensorTypeKey('air_temperature_c'), 'temperature');
  assert.equal(resolveTelemetrySensor('air_temperature_c', configured).id, 1);
});

test('custom telemetry keys resolve only to the exact explicitly registered channel', () => {
  assert.equal(toSensorTypeKey('soil_moisture_raw'), null);
  assert.equal(resolveTelemetrySensor('soil_moisture_raw', configured).id, 2);
  assert.equal(resolveTelemetrySensor('soil_moisture_raw_unregistered', configured), null);
});

test('custom raw ADC telemetry stays distinct from calibrated soil moisture percentage', () => {
  const sensor = resolveTelemetrySensor('soil_moisture_raw', configured);
  assert.equal(sensor.sensor_type, 'other');
  assert.notEqual(sensor.id, resolveTelemetrySensor('soil_moisture_pct', configured)?.id);
});

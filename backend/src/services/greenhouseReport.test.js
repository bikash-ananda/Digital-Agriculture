const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const {
  buildIntervals,
  makeCsv,
  makeWorkbook,
  reportIntervalMs,
  resolveDateRange,
  summarize
} = require('./greenhouseReport');

const start = new Date('2026-05-01T00:00:00.000Z');
const end = new Date('2026-05-01T01:00:00.000Z');
const sensor = {
  id: 7, device_id: 3, device_code: 'TEST-DEVICE', sensor_type: 'temperature', name: 'Test temperature', unit: 'C',
  status: 'active', min_valid: 0, max_valid: 50, calibration_offset: 0, calibration_scale: 1
};
const syntheticReadings = [
  { id: 1, sensor_id: 7, value: 10, recorded_at: new Date('2026-05-01T00:01:00.000Z') },
  { id: 2, sensor_id: 7, value: 14, recorded_at: new Date('2026-05-01T00:20:00.000Z') }
];

test('report interval summaries preserve numeric statistics and count empty buckets', () => {
  const values = summarize([10, 14]);
  assert.equal(values.mean, 12);
  assert.equal(values.median, 12);
  assert.equal(values.min, 10);
  assert.equal(values.max, 14);
  assert.equal(values.sampleCount, 2);
  assert.equal(values.standardDeviation, Math.sqrt(8));
  assert.equal(reportIntervalMs(start, end, 60), 60 * 60 * 1000);

  const intervalMs = reportIntervalMs(start, end);
  const intervals = buildIntervals({ readings: syntheticReadings, sensors: [sensor], start, end, intervalMs });
  assert.equal(intervals.bucketCount, 4);
  assert.equal(intervals.bySensor.get(7)[0].mean, 10);
  assert.equal(intervals.bySensor.get(7)[1].mean, 14);
  assert.equal(intervals.bySensor.get(7)[2].missingDataCount, 1);
  assert.equal(intervals.bySensor.get(7)[3].sampleCount, 0);
  assert.equal(intervals.bySensor.get(7)[3].mean, null);
});

test('raw CSV preserves numeric values and neutralizes spreadsheet formulas in text fields', () => {
  const buffer = makeCsv({
    unit: { id: 2, farm_id: 1 },
    sensors: [{ ...sensor, name: '=HYPERLINK("https://example.invalid")' }],
    readings: [syntheticReadings[0]],
    range: { start, end },
    timeZone: 'UTC'
  });
  const csv = buffer.toString('utf8');
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example\.invalid""\)"/);
  assert.match(csv, /,"10",/);
  assert.match(csv, /"Within configured sensor bounds"/);
});

test('report date filters enforce a 30 day maximum', () => {
  const range = resolveDateRange({ from: '2026-05-01T00:00:00.000Z', to: '2026-05-02T00:00:00.000Z' });
  assert.equal(range.start.toISOString(), '2026-05-01T00:00:00.000Z');
  assert.throws(() => resolveDateRange({ from: '2026-04-01T00:00:00.000Z', to: '2026-05-02T00:00:00.000Z' }), /30 days or less/);
});

test('workbook contains data sheets, numeric values, and a printable trend graphic', async () => {
  const buffer = await makeWorkbook({
    unit: {
      id: 2, farm_id: 1, code: 'GH-TEST', name_en: 'Test greenhouse', unit_type: 'greenhouse',
      site_id: 4, site_name_en: 'Test site', farm_name: 'Test farm', latitude: null, longitude: null
    },
    sensors: [sensor],
    readings: syntheticReadings,
    commands: [],
    events: [],
    analysis: {
      cycle: { id: 5, crop_en: 'Test crop', variety: null, batch_code: 'TEST-01', days_since: 12 },
      stage: { name_en: 'Test stage' },
      description: { en: ['Synthetic test observation.'] },
      parameters: [{ key: 'temperature', label_en: 'Temperature', value: 12, unit: 'C', status: 'optimal', target: { min: 5, opt_min: 10, opt_max: 20, max: 25 } }],
      recommendations: []
    },
    tasks: [],
    range: { start, end },
    timeZone: 'UTC',
    generatedAt: new Date('2026-05-01T01:05:00.000Z')
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(workbook.worksheets.map((worksheet) => worksheet.name), [
    'Report Cover', 'Raw Sensor Data', 'Metric Summary', 'Aggregated Data', 'Chart Data',
    'Charts and Graphs', 'Actuator and Automation Log', 'Crop Analysis'
  ]);
  assert.equal(workbook.getWorksheet('Raw Sensor Data').getCell('H2').value, 10);
  assert.ok(workbook.getWorksheet('Raw Sensor Data').getCell('A2').value instanceof Date);
  assert.equal(workbook.getWorksheet('Metric Summary').getCell('F2').value, 12);
  assert.equal(workbook.getWorksheet('Metric Summary').getCell('L2').value, 2);
  assert.equal(workbook.getWorksheet('Aggregated Data').getCell('N4').value, 1);
  assert.equal(workbook.getWorksheet('Charts and Graphs').getImages().length, 1);
  assert.equal(workbook.getWorksheet('Raw Sensor Data').pageSetup.printTitlesRow, '1:1');
});

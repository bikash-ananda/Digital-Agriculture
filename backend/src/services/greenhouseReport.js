const ExcelJS = require('exceljs');
const { PNG } = require('pngjs');

const MAX_RAW_ROWS = 50000;
const MAX_SENSORS = 24;
const TARGET_BUCKETS = 300;
const MIN_BUCKET_MS = 15 * 60 * 1000;
const COLORS = ['15803D', '2563EB', 'D97706', '9333EA', '0891B2', 'DC2626', '4F46E5', '65A30D', 'DB2777', '475569'];

function toSqlDate(date) {
  return `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 23)}`;
}

function resolveDateRange({ from, to, hours }) {
  const now = new Date();
  let start;
  let end = now;
  if (Boolean(from) !== Boolean(to)) throw new Error('Both start and end dates are required');
  if (from && to) {
    start = new Date(from);
    end = new Date(to);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || start > now) {
      throw new Error('The selected report period is invalid');
    }
    if (end > now) end = now;
  } else {
    const periodHours = Math.min(720, Math.max(1, Number.parseInt(hours, 10) || 24));
    start = new Date(now.getTime() - periodHours * 60 * 60 * 1000);
  }
  if (end.getTime() - start.getTime() > 30 * 24 * 60 * 60 * 1000) {
    throw new Error('Report periods must be 30 days or less');
  }
  return { start, end, startSql: toSqlDate(start), endSql: toSqlDate(end) };
}

function reportIntervalMs(start, end, intervalMinutes = 0) {
  if ([15, 60, 240].includes(Number(intervalMinutes))) return Number(intervalMinutes) * 60 * 1000;
  const span = Math.max(1, end.getTime() - start.getTime());
  const suggested = Math.ceil(span / TARGET_BUCKETS / MIN_BUCKET_MS) * MIN_BUCKET_MS;
  return Math.max(MIN_BUCKET_MS, suggested);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function summarize(values) {
  if (!values.length) return { mean: null, median: null, min: null, max: null, standardDeviation: null, sampleCount: 0 };
  let mean = 0;
  let sumSquares = 0;
  let min = Infinity;
  let max = -Infinity;
  let count = 0;
  for (const value of values) {
    count += 1;
    const delta = value - mean;
    mean += delta / count;
    sumSquares += delta * (value - mean);
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return {
    mean,
    median: median(values),
    min,
    max,
    standardDeviation: count > 1 ? Math.sqrt(sumSquares / (count - 1)) : 0,
    sampleCount: count
  };
}

function dateInTimeZone(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = Number(part.value);
    return result;
  }, {});
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, date.getUTCMilliseconds()));
}

function buildIntervals({ readings, sensors, start, end, intervalMs }) {
  const bucketCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / intervalMs));
  const valuesBySensor = new Map(sensors.map((sensor) => [Number(sensor.id), Array.from({ length: bucketCount }, () => [])]));
  for (const reading of readings) {
    const sensorId = Number(reading.sensor_id);
    const buckets = valuesBySensor.get(sensorId);
    const value = Number(reading.value);
    const time = new Date(reading.recorded_at).getTime();
    if (!buckets || !Number.isFinite(value) || !Number.isFinite(time)) continue;
    const index = Math.floor((time - start.getTime()) / intervalMs);
    if (index >= 0 && index < bucketCount) buckets[index].push(value);
  }
  const bySensor = new Map();
  const rows = [];
  for (const sensor of sensors) {
    const sensorId = Number(sensor.id);
    const buckets = valuesBySensor.get(sensorId) || [];
    const summaries = buckets.map((values, index) => ({
      start: new Date(start.getTime() + index * intervalMs),
      end: new Date(Math.min(start.getTime() + (index + 1) * intervalMs, end.getTime())),
      sensor,
      ...summarize(values),
      missingDataCount: values.length ? 0 : 1
    }));
    bySensor.set(sensorId, summaries);
    summaries.forEach((summary) => rows.push(summary));
  }
  const chartRows = Array.from({ length: bucketCount }, (_, index) => {
    const row = { start: new Date(start.getTime() + index * intervalMs) };
    sensors.forEach((sensor) => {
      const summary = bySensor.get(Number(sensor.id))?.[index];
      row[String(sensor.id)] = summary?.mean ?? null;
    });
    return row;
  });
  return { bucketCount, rows, bySensor, chartRows };
}

function sanitizeText(value) {
  return String(value ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').slice(0, 32767);
}

const FONT = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'], H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'], J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'], L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'], N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'], R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'], V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'], X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'], Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'], '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'], '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00110', '00110'], ',': ['00000', '00000', '00000', '00000', '00110', '00110', '00100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'], '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  ':': ['00000', '00110', '00110', '00000', '00110', '00110', '00000'], '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '%': ['11001', '11010', '00100', '01000', '10110', '00110', '00000'], '_': ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100']
};

function hexColor(hex) {
  return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
}

function setPixel(png, x, y, color) {
  const px = Math.round(x), py = Math.round(y);
  if (px < 0 || py < 0 || px >= png.width || py >= png.height) return;
  const offset = (png.width * py + px) * 4;
  png.data[offset] = color[0]; png.data[offset + 1] = color[1]; png.data[offset + 2] = color[2]; png.data[offset + 3] = 255;
}

function drawLine(png, x0, y0, x1, y1, color, width = 1) {
  let dx = Math.abs(Math.round(x1) - Math.round(x0));
  let sx = Math.round(x0) < Math.round(x1) ? 1 : -1;
  let dy = -Math.abs(Math.round(y1) - Math.round(y0));
  let sy = Math.round(y0) < Math.round(y1) ? 1 : -1;
  let error = dx + dy;
  let x = Math.round(x0), y = Math.round(y0);
  while (true) {
    for (let oy = -Math.floor(width / 2); oy <= Math.floor(width / 2); oy += 1) {
      for (let ox = -Math.floor(width / 2); ox <= Math.floor(width / 2); ox += 1) setPixel(png, x + ox, y + oy, color);
    }
    if (x === Math.round(x1) && y === Math.round(y1)) break;
    const e2 = 2 * error;
    if (e2 >= dy) { error += dy; x += sx; }
    if (e2 <= dx) { error += dx; y += sy; }
  }
}

function drawText(png, text, x, y, color, scale = 1, maxWidth = Infinity) {
  let cursor = x;
  for (const rawChar of String(text).toUpperCase()) {
    const glyph = FONT[rawChar] || FONT['?'];
    if (cursor + 5 * scale > maxWidth) break;
    glyph.forEach((row, rowIndex) => [...row].forEach((bit, column) => {
      if (bit === '1') for (let sy = 0; sy < scale; sy += 1) for (let sx = 0; sx < scale; sx += 1) setPixel(png, cursor + column * scale + sx, y + rowIndex * scale + sy, color);
    }));
    cursor += 6 * scale;
  }
  return cursor;
}

function asciiChartText(value) {
  return String(value ?? '').replace(/°\s*[cC]/g, ' DEG C').replace(/°\s*[fF]/g, ' DEG F').replace(/µ/g, 'U').replace(/[^\x20-\x7E]/g, '?');
}

function renderTrendPng({ sensors, chartRows, start, end, timeZone, unit }) {
  const png = new PNG({ width: 1200, height: 850 });
  for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 255; png.data[i + 1] = 255; png.data[i + 2] = 255; png.data[i + 3] = 255; }
  const ink = hexColor('1E293B'), grid = hexColor('E2E8F0'), axis = hexColor('64748B');
  const finite = chartRows.flatMap((row) => sensors.map((sensor) => row[String(sensor.id)])).filter((value) => Number.isFinite(value));
  const chartTitle = `${asciiChartText(sensors[0]?.sensor_type || 'SENSOR')} TREND (${asciiChartText(unit || 'UNIT')})`;
  drawText(png, chartTitle, 48, 26, ink, 2, 1150);
  drawText(png, 'TIMESTAMPS USE THE SELECTED TIME ZONE SHOWN ON THE COVER', 48, 55, axis, 1, 1150);
  if (!finite.length) {
    drawText(png, 'NO SENSOR READINGS WERE RECORDED IN THIS PERIOD', 200, 310, axis, 2, 1100);
    return PNG.sync.write(png);
  }
  let min = Math.min(...finite), max = Math.max(...finite);
  if (min === max) { const padding = Math.max(Math.abs(min) * 0.05, 1); min -= padding; max += padding; }
  const padding = (max - min) * 0.08;
  min -= padding; max += padding;
  const left = 100, top = 100, right = 1125, bottom = 550;
  for (let tick = 0; tick <= 5; tick += 1) {
    const y = bottom - (bottom - top) * tick / 5;
    const value = min + (max - min) * tick / 5;
    drawLine(png, left, y, right, y, grid, 1);
    drawText(png, value.toFixed(Math.abs(max - min) < 10 ? 2 : 0), 12, y - 4, axis, 1, left - 7);
  }
  drawLine(png, left, top, left, bottom, axis, 2);
  drawLine(png, left, bottom, right, bottom, axis, 2);
  const startMs = start.getTime(), spanMs = Math.max(1, end.getTime() - startMs);
  const xAt = (date) => left + (right - left) * ((date.getTime() - startMs) / spanMs);
  const yAt = (value) => bottom - ((value - min) / (max - min)) * (bottom - top);
  const dateFormat = new Intl.DateTimeFormat('en-GB', { timeZone, year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  for (let tick = 0; tick <= 4; tick += 1) {
    const instant = new Date(startMs + spanMs * tick / 4);
    const label = dateFormat.format(instant).replace(',', '');
    const x = left + (right - left) * tick / 4;
    drawLine(png, x, bottom, x, bottom + 6, axis, 1);
    drawText(png, label, x - Math.round(label.length * 3), bottom + 16, axis, 1, right);
  }
  sensors.forEach((sensor, sensorIndex) => {
    const color = hexColor(COLORS[sensorIndex % COLORS.length]);
    let previous = null;
    for (const row of chartRows) {
      const value = row[String(sensor.id)];
      if (!Number.isFinite(value)) { previous = null; continue; }
      const point = { x: xAt(row.start), y: yAt(value) };
      if (previous) drawLine(png, previous.x, previous.y, point.x, point.y, color, 3);
      previous = point;
    }
    const col = sensorIndex % 3, line = Math.floor(sensorIndex / 3);
    const legendX = 80 + col * 365, legendY = 615 + line * 22;
    drawLine(png, legendX, legendY + 3, legendX + 26, legendY + 3, color, 3);
    drawText(png, `${asciiChartText(sensor.name)} (${sensor.id})`, legendX + 34, legendY, ink, 1, legendX + 350);
  });
  return PNG.sync.write(png);
}

function setPrintLayout(worksheet, orientation = 'landscape') {
  worksheet.properties.defaultRowHeight = 18;
  worksheet.pageSetup = {
    paperSize: worksheet.PAPER_A4,
    orientation,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
  };
  worksheet.pageSetup.printTitlesRow = '1:1';
  worksheet.headerFooter = { oddHeader: '&CSmart Farming Scientific Report', oddFooter: '&LDigital Agriculture&RPage &P of &N' };
}

function styleTable(worksheet, columnCount, rowCount, { autoFilter = true } = {}) {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  const header = worksheet.getRow(1);
  header.height = 30;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14532D' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF166534' } } };
  });
  for (let row = 2; row <= rowCount; row += 1) {
    worksheet.getRow(row).eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
      if (row % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });
  }
  if (autoFilter && rowCount > 0) worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rowCount, column: columnCount } };
  setPrintLayout(worksheet);
}

function addHeaderAndRows(worksheet, headers, rows, widths) {
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));
  worksheet.columns = headers.map((header, index) => ({ header, key: String(index), width: widths[index] || 18 }));
  styleTable(worksheet, headers.length, rows.length + 1);
}

function fmtRange({ start, end }, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone, dateStyle: 'medium', timeStyle: 'short' });
  return `${formatter.format(start)} to ${formatter.format(end)}`;
}

function readingQuality(reading, sensor) {
  if (sensor.status === 'faulty') return 'Faulty sensor (configured status)';
  const value = Number(reading.value);
  if (sensor.min_valid !== null && sensor.min_valid !== undefined && value < Number(sensor.min_valid)) return 'Below configured sensor bound';
  if (sensor.max_valid !== null && sensor.max_valid !== undefined && value > Number(sensor.max_valid)) return 'Above configured sensor bound';
  if (sensor.min_valid === null && sensor.max_valid === null) return 'No configured bounds; not evaluated';
  return 'Within configured sensor bounds';
}

function csvCell(value) {
  let text = value instanceof Date ? value.toISOString().slice(0, 23).replace('T', ' ') : String(value ?? '');
  if (typeof value === 'string' && /^[\s]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function makeCsv({ unit, sensors, readings, range, timeZone }) {
  const byId = new Map(sensors.map((sensor) => [Number(sensor.id), sensor]));
  const headers = ['Timestamp (selected local time)', 'Time zone', 'Period start (selected local time)', 'Period end (selected local time)', 'Farm ID', 'Greenhouse ID', 'Device ID', 'Sensor ID', 'Sensor name', 'Sensor type', 'Value', 'Unit', 'Data quality status', 'Calibration status', 'Configured offset', 'Configured scale', 'Source'];
  const lines = [headers.map(csvCell).join(',')];
  for (const reading of readings) {
    const sensor = byId.get(Number(reading.sensor_id));
    const timestamp = dateInTimeZone(reading.recorded_at, timeZone);
    const calibrationStatus = Number(sensor.calibration_offset || 0) === 0 && Number(sensor.calibration_scale || 1) === 1
      ? 'Default parameters; verification not recorded' : 'Parameters configured; verification not recorded';
    lines.push([
      timestamp, timeZone, dateInTimeZone(range.start, timeZone), dateInTimeZone(range.end, timeZone),
      unit.farm_id || '', unit.id, sensor.device_code || '', Number(sensor.id), sensor.name,
      sensor.sensor_type, Number(reading.value), sensor.unit || '', readingQuality(reading, sensor), calibrationStatus,
      Number(sensor.calibration_offset || 0), Number(sensor.calibration_scale || 1), `Device ${sensor.device_code || sensor.device_id}`
    ].map(csvCell).join(','));
  }
  return Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8');
}

function makeWorkbook(data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Digital Agriculture';
  workbook.subject = 'Smart Farming sensor and actuator report';
  workbook.title = `Smart Farming report - ${data.unit.name_en}`;
  workbook.created = data.generatedAt;
  workbook.modified = data.generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;
  const { unit, sensors, readings, commands, events, analysis, tasks, range, timeZone } = data;
  const intervalMs = reportIntervalMs(range.start, range.end, data.intervalMinutes);
  const intervals = buildIntervals({ readings, sensors, start: range.start, end: range.end, intervalMs });
  const perSensorValues = new Map(sensors.map((sensor) => [Number(sensor.id), []]));
  readings.forEach((reading) => {
    const values = perSensorValues.get(Number(reading.sensor_id));
    const value = Number(reading.value);
    if (values && Number.isFinite(value)) values.push(value);
  });

  const cover = workbook.addWorksheet('Report Cover');
  cover.columns = [{ width: 31 }, { width: 76 }];
  cover.mergeCells('A1:B1');
  cover.getCell('A1').value = 'SMART FARMING SCIENTIFIC REPORT';
  cover.getCell('A1').font = { bold: true, size: 20, color: { argb: 'FFFFFFFF' } };
  cover.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14532D' } };
  cover.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  cover.getRow(1).height = 42;
  const coverRows = [
    ['Farm', unit.farm_name || 'Not recorded'],
    ['Greenhouse / growing unit', unit.name_en || unit.code],
    ['Unit code and type', `${unit.code} · ${unit.unit_type}`],
    ['Site', unit.site_name_en || 'Not recorded'],
    ['Farm ID / greenhouse ID / site ID', `${unit.farm_id || '—'} / ${unit.id} / ${unit.site_id}`],
    ['Farm / site address', unit.farm_address || unit.site_address || 'Not recorded'],
    ['Farm area (m²)', unit.farm_area_sqm == null ? 'Not recorded' : Number(unit.farm_area_sqm)],
    ['Greenhouse area (m²)', unit.area_sqm == null ? 'Not recorded' : Number(unit.area_sqm)],
    ['Location', unit.latitude != null && unit.longitude != null ? `${unit.latitude}, ${unit.longitude}` : 'Coordinates not recorded'],
    ['Selected period', fmtRange(range, timeZone)],
    ['Time zone', timeZone],
    ['Report generated', fmtRange({ start: data.generatedAt, end: data.generatedAt }, timeZone)],
    ['Crop', analysis?.cycle?.crop_en || 'No active crop cycle recorded'],
    ['Crop stage', analysis?.stage?.name_en || 'Not recorded'],
    ['Sensors included', sensors.map((sensor) => `${sensor.name} (${sensor.id})`).join(', ')],
    ['Raw readings included', readings.length],
    ['Aggregation interval', `${Math.round(intervalMs / 60000)} minutes; ${intervals.bucketCount} intervals per sensor`],
    ['Data source', 'Stored sensor_readings received from registered farm devices. No synthetic values are included.'],
    ['Quality and calibration notes', 'Per-reading quality is evaluated only against configured sensor status and bounds. The system has no verified calibration-status field; offset and scale are listed as configured parameters.'],
    ['Missing-data method', 'Each sensor is checked against every selected aggregation period. A period with no reading is counted as one missing-data interval; no absent reading is treated as zero.'],
    ['Summary method', 'Mean, median, minimum, maximum, and sample standard deviation use actual readings in each period. Standard deviation uses n-1 and is zero for one reading.'],
    ['Crop-analysis method', 'Crop stage, latest metric values, observations, and recommendations are the current Smart Farming analysis at report generation time. They are not recalculated for historical periods and may be outside the selected date range. This is rule-based, not a generative-AI diagnosis; confidence is not represented in the source data.'],
    ['Actuator state note', 'Command records show requested outcomes; event records show states acknowledged by the device. Missing confirmations remain unconfirmed.']
  ];
  coverRows.forEach(([label, value], index) => {
    const row = index + 3;
    cover.getCell(row, 1).value = label;
    cover.getCell(row, 2).value = value;
    cover.getCell(row, 1).font = { bold: true, color: { argb: 'FF334155' } };
    cover.getCell(row, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cover.getCell(row, 1).alignment = { vertical: 'top', wrapText: true };
    cover.getCell(row, 2).alignment = { vertical: 'top', wrapText: true };
    if (index % 2 === 1) cover.getCell(row, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    if (label === 'Report generated') cover.getCell(row, 2).value = dateInTimeZone(data.generatedAt, timeZone);
    const textLength = String(value ?? '').length;
    cover.getRow(row).height = Math.max(22, Math.min(72, 18 * Math.ceil(textLength / 108)));
  });
  cover.getCell(coverRows.findIndex(([label]) => label === 'Report generated') + 3, 2).numFmt = 'yyyy-mm-dd hh:mm';
  cover.pageSetup = { paperSize: cover.PAPER_A4, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.2, footer: 0.2 } };
  cover.headerFooter = { oddFooter: '&LDigital Agriculture&RPage &P of &N' };

  const rawRows = readings.map((reading) => {
    const sensor = sensors.find((candidate) => Number(candidate.id) === Number(reading.sensor_id));
    const recordedAt = new Date(reading.recorded_at);
    const calibrationStatus = Number(sensor.calibration_offset || 0) === 0 && Number(sensor.calibration_scale || 1) === 1
      ? 'Default parameters; verification not recorded' : 'Parameters configured; verification not recorded';
    return [
      dateInTimeZone(recordedAt, timeZone), unit.farm_id || null, unit.id, sensor.device_code || null,
      Number(sensor.id), sensor.name, sensor.sensor_type, Number(reading.value), sensor.unit || '',
      readingQuality(reading, sensor), calibrationStatus, Number(sensor.calibration_offset || 0),
      Number(sensor.calibration_scale || 1), `Device ${sensor.device_code || sensor.device_id}`
    ];
  });
  const raw = workbook.addWorksheet('Raw Sensor Data');
  addHeaderAndRows(raw, ['Timestamp', 'Farm ID', 'Greenhouse ID', 'Device ID', 'Sensor ID', 'Sensor name', 'Sensor type', 'Value', 'Unit', 'Data quality status', 'Calibration status', 'Configured offset', 'Configured scale', 'Source'], rawRows,
    [22, 12, 16, 18, 12, 24, 20, 14, 14, 34, 42, 18, 18, 24]);
  raw.getColumn(1).numFmt = 'yyyy-mm-dd hh:mm:ss.000';
  raw.getColumn(8).numFmt = '0.0000';
  raw.getColumn(12).numFmt = '0.0000'; raw.getColumn(13).numFmt = '0.0000';

  const metrics = workbook.addWorksheet('Metric Summary');
  const summaryRows = sensors.map((sensor) => {
    const summary = summarize(perSensorValues.get(Number(sensor.id)) || []);
    const missing = intervals.bySensor.get(Number(sensor.id))?.reduce((sum, item) => sum + item.missingDataCount, 0) || 0;
    return [Number(sensor.id), sensor.device_code || null, sensor.name, sensor.sensor_type, sensor.unit || '',
      summary.mean, summary.median, summary.min, summary.max, summary.standardDeviation, summary.sampleCount, missing,
      sensor.status, sensor.min_valid ?? null, sensor.max_valid ?? null];
  });
  addHeaderAndRows(metrics, ['Sensor ID', 'Device ID', 'Sensor', 'Metric', 'Unit', 'Mean', 'Median', 'Minimum', 'Maximum', 'Sample standard deviation', 'Sample count', 'Missing aggregation periods', 'Configured sensor status', 'Configured lower bound', 'Configured upper bound'], summaryRows,
    [12, 18, 24, 20, 12, 16, 16, 16, 16, 24, 16, 24, 24, 22, 22]);
  for (const column of [6, 7, 8, 9, 10, 14, 15]) metrics.getColumn(column).numFmt = '0.0000';

  const aggregated = workbook.addWorksheet('Aggregated Data');
  const aggregateRows = intervals.rows.map((item) => [
    dateInTimeZone(item.start, timeZone), dateInTimeZone(item.end, timeZone), Number(item.sensor.id),
    item.sensor.device_code || null, item.sensor.name, item.sensor.sensor_type, item.sensor.unit || '',
    item.mean, item.median, item.min, item.max, item.standardDeviation, item.sampleCount, item.missingDataCount
  ]);
  addHeaderAndRows(aggregated, ['Interval start', 'Interval end', 'Sensor ID', 'Device ID', 'Sensor', 'Metric', 'Unit', 'Mean', 'Median', 'Minimum', 'Maximum', 'Sample standard deviation', 'Sample count', 'Missing-data count'], aggregateRows,
    [22, 22, 12, 18, 24, 20, 12, 16, 16, 16, 16, 24, 16, 20]);
  aggregated.getColumn(1).numFmt = 'yyyy-mm-dd hh:mm'; aggregated.getColumn(2).numFmt = 'yyyy-mm-dd hh:mm';
  for (const column of [8, 9, 10, 11, 12]) aggregated.getColumn(column).numFmt = '0.0000';

  const chartData = workbook.addWorksheet('Chart Data');
  const chartHeaders = ['Interval start', ...sensors.map((sensor) => `${sensor.name} (${sensor.id}) · ${sensor.unit || 'unit'}`)];
  chartData.addRow(chartHeaders);
  intervals.chartRows.forEach((row) => chartData.addRow([dateInTimeZone(row.start, timeZone), ...sensors.map((sensor) => row[String(sensor.id)])]));
  chartData.columns = chartHeaders.map((header, index) => ({ header, key: String(index), width: index === 0 ? 22 : 28 }));
  styleTable(chartData, chartHeaders.length, intervals.chartRows.length + 1);
  chartData.getColumn(1).numFmt = 'yyyy-mm-dd hh:mm';
  for (let column = 2; column <= chartHeaders.length; column += 1) chartData.getColumn(column).numFmt = '0.0000';

  const chartSheet = workbook.addWorksheet('Charts and Graphs');
  chartSheet.columns = Array.from({ length: 16 }, () => ({ width: 13 }));
  chartSheet.mergeCells('A1:P1'); chartSheet.getCell('A1').value = 'SENSOR TREND';
  chartSheet.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  chartSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14532D' } };
  chartSheet.getCell('A1').alignment = { vertical: 'middle' }; chartSheet.getRow(1).height = 34;
  chartSheet.mergeCells('A2:P2'); chartSheet.getCell('A2').value = `${sensors[0]?.sensor_type || 'Sensor'} · ${sensors[0]?.unit || 'unit'} · ${fmtRange(range, timeZone)} · ${Math.round(intervalMs / 60000)} minute interval`;
  chartSheet.getCell('A2').font = { color: { argb: 'FF475569' }, italic: true };
  chartSheet.mergeCells('A3:P3'); chartSheet.getCell('A3').value = 'Static printable graph. Use the Chart Data worksheet for the numeric series; a gap means no reading was recorded for that interval.';
  chartSheet.getCell('A3').font = { size: 10, color: { argb: 'FF475569' } };
  const chartImage = renderTrendPng({ sensors, chartRows: intervals.chartRows, start: range.start, end: range.end, timeZone, unit: sensors[0]?.unit || '' });
  const imageId = workbook.addImage({ buffer: chartImage, extension: 'png' });
  chartSheet.addImage(imageId, { tl: { col: 0, row: 4 }, ext: { width: 1200, height: 850 } });
  chartSheet.pageSetup = { paperSize: chartSheet.PAPER_A4, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.2, right: 0.2, top: 0.35, bottom: 0.35, header: 0.2, footer: 0.2 } };
  chartSheet.headerFooter = { oddFooter: '&LDigital Agriculture&RPage &P of &N' };

  const actuator = workbook.addWorksheet('Actuator and Automation Log');
  const logItems = [
    ...commands.map((command) => ({ instant: new Date(command.requested_at), row: [
      'Command', dateInTimeZone(command.requested_at, timeZone), command.actuator_name, command.command,
      command.status === 'acknowledged' ? command.command.toUpperCase() : 'Not confirmed',
      command.duration_seconds ?? null,
      command.source === 'auto' ? 'Automatic rule' : (command.username || command.source || 'Unknown'),
      command.status, command.error_message || ''
    ] })),
    ...events.map((event) => ({ instant: new Date(event.started_at), row: [
      'State event', dateInTimeZone(event.started_at, timeZone), event.actuator_name, event.state,
      event.state.toUpperCase(), event.duration_seconds ?? null, event.trigger_source || 'Unknown',
      'Confirmed event record', ''
    ] }))
  ];
  const logRows = logItems.sort((a, b) => a.instant - b.instant).map((item) => item.row);
  addHeaderAndRows(actuator, ['Record type', 'Timestamp', 'Actuator', 'Commanded / recorded action', 'Confirmed state', 'Runtime (seconds)', 'Source / user', 'Status', 'Failure details'], logRows,
    [16, 22, 24, 24, 22, 18, 24, 24, 36]);
  actuator.getColumn(2).numFmt = 'yyyy-mm-dd hh:mm:ss';

  const crop = workbook.addWorksheet('Crop Analysis');
  crop.columns = [{ width: 28 }, { width: 28 }, { width: 18 }, { width: 17 }, { width: 17 }, { width: 17 }, { width: 17 }, { width: 17 }, { width: 36 }];
  crop.addRow(['Crop and Growth Context']);
  crop.mergeCells('A1:I1');
  crop.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
  crop.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14532D' } };
  const cropFacts = [
    ['Crop', analysis?.cycle?.crop_en || 'No active crop cycle recorded'],
    ['Variety / batch', analysis?.cycle ? `${analysis.cycle.variety || 'Not recorded'} / ${analysis.cycle.batch_code}` : '—'],
    ['Growth stage', analysis?.stage?.name_en || 'Not recorded'],
    ['Days since planting', analysis?.cycle?.days_since ?? '—'],
    ['Planting / expected harvest', analysis?.cycle ? `${analysis.cycle.planted_on || 'Not recorded'} / ${analysis.cycle.expected_harvest_on || 'Not recorded'}` : '—'],
    ['Growth stage progress', analysis?.stage?.progress_percent == null ? 'Not available' : `${analysis.stage.progress_percent}%`],
    ['Analysis generated at', dateInTimeZone(data.generatedAt, timeZone)],
    ['Current system observations (rule-based)', (analysis?.description?.en || ['Analysis is unavailable.']).join(' ')],
    ['Uncertainty and source', 'This is current context, not a historical analysis of the selected period. Configured stage targets may change if the crop stage changes. These rules are not an AI diagnosis. Calibration verification and confidence scores are not stored.']
  ];
  cropFacts.forEach(([label, value]) => crop.addRow([label, value]));
  for (let row = 2; row <= cropFacts.length + 1; row += 1) {
    crop.mergeCells(`B${row}:I${row}`);
    crop.getCell(row, 1).font = { bold: true, color: { argb: 'FF334155' } };
    crop.getCell(row, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    crop.getCell(row, 1).alignment = { vertical: 'top', wrapText: true };
    crop.getCell(row, 2).alignment = { vertical: 'top', wrapText: true };
    crop.getRow(row).height = row >= 6 ? 54 : 24;
    if (cropFacts[row - 2][0] === 'Analysis generated at') crop.getCell(row, 2).numFmt = 'yyyy-mm-dd hh:mm';
  }
  const metricHeaderRow = cropFacts.length + 3;
  const metricHeaders = ['Metric', 'Current value', 'Unit', 'Status', 'Target minimum', 'Optimal minimum', 'Optimal maximum', 'Target maximum', 'Target source'];
  crop.getRow(metricHeaderRow).values = metricHeaders;
  const params = analysis?.parameters || [];
  params.forEach((parameter, index) => {
    const target = parameter.target;
    const row = crop.getRow(metricHeaderRow + index + 1);
    row.values = [parameter.label_en || parameter.key, parameter.value, parameter.unit, parameter.status,
      target?.min ?? null, target?.opt_min ?? null, target?.opt_max ?? null, target?.max ?? null,
      target ? 'Configured crop-stage target' : 'No configured target'];
    row.eachCell((cell) => { cell.alignment = { vertical: 'top', wrapText: true }; });
  });
  const recommendationsStart = metricHeaderRow + params.length + 3;
  crop.mergeCells(`A${recommendationsStart}:I${recommendationsStart}`);
  crop.getCell(`A${recommendationsStart}`).value = 'System Recommendations (Rule-Based)';
  crop.getCell(`A${recommendationsStart}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  crop.getCell(`A${recommendationsStart}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14532D' } };
  const recommendations = (analysis?.recommendations || []).map((item) => [item.severity, item.category, item.message_en]);
  if (!recommendations.length) recommendations.push(['—', '—', 'No recommendations were generated from the available readings and configured thresholds.']);
  recommendations.forEach((row) => {
    const targetRow = crop.addRow([...row, '', '', '', '']);
    crop.mergeCells(`C${targetRow.number}:I${targetRow.number}`);
    targetRow.eachCell((cell) => { cell.alignment = { vertical: 'top', wrapText: true }; });
    targetRow.height = 30;
  });
  const tasksStart = crop.lastRow.number + 2;
  crop.mergeCells(`A${tasksStart}:I${tasksStart}`);
  crop.getCell(`A${tasksStart}`).value = 'Crop Tasks';
  crop.getCell(`A${tasksStart}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  crop.getCell(`A${tasksStart}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14532D' } };
  crop.addRow(['Task', 'Due date', 'Priority', 'Status', 'Created by', '', '', '', '']);
  tasks.forEach((task) => crop.addRow([task.title, task.due_on ? String(task.due_on).slice(0, 10) : '', task.priority, task.status, task.created_by_name || '', '', '', '', '']));
  crop.eachRow((row, rowNumber) => {
    if ([metricHeaderRow, recommendationsStart, tasksStart + 1].includes(rowNumber)) {
      row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
        cell.alignment = { vertical: 'middle', wrapText: true };
      });
    }
  });
  crop.views = [{ state: 'frozen', ySplit: metricHeaderRow }];
  crop.pageSetup = { paperSize: crop.PAPER_A4, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
  crop.headerFooter = { oddFooter: '&LDigital Agriculture&RPage &P of &N' };

  return workbook.xlsx.writeBuffer().then((buffer) => Buffer.from(buffer));
}

module.exports = {
  MAX_RAW_ROWS,
  MAX_SENSORS,
  buildIntervals,
  dateInTimeZone,
  makeCsv,
  makeWorkbook,
  median,
  renderTrendPng,
  readingQuality,
  reportIntervalMs,
  resolveDateRange,
  sanitizeText,
  summarize
};

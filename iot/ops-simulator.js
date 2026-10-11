// Pretends to be the field ESP32's ops channel. Usage: node iot/ops-simulator.js <ops_id> <token> [baseUrl]
const [opsId, token, base = 'http://localhost:5000'] = process.argv.slice(2);
if (!opsId || !token) { console.error('Usage: node iot/ops-simulator.js <ops_id> <token> [baseUrl]'); process.exit(1); }
const H = { 'Content-Type': 'application/json', 'X-Device-Id': opsId, 'X-Device-Token': token };
const call = async (path, body) => { const r = await fetch(`${base}/api/ops/devices/${opsId}${path}`, { method: 'POST', headers: H, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${r.status} ${j.message || ''}`); return j; };
const cfg = { readings_s: 15, health_s: 60, poll_s: 10, soil_dry: 3100, soil_wet: 1400, max_irrigation_s: 900, max_misting_s: 300, min_off_s: 30, temp_offset_c: 0, hum_offset_pct: 0, lux_scale: 1 };
let wifi = ['Farm-WiFi', 'Office-WiFi'], boot = Date.now(), reconnects = 0, rssi = -62;
const telemetry = () => call('/telemetry', { firmware: '1.1.1', sensors: { temperature: { ok: true }, humidity: { ok: true }, soil_moisture: { ok: true }, light: { ok: true } }, relays: { irrigation: false, misting: false }, config: cfg,
  health: { uptime_s: Math.round((Date.now() - boot) / 1000), rssi: (rssi += Math.round((Math.random() - 0.5) * 4)), ip: '192.168.1.50', ssid: wifi[0], wifi_saved: wifi, heap_free: 180000 - Math.round(Math.random() * 3000), heap_min: 150000, reset_reason: 'poweron', wifi_reconnects: reconnects, http_fails: 0, last_error: '', ota_state: 'success: 1.1.1', image_validated: true, pump_total_s_irrigation: 5400, pump_total_s_misting: 900 } });
const handle = async (c) => {
  console.log('command:', c.type, c.ssid || c.point || '');
  if (c.type === 'wifi_add') { wifi.push(c.ssid); return { status: 'ok', msg: 'saved' }; }
  if (c.type === 'wifi_remove') { wifi = wifi.filter((x) => x !== c.ssid); return { status: 'ok', msg: 'removed' }; }
  if (c.type === 'set_config') { Object.assign(cfg, c.config); return { status: 'ok', msg: 'applied' }; }
  if (c.type === 'calibrate_soil') { cfg[c.point === 'dry' ? 'soil_dry' : 'soil_wet'] = c.point === 'dry' ? 3150 : 1380; return { status: 'ok', msg: `${c.point} captured` }; }
  if (c.type === 'ota') return { status: 'skipped', msg: 'simulator does not flash' };
  return { status: 'ok', msg: 'done' };
};
const poll = async () => { const r = await call('/poll', {}); for (const c of r.commands) { const a = await handle(c); await call('/ack', { id: c.id, ...a }); await telemetry(); } };
const safe = (f) => f().catch((e) => console.error('error:', e.message));
safe(telemetry); setInterval(() => safe(telemetry), 60000); setInterval(() => safe(poll), 10000);
console.log('ops simulator running for', opsId);

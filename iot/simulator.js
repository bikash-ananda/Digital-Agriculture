// Usage: node iot/simulator.js <device_code> <api_key> [baseUrl]
const [code, key, base = 'http://localhost:5000'] = process.argv.slice(2);
if (!code || !key) { console.error('Usage: node iot/simulator.js <device_code> <api_key> [baseUrl]'); process.exit(1); }

const H = { 'Content-Type': 'application/json', 'X-Device-Code': code, 'X-Device-Key': key };
async function call(method, path, body) {
  const r = await fetch(`${base}/api/device${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${j.message || ''}`);
  return j;
}

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const rnd = (d) => (Math.random() - 0.5) * d;
const s = { temperature: 26, humidity: 70, soil_moisture: 45, ec: 1.4, light: 20000, water_level: 85 };
const act = {}; // actuator_id -> { type, on, offAt }

async function tick() {
  const irrigating = Object.values(act).some((a) => a.type === 'irrigation' && a.on);
  const misting = Object.values(act).some((a) => a.type === 'misting' && a.on);
  s.temperature = clamp(s.temperature + rnd(0.6) - (misting ? 0.3 : 0), 15, 40);
  s.humidity = clamp(s.humidity + rnd(1) + (misting ? 2.5 : -0.2), 20, 99);
  s.soil_moisture = clamp(s.soil_moisture + rnd(0.3) + (irrigating ? 3 : -0.4), 0, 100);
  s.ec = clamp(s.ec + rnd(0.05), 0.2, 5);
  s.light = clamp(s.light + rnd(1500), 0, 100000);
  s.water_level = clamp(s.water_level - (irrigating ? 0.5 : 0), 0, 100);

  const now = Date.now();
  const offs = [];
  for (const [id, a] of Object.entries(act)) {
    if (a.on && a.offAt <= now) { a.on = false; offs.push({ actuator_id: Number(id), state: 'off' }); console.log(`auto-off actuator ${id} (runtime limit reached)`); }
  }
  if (offs.length) await call('POST', '/state', { states: offs });

  const readings = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Math.round(v * 100) / 100]));
  const out = await call('POST', '/readings', { firmware: 'sim-1.0', readings });
  console.log(new Date().toLocaleTimeString(), 'readings stored:', out.stored, JSON.stringify(readings));

  const { commands } = await call('GET', '/commands');
  for (const c of commands) {
    act[c.actuator_id] = { type: c.actuator_type, on: c.command === 'on', offAt: c.command === 'on' ? Date.now() + c.duration_seconds * 1000 : 0 };
    await call('POST', `/commands/${c.id}/ack`, { success: true });
    console.log(`command #${c.id}: ${c.actuator_type} ${c.command.toUpperCase()}${c.command === 'on' ? ` for ${c.duration_seconds}s` : ''}`);
  }
}

const run = () => tick().catch((e) => console.error('error:', e.message));
run();
setInterval(run, 10000);

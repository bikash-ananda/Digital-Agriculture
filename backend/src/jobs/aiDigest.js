const db = require('../config/db');
const ai = require('../services/aiEngine');

const LOCAL_MS = (5 * 60 + 45) * 60000;
let busy = false;

async function run() {
  if (busy) return;
  busy = true;
  try {
    const local = new Date(Date.now() + LOCAL_MS);
    if (local.getUTCHours() < 6) return;
    const day = local.toISOString().slice(0, 10);
    const [units] = await db.query("SELECT DISTINCT gu.id FROM growing_units gu JOIN iot_devices d ON d.growing_unit_id = gu.id WHERE d.status <> 'disabled'");
    for (const u of units) {
      const [ex] = await db.query('SELECT id FROM ai_digests WHERE growing_unit_id = ? AND day = ?', [u.id, day]);
      if (ex.length) continue;
      const r = await ai.insights(u.id, 168, { fresh: true });
      if (!r.data_status.any_data) continue;
      await db.query('INSERT INTO ai_digests SET ?', [{ growing_unit_id: u.id, day, digest: JSON.stringify(r.digest), model: JSON.stringify({ models: r.models, data_status: r.data_status }) }]);
    }
  } catch (e) { console.error('[ai-digest]', e.message); } finally { busy = false; }
}

module.exports = { start() { setInterval(run, 20 * 60 * 1000); setTimeout(run, 60000); console.log('AI digest job started'); } };

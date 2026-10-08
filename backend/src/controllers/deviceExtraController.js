const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const ROOT = path.resolve(__dirname, '..', '..', 'uploads');
const KEEP = 200;

exports.config = async (req, res, next) => {
  try {
    const [sensors] = await db.query(
      `SELECT id, sensor_type, name, channel_key, unit, min_valid, max_valid FROM sensors WHERE device_id = ? AND status <> 'disabled' ORDER BY id`, [req.device.id]);
    const [actuators] = await db.query(
      `SELECT id, actuator_type, name, relay_channel, gpio_pin, max_runtime_seconds, control_mode FROM actuators WHERE device_id = ? AND status <> 'disabled' ORDER BY id`, [req.device.id]);
    const [cameras] = await db.query("SELECT id, name, camera_type FROM cameras WHERE device_id = ? AND status = 'active' ORDER BY id", [req.device.id]);
    res.json({
      device_code: req.device.code,
      sensors: sensors.map((s) => ({ ...s, key: s.channel_key || s.sensor_type })),
      actuators, cameras, report_interval_seconds: 30, poll_interval_seconds: 10, snapshot_interval_seconds: 600,
      server_time: new Date().toISOString()
    });
  } catch (e) { next(e); }
};

exports.snapshot = async (req, res, next) => {
  try {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length < 1000) return res.status(400).json({ message: 'JPEG image body required (Content-Type: image/jpeg)' });
    if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) return res.status(400).json({ message: 'Not a JPEG image' });
    const [[cam]] = await db.query("SELECT id FROM cameras WHERE id = ? AND device_id = ? AND status = 'active'", [req.params.id, req.device.id]);
    if (!cam) return res.status(404).json({ message: 'Camera not found' });

    const dir = path.join(ROOT, 'snapshots', String(cam.id));
    fs.mkdirSync(dir, { recursive: true });
    const name = `${Date.now()}.jpg`;
    fs.writeFileSync(path.join(dir, name), buf);
    await db.query('INSERT INTO camera_snapshots (camera_id, file_path, size_bytes, captured_at) VALUES (?, ?, ?, NOW())', [cam.id, `snapshots/${cam.id}/${name}`, buf.length]);
    await db.query('UPDATE cameras SET last_snapshot_at = NOW() WHERE id = ?', [cam.id]);

    const [old] = await db.query('SELECT id, file_path FROM camera_snapshots WHERE camera_id = ? ORDER BY id DESC LIMIT 100000 OFFSET ?', [cam.id, KEEP]);
    for (const o of old) { try { fs.unlinkSync(path.join(ROOT, o.file_path)); } catch (e) { /* already gone */ } }
    if (old.length) await db.query('DELETE FROM camera_snapshots WHERE id IN (?)', [old.map((o) => o.id)]);
    res.status(201).json({ stored: true, size: buf.length });
  } catch (e) { next(e); }
};

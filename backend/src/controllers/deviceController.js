const db = require('../config/db');

async function touchDevice(req, firmware) {
  await db.query(
    `UPDATE iot_devices SET last_seen_at = NOW(), status = 'online', ip_address = ?,
            firmware_version = COALESCE(?, firmware_version) WHERE id = ?`,
    [(req.ip || '').slice(0, 45), firmware || null, req.device.id]);
}

async function setActuatorState(actuatorId, state, source, commandId) {
  const [[a]] = await db.query('SELECT current_state FROM actuators WHERE id = ?', [actuatorId]);
  await db.query('UPDATE actuators SET current_state = ?, last_state_at = NOW() WHERE id = ?', [state, actuatorId]);
  if (state === 'on' && a.current_state !== 'on') {
    await db.query(
      `INSERT INTO actuator_events (actuator_id, command_id, state, trigger_source, started_at) VALUES (?, ?, 'on', ?, NOW())`,
      [actuatorId, commandId || null, source || 'device']);
  }
  if (state === 'off') {
    await db.query(
      `UPDATE actuator_events SET ended_at = NOW(), duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW())
        WHERE actuator_id = ? AND state = 'on' AND ended_at IS NULL`, [actuatorId]);
  }
}

exports.readings = async (req, res, next) => {
  try {
    const { readings, firmware } = req.body;
    const [sensors] = await db.query(
      `SELECT id, sensor_type, channel_key, calibration_offset, calibration_scale, min_valid, max_valid
         FROM sensors WHERE device_id = ? AND status <> 'disabled' ORDER BY id`, [req.device.id]);
    const byType = {};
    sensors.forEach((s) => { const k = s.channel_key || s.sensor_type; if (!byType[k]) byType[k] = s; });

    let stored = 0;
    const rejected = [];
    for (const [type, raw] of Object.entries(readings)) {
      const s = byType[type];
      if (!s) { rejected.push({ sensor_type: type, reason: 'unknown sensor' }); continue; }
      const value = Number(raw) * s.calibration_scale + s.calibration_offset;
      const bad = !Number.isFinite(value) || (s.min_valid !== null && value < s.min_valid) || (s.max_valid !== null && value > s.max_valid);
      if (bad) { rejected.push({ sensor_type: type, reason: 'out of valid range' }); continue; }
      await db.query('INSERT INTO sensor_readings (sensor_id, value, recorded_at) VALUES (?, ?, NOW(3))', [s.id, value]);
      await db.query('UPDATE sensors SET sensor_value = ?, last_sensor_reading_at = NOW() WHERE id = ?', [value, s.id]);
      stored++;
    }
    await touchDevice(req, firmware);
    res.json({ stored, rejected, server_time: new Date().toISOString() });
  } catch (e) { next(e); }
};

exports.commands = async (req, res, next) => {
  try {
    await touchDevice(req);
    await db.query(
      `UPDATE actuator_commands c JOIN actuators a ON a.id = c.actuator_id
          SET c.status = 'expired'
        WHERE a.device_id = ? AND c.status = 'pending' AND c.expires_at IS NOT NULL AND c.expires_at < NOW()`, [req.device.id]);
    await db.query(
      `UPDATE actuator_commands c JOIN actuators a ON a.id = c.actuator_id
          SET c.status = 'failed', c.error_message = 'No acknowledgement from device'
        WHERE a.device_id = ? AND c.status = 'sent' AND c.sent_at < (NOW() - INTERVAL 2 MINUTE)`, [req.device.id]);

    const [rows] = await db.query(
      `SELECT c.id, c.actuator_id, a.actuator_type, c.command, c.duration_seconds, a.max_runtime_seconds
         FROM actuator_commands c JOIN actuators a ON a.id = c.actuator_id
        WHERE a.device_id = ? AND c.status = 'pending' AND a.status = 'active'
        ORDER BY c.id LIMIT 10`, [req.device.id]);

    const commands = rows.map((c) => ({
      id: c.id, actuator_id: c.actuator_id, actuator_type: c.actuator_type, command: c.command,
      duration_seconds: c.command === 'on' ? Math.min(c.duration_seconds || c.max_runtime_seconds, c.max_runtime_seconds) : 0
    }));
    if (commands.length) {
      await db.query("UPDATE actuator_commands SET status = 'sent', sent_at = NOW() WHERE id IN (?)", [commands.map((c) => c.id)]);
    }
    res.json({ commands, server_time: new Date().toISOString() });
  } catch (e) { next(e); }
};

exports.ack = async (req, res, next) => {
  try {
    const [[c]] = await db.query(
      `SELECT c.id, c.actuator_id, c.command, c.source, c.status
         FROM actuator_commands c JOIN actuators a ON a.id = c.actuator_id
        WHERE c.id = ? AND a.device_id = ?`, [req.params.id, req.device.id]);
    if (!c) return res.status(404).json({ message: 'Command not found' });
    if (c.status === 'acknowledged' || c.status === 'failed') return res.json({ message: 'Already processed' });

    if (req.body.success) {
      await db.query("UPDATE actuator_commands SET status = 'acknowledged', acknowledged_at = NOW() WHERE id = ?", [c.id]);
      await setActuatorState(c.actuator_id, c.command, c.source, c.id);
    } else {
      const msg = (req.body.error || 'Device reported failure').slice(0, 255);
      await db.query("UPDATE actuator_commands SET status = 'failed', error_message = ? WHERE id = ?", [msg, c.id]);
      await db.query(
        `INSERT INTO alerts (device_id, growing_unit_id, severity, message) VALUES (?, ?, 'critical', ?)`,
        [req.device.id, req.device.growing_unit_id, `Actuator command failed on ${req.device.code}: ${msg}`]);
    }
    res.json({ message: 'OK' });
  } catch (e) { next(e); }
};

exports.state = async (req, res, next) => {
  try {
    for (const s of req.body.states) {
      const [[a]] = await db.query('SELECT id FROM actuators WHERE id = ? AND device_id = ?', [s.actuator_id, req.device.id]);
      if (a) await setActuatorState(a.id, s.state, 'device', null);
    }
    await touchDevice(req);
    res.json({ message: 'OK' });
  } catch (e) { next(e); }
};



const express = require('express');
const crypto = require('crypto');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const chatHub = require('../services/smartChatHub');

const router = express.Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNAL_TYPES = new Set(['chat-invite', 'description', 'ice', 'call-invite', 'call-accept', 'call-reject', 'call-end']);

function iceServersFor(userId) {
  const servers = [{ urls: 'stun:stun.l.google.com:19302' }];
  const turnUrls = String(process.env.TURN_URLS || '').split(',').map((value) => value.trim()).filter(Boolean);
  const sharedSecret = String(process.env.TURN_SHARED_SECRET || '');
  if (turnUrls.length && sharedSecret) {
    const ttl = Math.min(Math.max(Number.parseInt(process.env.TURN_CREDENTIAL_TTL_SECONDS, 10) || 3600, 300), 86400);
    const username = `${Math.floor(Date.now() / 1000) + ttl}:${userId}`;
    const credential = crypto.createHmac('sha1', sharedSecret).update(username).digest('base64');
    servers.push({ urls: turnUrls, username, credential });
  }
  return servers;
}

router.get('/ice-config', authenticate, authorize('smart_farming.view'), (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ iceServers: iceServersFor(req.user.id) });
});

router.get('/contacts', authenticate, authorize('smart_farming.view'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.full_name_en, u.full_name_ne, u.position_title
         FROM users u
        WHERE u.status = 'active'
          AND u.id <> ?
          AND u.organization_id <=> ?
          AND EXISTS (
            SELECT 1
              FROM user_roles ur
              JOIN role_permissions rp ON rp.role_id = ur.role_id
              JOIN permissions p ON p.id = rp.permission_id
             WHERE ur.user_id = u.id AND p.code = 'smart_farming.view'
          )
        ORDER BY u.full_name_en
        LIMIT 100`,
      [req.user.id, req.user.organization_id]
    );

    res.json(rows.map((row) => ({
      id: String(row.id),
      nameEn: row.full_name_en,
      nameNe: row.full_name_ne,
      title: row.position_title,
      onlineSessions: chatHub.onlineSessions(row.id)
    })));
  } catch (err) { next(err); }
});

router.get('/events', authenticate, authorize('smart_farming.view'), (req, res) => {
  const { deviceId, sessionId } = req.query;
  if (typeof deviceId !== 'string' || !UUID_RE.test(deviceId) ||
      typeof sessionId !== 'string' || !UUID_RE.test(sessionId)) {
    return res.status(400).json({ message: 'A valid device and session ID are required' });
  }
  if (chatHub.connectionCount(req.user.id) >= 8) {
    return res.status(429).json({ message: 'Too many chat sessions are open for this account' });
  }

  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  chatHub.addClient({
    userId: req.user.id,
    deviceId,
    sessionId,
    response: res
  });
});

router.post('/signal', authenticate, authorize('smart_farming.view'), async (req, res, next) => {
  try {
    const { toUserId, toSessionId, fromDeviceId, fromSessionId, type, payload } = req.body || {};
    const recipientId = Number(toUserId);

    if (!Number.isSafeInteger(recipientId) || recipientId <= 0 || recipientId === Number(req.user.id) ||
        typeof toSessionId !== 'string' || !UUID_RE.test(toSessionId) ||
        typeof fromDeviceId !== 'string' || !UUID_RE.test(fromDeviceId) ||
        typeof fromSessionId !== 'string' || !UUID_RE.test(fromSessionId) ||
        !SIGNAL_TYPES.has(type) || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return res.status(400).json({ message: 'Invalid signaling request' });
    }

    if (JSON.stringify(payload).length > 65536) {
      return res.status(413).json({ message: 'Signaling payload is too large' });
    }

    if (type === 'description' && (!payload.description ||
        !['offer', 'answer'].includes(payload.description.type) ||
        typeof payload.description.sdp !== 'string')) {
      return res.status(400).json({ message: 'Invalid WebRTC description' });
    }
    if (type === 'ice' && payload.candidate !== null &&
        (!payload.candidate || typeof payload.candidate !== 'object')) {
      return res.status(400).json({ message: 'Invalid ICE candidate' });
    }
    if (type.startsWith('call-') && (typeof payload.callId !== 'string' || !UUID_RE.test(payload.callId))) {
      return res.status(400).json({ message: 'Invalid call ID' });
    }
    if (type === 'call-invite' && !['audio', 'video'].includes(payload.media)) {
      return res.status(400).json({ message: 'Call type must be audio or video' });
    }
    if (type === 'chat-invite' && typeof payload.conversationId !== 'string') {
      return res.status(400).json({ message: 'Invalid conversation ID' });
    }

    if (!chatHub.hasSession(req.user.id, fromSessionId, fromDeviceId)) {
      return res.status(409).json({ message: 'Your chat session is no longer connected' });
    }

    const [recipients] = await db.query(
      `SELECT id
         FROM users
        WHERE id = ? AND status = 'active' AND organization_id <=> ?
        LIMIT 1`,
      [recipientId, req.user.organization_id]
    );
    if (!recipients.length) return res.status(404).json({ message: 'Contact not found' });
    if (!chatHub.hasSession(recipientId, toSessionId)) {
      return res.status(409).json({ message: 'Contact is offline on that device' });
    }

    const delivered = chatHub.sendTo({
      userId: recipientId,
      sessionId: toSessionId,
      event: {
        type,
        fromUserId: String(req.user.id),
        fromName: req.user.full_name_en || req.user.username,
        fromDeviceId,
        fromSessionId,
        payload,
        sentAt: Date.now()
      }
    });

    if (!delivered) return res.status(409).json({ message: 'Contact is offline on that device' });
    res.status(202).json({ delivered: true });
  } catch (err) { next(err); }
});

module.exports = router;

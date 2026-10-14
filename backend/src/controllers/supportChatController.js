const crypto = require('crypto');
const { randomUUID } = require('crypto');
const db = require('../config/db');
const { notifyDeveloper, validateTwilioSignature, configured: whatsappConfigured } = require('../services/supportWhatsApp');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const tokenFrom = (req) => String(req.get('x-support-token') || '');
const validToken = (token) => /^[A-Za-z0-9_-]{43,64}$/.test(token);
const trustedAdmin = () => String(process.env.SUPPORT_WHATSAPP_ADMIN || process.env.SUPER_ADMIN_PHONE || '')
  .replace(/^whatsapp:/i, '').replace(/[\s()-]/g, '').trim();
const emptyTwiml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

async function findOwnedConversation(req) {
  const token = tokenFrom(req);
  if (!validToken(token)) return null;
  const [rows] = await db.query(
    'SELECT id, short_code, status FROM support_conversations WHERE id = ? AND access_token_hash = ? LIMIT 1',
    [req.params.id, hashToken(token)]
  );
  return rows[0] || null;
}

exports.createConversation = async (req, res, next) => {
  try {
    const id = randomUUID();
    const accessToken = crypto.randomBytes(32).toString('base64url');
    const shortCode = crypto.randomBytes(5).toString('hex').toUpperCase();
    await db.query(
      'INSERT INTO support_conversations (id, access_token_hash, short_code) VALUES (?, ?, ?)',
      [id, hashToken(accessToken), shortCode]
    );
    res.status(201).json({ id, accessToken, shortCode, whatsappReady: whatsappConfigured() });
  } catch (error) { next(error); }
};

exports.messages = async (req, res, next) => {
  try {
    const conversation = await findOwnedConversation(req);
    if (!conversation) return res.status(404).json({ message: 'Chat session not found. Start a new conversation.' });
    const after = req.query.after || '0';
    const [rows] = await db.query(
      `SELECT CAST(id AS CHAR) AS id, sender, body, created_at
         FROM support_messages WHERE conversation_id = ? AND id > ?
        ORDER BY id ASC LIMIT 100`, [conversation.id, after]
    );
    res.json({ messages: rows, whatsappReady: whatsappConfigured() });
  } catch (error) { next(error); }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const conversation = await findOwnedConversation(req);
    if (!conversation) return res.status(404).json({ message: 'Chat session not found. Start a new conversation.' });
    if (conversation.status !== 'open') return res.status(410).json({ message: 'This chat has been closed. Start a new conversation.' });

    const body = req.body.body.trim();
    const [insert] = await db.query(
      'INSERT INTO support_messages (conversation_id, sender, body) VALUES (?, \'visitor\', ?)',
      [conversation.id, body]
    );
    await db.query('UPDATE support_conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?', [conversation.id]);

    const notification = await notifyDeveloper({ shortCode: conversation.short_code, body });
    if (notification.messageSid) {
      await db.query('UPDATE support_conversations SET whatsapp_notification_sid = ? WHERE id = ?', [notification.messageSid, conversation.id]);
    }
    const [rows] = await db.query(
      'SELECT CAST(id AS CHAR) AS id, sender, body, created_at FROM support_messages WHERE id = ?', [insert.insertId]
    );
    res.status(201).json({ message: rows[0], notification: notification.sent ? 'sent' : 'pending_setup' });
  } catch (error) { next(error); }
};

exports.whatsappInbound = async (req, res) => {
  res.type('text/xml');
  if (!validateTwilioSignature(req)) return res.status(403).send(emptyTwiml);

  const from = String(req.body.From || '').replace(/^whatsapp:/i, '').replace(/\s/g, '');
  const to = String(req.body.To || '').replace(/^whatsapp:/i, '').replace(/\s/g, '');
  const configuredSender = String(process.env.TWILIO_WHATSAPP_FROM || '').replace(/^whatsapp:/i, '').replace(/\s/g, '');
  if (from !== trustedAdmin() || !configuredSender || to !== configuredSender) return res.status(200).send(emptyTwiml);

  const body = String(req.body.Body || '').trim().slice(0, 2000);
  if (!body) return res.status(200).send(emptyTwiml);

  try {
    const providerSid = String(req.body.MessageSid || '').trim();
    if (providerSid) {
      const [duplicate] = await db.query('SELECT id FROM support_messages WHERE provider_message_sid = ? LIMIT 1', [providerSid]);
      if (duplicate.length) return res.status(200).send(emptyTwiml);
    }
    let conversation;
    const replyToSid = String(req.body.OriginalRepliedMessageSid || '').trim();
    if (replyToSid) {
      const [rows] = await db.query(
        'SELECT id FROM support_conversations WHERE whatsapp_notification_sid = ? AND status = \'open\' LIMIT 1', [replyToSid]
      );
      conversation = rows[0];
    }
    if (!conversation) {
      const match = body.match(/^#([A-F0-9]{10})\s+([\s\S]+)$/i);
      if (match) {
        const [rows] = await db.query(
          'SELECT id FROM support_conversations WHERE short_code = ? AND status = \'open\' LIMIT 1', [match[1].toUpperCase()]
        );
        conversation = rows[0];
        if (conversation) req.body.Body = match[2];
      }
    }
    if (conversation) {
      await db.query(
        'INSERT INTO support_messages (conversation_id, sender, body, provider_message_sid) VALUES (?, \'developer\', ?, ?)',
        [conversation.id, String(req.body.Body).trim().slice(0, 2000), providerSid || null]
      );
      await db.query('UPDATE support_conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?', [conversation.id]);
    }
    return res.status(200).send(emptyTwiml);
  } catch (error) {
    console.error('[support-chat] WhatsApp inbound message could not be stored', error.code || error.name);
    return res.status(500).send(emptyTwiml);
  }
};

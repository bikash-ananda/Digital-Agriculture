const crypto = require('crypto');

const senderAddress = () => {
  const sender = String(process.env.TWILIO_WHATSAPP_FROM || '').trim();
  return sender ? (sender.startsWith('whatsapp:') ? sender : `whatsapp:${sender}`) : '';
};

const adminAddress = () => {
  const address = String(process.env.SUPPORT_WHATSAPP_ADMIN || process.env.SUPER_ADMIN_PHONE || '')
    .replace(/^whatsapp:/i, '').replace(/[\s()-]/g, '').trim();
  return /^\+[1-9]\d{7,14}$/.test(address) ? `whatsapp:${address}` : '';
};

const contentSid = () => String(process.env.TWILIO_SUPPORT_CONTENT_SID || process.env.TWILIO_WHATSAPP_CONTENT_SID || '').trim();

const webhookUrl = () => {
  const explicit = String(process.env.TWILIO_SUPPORT_WEBHOOK_URL || '').trim();
  if (explicit) return explicit;
  const base = String(process.env.PUBLIC_BASE_URL || '').trim();
  if (!base) return '';
  try { return new URL('/api/support-chat/whatsapp/inbound', base).toString(); }
  catch { return ''; }
};

const webhookReady = () => {
  try {
    const url = new URL(webhookUrl());
    return url.protocol === 'https:'
      && url.pathname.endsWith('/api/support-chat/whatsapp/inbound')
      && url.hostname !== 'your-domain.example';
  } catch { return false; }
};

const configured = () => Boolean(
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && senderAddress()
  && adminAddress() && contentSid() && webhookReady()
);

async function notifyDeveloper({ shortCode, body }) {
  if (!configured()) return { sent: false, reason: 'not_configured' };

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const payload = { To: adminAddress(), From: senderAddress() };
  payload.ContentSid = contentSid();
  payload.ContentVariables = JSON.stringify({ '1': shortCode, '2': body.slice(0, 1000) });

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const authorization = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(payload),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      console.error(`[support-chat] WhatsApp notification failed (${response.status})`);
      return { sent: false, reason: 'provider_rejected' };
    }
    const result = await response.json();
    return { sent: true, messageSid: result.sid };
  } catch (error) {
    console.error(`[support-chat] WhatsApp notification failed (${error.name || 'network error'})`);
    return { sent: false, reason: 'provider_unavailable' };
  }
}

function validateTwilioSignature(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.get('x-twilio-signature') || '';
  if (!authToken || !signature) return false;

  const url = webhookUrl() || `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  let signedData = url;
  for (const key of Object.keys(req.body || {}).sort()) {
    const values = Array.isArray(req.body[key]) ? [...req.body[key]].sort() : [req.body[key]];
    for (const value of values) signedData += key + String(value ?? '');
  }

  const expected = crypto.createHmac('sha1', authToken).update(signedData, 'utf8').digest('base64');
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(signature);
  return expectedBytes.length === suppliedBytes.length && crypto.timingSafeEqual(expectedBytes, suppliedBytes);
}

module.exports = { notifyDeveloper, validateTwilioSignature, configured, webhookUrl };

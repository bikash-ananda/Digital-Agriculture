const maskPhone = (phone) => String(phone || '').replace(/.(?=.{4})/g, '•');
const whatsappSender = () => {
  const sender = String(process.env.TWILIO_WHATSAPP_FROM || '').trim();
  return sender.startsWith('whatsapp:') ? sender : sender ? `whatsapp:${sender}` : '';
};
const configured = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && whatsappSender());

async function sendOtp({ to, code, purpose, minutes = 10 }) {
  const body = purpose === 'password_reset'
    ? `Your Digital Agriculture password reset code is ${code}. It expires in ${minutes} minutes.`
    : `Your Digital Agriculture verification code is ${code}. It expires in ${minutes} minutes.`;
  if (!configured()) {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[dev-otp] WhatsApp ${maskPhone(to)} ${purpose}: ${code} (expires in ${minutes} minutes)`);
      return { sent: false, mode: 'console', reason: 'not_configured' };
    }
    console.error('[whatsapp] Twilio WhatsApp is not configured; mobile OTP was not sent');
    return { sent: false, reason: 'not_configured' };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const message = { To: `whatsapp:${to}`, From: whatsappSender() };
  if (process.env.TWILIO_WHATSAPP_CONTENT_SID) {
    message.ContentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID;
    message.ContentVariables = JSON.stringify({ '1': code, '2': String(minutes) });
  } else {
    message.Body = body;
  }
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(message),
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) {
      console.error(`[whatsapp] provider rejected message (${response.status}) for ${maskPhone(to)}`);
      return { sent: false, reason: 'send_failed' };
    }
    return { sent: true, mode: 'whatsapp' };
  } catch (err) {
    console.error(`[whatsapp] delivery failed for ${maskPhone(to)} (${err.name || 'network error'})`);
    if (process.env.NODE_ENV === 'development') {
      console.info(`[dev-otp] WhatsApp ${maskPhone(to)} ${purpose}: ${code} (expires in ${minutes} minutes)`);
      return { sent: false, mode: 'console', reason: 'send_failed' };
    }
    return { sent: false, reason: 'send_failed' };
  }
}

module.exports = { sendOtp, configured };

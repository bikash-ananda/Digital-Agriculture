const nodemailer = require('nodemailer');

let transporter = null;
const configured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const maskEmail = (e) => String(e || '').replace(/^(.).*(@.*)$/, '$1***$2');

function get() {
  if (!configured()) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure, requireTLS: !secure,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
    });
  }
  return transporter;
}

async function send({ to, subject, text, html }) {
  const t = get();
  if (!t) { console.warn(`[mail] SMTP is not configured: the email to ${maskEmail(to)} was NOT sent`); return { sent: false, reason: 'not_configured' }; }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html });
    return { sent: true, mode: 'email' };
  } catch (e) {
    console.error(`[mail] sending to ${maskEmail(to)} failed (${e.code || 'SMTP error'})`);
    return { sent: false, reason: 'send_failed' };
  }
}

function shell(inner) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#17261e;line-height:1.55"><div style="border-top:4px solid #c8102e;border-bottom:2px solid #003893;padding:12px 0;font-weight:bold;color:#123221">कृषि विकास कार्यालय, कास्की — Digital Agriculture</div>${inner}</div>`;
}

function resetEmail({ name, link, minutes }) {
  const subject = 'Reset your password / पासवर्ड रिसेट — Digital Agriculture Kaski';
  const text = `Hello ${name},\n\nWe received a request to reset the password of your account.\nOpen this link within ${minutes} minutes to choose a new password:\n${link}\n\nIf you did not ask for this, ignore this email. Your password stays the same.\n`;
  const html = shell(`<p>Hello ${esc(name)},</p><p>We received a request to reset your password. This link works for ${minutes} minutes and only once.</p><p><a href="${esc(link)}" style="display:inline-block;background:#1b4a2f;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Choose a new password</a></p><p>If you did not ask for this, ignore this email. Your password stays the same.</p>`);
  return { subject, text, html };
}

function passwordChangedEmail({ name }) {
  const subject = 'Your password was changed / तपाईंको पासवर्ड परिवर्तन भयो';
  const text = `Hello ${name},\n\nThe password of your account was just changed. If this was you, no action is needed. If it was not you, contact the office administrator immediately.\n`;
  return { subject, text, html: shell(`<p>Hello ${esc(name)},</p><p>The password of your account was just changed. If this was you, no action is needed. If it was not you, contact the office administrator immediately.</p>`) };
}

async function sendOtp({ to, code, purpose, minutes = 10 }) {
  const isReset = purpose === 'password_reset';
  const subject = isReset ? 'Your password reset code — Digital Agriculture' : 'Verify your Digital Agriculture account';
  const action = isReset ? 'reset your password' : 'verify your email address';
  const text = `Your Digital Agriculture code is ${code}. Use it to ${action} within ${minutes} minutes. If you did not request this, ignore this message.`;
  const html = shell(`<p>Your Digital Agriculture verification code:</p><p style="font-size:30px;font-weight:bold;letter-spacing:8px;color:#123221">${esc(code)}</p><p>Use this code to ${action} within ${minutes} minutes. It can be used only once.</p><p>If you did not request this, ignore this message.</p>`);
  const result = await send({ to, subject, text, html });
  if (result.sent) return result;
  if (process.env.NODE_ENV === 'development') {
    console.info(`[dev-otp] email ${maskEmail(to)} ${purpose}: ${code} (expires in ${minutes} minutes)`);
    return { sent: false, mode: 'console', reason: result.reason };
  }
  return result;
}

module.exports = { send, configured, maskEmail, resetEmail, passwordChangedEmail, sendOtp };
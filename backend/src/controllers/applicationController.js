const crypto = require('crypto');
const db = require('../config/db');
const mailer = require('../services/mailer');
const sms = require('../services/sms');
const { logAudit } = require('../utils/audit');
const { listTypes, getType, checkApplication, normalizePhone } = require('../services/applicationTypes');

const SECRET = () => process.env.OTP_SECRET || process.env.JWT_SECRET;
const OFFICE_EMAIL = () => process.env.APPLICATIONS_NOTIFY_EMAIL || 'adokaski@gmail.com';
const BASE = () => (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
const STATUSES = ['received', 'under_review', 'needs_info', 'forwarded', 'resolved', 'rejected'];
const OTP_MAX_ATTEMPTS = 5;
const otpRequired = () => sms.configured();

const hmac = (text) => crypto.createHmac('sha256', SECRET()).update(text).digest('hex');
const otpHash = (phone, code) => hmac(`application-otp:${phone}:${code}`);
const trackHash = (refNo, code) => hmac(`application-track:${refNo}:${String(code).toUpperCase()}`);
const safeEqual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const newTrackingCode = () => { const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; return Array.from({ length: 10 }, () => alphabet[crypto.randomInt(alphabet.length)]).join(''); };
const maskPhone = (p) => String(p || '').replace(/.(?=.{3})/g, '•');

exports.types = (req, res) => res.json({ types: listTypes(), otpRequired: otpRequired() });

// Rules-based check: tells the applicant exactly what is still missing or wrong.
exports.check = (req, res) => {
  const r = checkApplication(req.body && req.body.type, req.body && req.body.data);
  if (r.error) return res.status(422).json({ message: r.error });
  res.json({ complete: !r.missing.length && !r.invalid.length, missing: r.missing, invalid: r.invalid });
};

exports.sendOtp = async (req, res, next) => {
  try {
    if (!otpRequired()) return res.json({ otpRequired: false });
    const phone = normalizePhone(req.body && req.body.phone);
    if (!phone) return res.status(422).json({ message: 'Enter a valid mobile number' });
    const [[recent]] = await db.query(
      `SELECT COUNT(*) AS n FROM application_otps WHERE phone = ? AND created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR)`, [phone]);
    if (recent.n >= 3) return res.status(429).json({ message: 'Too many codes requested. Please try again later.' });
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await db.query(
      `INSERT INTO application_otps (phone, code_hash, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))`,
      [phone, otpHash(phone, code)]);
    const out = await sms.sendOtp({ to: phone, code, purpose: 'application', minutes: 10 });
    if (!out.sent) return res.status(503).json({ message: 'We could not send the code. Please try again or contact the office.' });
    res.json({ otpRequired: true, sent: true, phone: maskPhone(phone) });
  } catch (e) { next(e); }
};

async function consumeOtp(conn, phone, code) {
  const [[otp]] = await conn.query(
    `SELECT id, code_hash, attempts FROM application_otps
      WHERE phone = ? AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP() ORDER BY id DESC LIMIT 1 FOR UPDATE`, [phone]);
  if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) return false;
  if (!code || !safeEqual(otp.code_hash, otpHash(phone, String(code).trim()))) {
    await conn.query('UPDATE application_otps SET attempts = attempts + 1 WHERE id = ?', [otp.id]);
    return false;
  }
  await conn.query('UPDATE application_otps SET consumed_at = UTC_TIMESTAMP() WHERE id = ?', [otp.id]);
  return true;
}

exports.submit = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { type, data, otp_code: otpCode, confirmed } = req.body || {};
    const r = checkApplication(type, data);
    if (r.error) return res.status(422).json({ message: r.error });
    if (r.missing.length || r.invalid.length) return res.status(422).json({ message: 'Application is incomplete', missing: r.missing, invalid: r.invalid });
    if (confirmed !== true) return res.status(422).json({ message: 'Please review and confirm your application before sending' });

    const v = r.values;
    await conn.beginTransaction();
    let verified = 0;
    if (otpRequired()) {
      if (!(await consumeOtp(conn, v.phone, otpCode))) {
        await conn.commit(); // keep the failed-attempt counter
        return res.status(422).json({ message: 'The verification code is wrong or has expired', code: 'OTP_INVALID' });
      }
      verified = 1;
    }
    const tracking = newTrackingCode();
    const [ins] = await conn.query(
      `INSERT INTO applications (uuid, tracking_hash, type_code, applicant_name, phone, phone_verified, municipality, ward, data)
       VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), r.type.code, v.full_name, v.phone, verified, v.municipality, v.ward, JSON.stringify(v)]);
    const refNo = `ADO-${new Date().getUTCFullYear()}-${String(ins.insertId).padStart(5, '0')}`;
    await conn.query('UPDATE applications SET ref_no = ?, tracking_hash = ? WHERE id = ?', [refNo, trackHash(refNo, tracking), ins.insertId]);
    await conn.query(`INSERT INTO application_events (application_id, status, note, is_public) VALUES (?, 'received', 'Application received', 1)`, [ins.insertId]);
    await conn.commit();

    // Notify the office. Personal details stay in the inbox, not in the email.
    const link = BASE() ? `${BASE()}/app/applications` : '';
    mailer.send({
      to: OFFICE_EMAIL(),
      subject: `New application ${refNo} — ${r.type.en}`,
      text: `A new application was received.\n\nReference: ${refNo}\nType: ${r.type.en} (${r.type.ne})\nPhone verified: ${verified ? 'yes' : 'no'}\n\nOpen the staff inbox to read it${link ? `:\n${link}` : '.'}\n`
    }).catch(() => {});
    res.status(201).json({ ref_no: refNo, tracking_code: tracking, phone_verified: !!verified });
  } catch (e) { try { await conn.rollback(); } catch { /* ignore */ } next(e); }
  finally { conn.release(); }
};

exports.track = async (req, res, next) => {
  try {
    const refNo = String((req.body && req.body.ref_no) || '').trim().toUpperCase();
    const code = String((req.body && req.body.tracking_code) || '').trim();
    const generic = { message: 'No application matches those details' };
    if (!refNo || !code) return res.status(404).json(generic);
    const [[app]] = await db.query('SELECT id, tracking_hash, type_code, status, created_at, updated_at FROM applications WHERE ref_no = ? LIMIT 1', [refNo]);
    if (!app || !safeEqual(app.tracking_hash, trackHash(refNo, code))) return res.status(404).json(generic);
    const [events] = await db.query('SELECT status, note, created_at FROM application_events WHERE application_id = ? AND is_public = 1 ORDER BY id', [app.id]);
    const t = getType(app.type_code);
    res.json({ ref_no: refNo, type: t ? { ne: t.ne, en: t.en } : null, status: app.status, submitted_at: app.created_at, updated_at: app.updated_at, events });
  } catch (e) { next(e); }
};

// ---- Staff ----
exports.list = async (req, res, next) => {
  try {
    const where = [], args = [];
    if (STATUSES.includes(req.query.status)) { where.push('status = ?'); args.push(req.query.status); }
    if (req.query.q) { where.push('(ref_no LIKE ? OR applicant_name LIKE ? OR phone LIKE ?)'); const q = `%${String(req.query.q).slice(0, 60)}%`; args.push(q, q, q); }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1), size = 25;
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM applications ${clause}`, args);
    const [rows] = await db.query(
      `SELECT id, ref_no, type_code, applicant_name, phone, phone_verified, municipality, ward, status, assigned_to, created_at
         FROM applications ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`, [...args, size, (page - 1) * size]);
    res.json({ total, page, size, rows });
  } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try {
    const [[app]] = await db.query('SELECT id, ref_no, type_code, applicant_name, phone, phone_verified, municipality, ward, data, status, assigned_to, channel, created_at, updated_at FROM applications WHERE id = ?', [req.params.id]);
    if (!app) return res.status(404).json({ message: 'Application not found' });
    const [events] = await db.query('SELECT status, note, is_public, created_by, created_at FROM application_events WHERE application_id = ? ORDER BY id', [app.id]);
    let data = {}; try { data = JSON.parse(app.data); } catch { /* corrupt row */ }
    await logAudit(req.user.id, 'applications.view', 'application', app.id, null, req);
    res.json({ ...app, data, type: getType(app.type_code), events });
  } catch (e) { next(e); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status, note, is_public: isPublic } = req.body || {};
    if (!STATUSES.includes(status)) return res.status(422).json({ message: 'Invalid status' });
    const text = String(note || '').trim().slice(0, 2000);
    if (status === 'needs_info' && !text) return res.status(422).json({ message: 'Tell the applicant what information is needed' });
    const [r] = await db.query('UPDATE applications SET status = ?, assigned_to = COALESCE(assigned_to, ?) WHERE id = ?', [status, req.user.id, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Application not found' });
    await db.query('INSERT INTO application_events (application_id, status, note, is_public, created_by) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, status, text || null, isPublic ? 1 : 0, req.user.id]);
    await logAudit(req.user.id, 'applications.status', 'application', req.params.id, { status }, req);
    res.json({ id: Number(req.params.id), status });
  } catch (e) { next(e); }
};

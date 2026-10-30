const db = require('../config/db');
const { logAudit } = require('../utils/audit');

const KEYS = ['office', 'officers', 'staff', 'usefulLinks'];

const str = (v, max = 300) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max) : '');
const bi = (v, max = 300) => ({ ne: str(v && v.ne, max), en: str(v && v.en, max) });
const lines = (v, max = 600, n = 20) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);
const bilines = (v, max, n) => ({ ne: lines(v && v.ne, max, n), en: lines(v && v.en, max, n) });
const pairs = (v, n = 20) => (Array.isArray(v) ? v.map((p) => [str(p && p[0], 150), str(p && p[1], 800)]).filter((p) => p[0] || p[1]).slice(0, n) : []);
const phone = (v) => { const s = str(v, 30); return /^[0-9०-९+\-\s()]*$/.test(s) ? s : ''; };
const email = (v) => { const s = str(v, 150); return !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : ''; };
const url = (v) => { const s = str(v, 500); return /^https?:\/\/[^\s]+$/i.test(s) ? s : ''; };
const num = (v, min, max) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : null; };

const SANITIZE = {
  office(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Office information must be an object');
    const out = {
      name: bi(v.name), province: bi(v.province), ministry: bi(v.ministry), city: bi(v.city),
      phone: phone(v.phone), email: email(v.email), website: url(v.website), facebook: url(v.facebook),
      hours: bilines(v.hours, 300, 10), intro: bilines(v.intro, 1500, 6),
      responsibilities: { ne: pairs(v.responsibilities && v.responsibilities.ne), en: pairs(v.responsibilities && v.responsibilities.en) },
      workArea: bi(v.workArea, 600)
    };
    const lat = num(v.lat, -90, 90), lng = num(v.lng, -180, 180);
    if (lat !== null) out.lat = lat;
    if (lng !== null) out.lng = lng;
    if (!out.name.ne && !out.name.en) throw new Error('Office name is required');
    return out;
  },
  officers(v) {
    if (!Array.isArray(v)) throw new Error('Officers must be a list');
    return v.slice(0, 30).map((o) => ({ role: bi(o && o.role, 120), name: str(o && o.name, 150), post: str(o && o.post, 200), phone: phone(o && o.phone), email: email(o && o.email) })).filter((o) => o.name);
  },
  staff(v) {
    if (!Array.isArray(v)) throw new Error('Staff must be a list');
    return v.slice(0, 150).map((s) => ({ name: str(s && s.name, 150), post: str(s && s.post, 200), group: str(s && s.group, 100), phone: phone(s && s.phone), email: email(s && s.email) })).filter((s) => s.name);
  },
  usefulLinks(v) {
    if (!Array.isArray(v)) throw new Error('Links must be a list');
    return v.slice(0, 30).map((l) => [str(l && l[0], 200), url(l && l[1])]).filter((l) => l[0] && l[1]);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT content_key, content FROM site_content');
    const out = {};
    for (const r of rows) { try { out[r.content_key] = JSON.parse(r.content); } catch { /* skip corrupt row */ } }
    res.set('Cache-Control', 'no-store').json(out);
  } catch (e) { next(e); }
};

exports.save = async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!KEYS.includes(key)) return res.status(404).json({ message: 'Unknown content section' });
    let clean;
    try { clean = SANITIZE[key](req.body && req.body.value); } catch (e) { return res.status(422).json({ message: e.message }); }
    await db.query(
      `INSERT INTO site_content (content_key, content, updated_by) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE content = VALUES(content), updated_by = VALUES(updated_by)`,
      [key, JSON.stringify(clean), req.user.id]);
    await logAudit(req.user.id, 'site_content.update', 'site_content', key, null, req);
    res.json({ key, value: clean });
  } catch (e) { next(e); }
};

exports.reset = async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!KEYS.includes(key)) return res.status(404).json({ message: 'Unknown content section' });
    await db.query('DELETE FROM site_content WHERE content_key = ?', [key]);
    await logAudit(req.user.id, 'site_content.reset', 'site_content', key, null, req);
    res.json({ key, reset: true });
  } catch (e) { next(e); }
};

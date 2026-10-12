export const apiMessages = (err) => {
  const d = err && err.response && err.response.data;
  if (d && Array.isArray(d.errors) && d.errors.length) return d.errors.map((x) => x.message);
  if (d && d.message) return [d.message];
  return [err && err.response ? 'Request failed' : 'Cannot reach the server. Check the connection and try again.'];
};

const COMMON = ['password', 'password1', 'password123', 'qwerty', 'qwerty123', '123456789', '1234567890', '0123456789', '9876543210', 'admin123', 'letmein', 'welcome123', 'nepal123', 'kaski123', 'pokhara123', 'greenhouse123', 'changeme123'];
const isSeq = (s) => {
  if (s.length < 6) return false;
  let up = true; let down = true;
  for (let i = 1; i < s.length; i++) { const d = s.charCodeAt(i) - s.charCodeAt(i - 1); if (d !== 1) up = false; if (d !== -1) down = false; }
  return up || down;
};

export function passwordHints(pw, ctx = {}) {
  const lower = pw.toLowerCase();
  const bits = [ctx.username, String(ctx.email || '').split('@')[0]].filter((x) => x && x.length >= 4).map((x) => x.toLowerCase());
  return [
    { ok: pw.length >= 10, ne: 'कम्तीमा १० अक्षर', en: 'At least 10 characters' },
    { ok: pw.length > 0 && !/^\d+$/.test(pw), ne: 'केवल अङ्क होइन', en: 'Not digits only' },
    { ok: pw.length > 0 && !COMMON.includes(lower) && !isSeq(lower), ne: 'सामान्य वा क्रमिक (123456, abcdef) होइन', en: 'Not a common password or a simple sequence' },
    { ok: pw.length > 0 && new Set(pw).size >= 5 && !bits.some((b) => lower.includes(b)), ne: 'विविध अक्षर; नाम/इमेल समावेश नगर्नुहोस्', en: 'Varied characters; do not include your name or email' }
  ];
}

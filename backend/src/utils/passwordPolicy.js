const COMMON = new Set(['password', 'password1', 'password123', 'qwerty', 'qwertyuiop', 'qwerty123', '123456789', '1234567890', '0123456789', '9876543210', '1q2w3e4r5t', '11111111', '00000000',
  'admin', 'admin123', 'administrator', 'letmein', 'welcome', 'welcome123', 'iloveyou', 'nepal', 'nepal123', 'nepali123', 'kaski', 'kaski123', 'pokhara', 'pokhara123', 'greenhouse', 'greenhouse123',
  'kaskikot', 'agriculture', 'agriculture123', 'abc12345', 'abcdefghij', 'changeme', 'changeme123']);

function isSequence(s) {
  if (s.length < 6) return false;
  let up = true;
  let down = true;
  for (let i = 1; i < s.length; i++) {
    const d = s.charCodeAt(i) - s.charCodeAt(i - 1);
    if (d !== 1) up = false;
    if (d !== -1) down = false;
  }
  return up || down;
}

function checkPassword(pw, ctx = {}) {
  if (typeof pw !== 'string' || !pw) return ['Password is required'];
  const errs = [];
  const lower = pw.toLowerCase();
  if (pw.length < 10) errs.push('Use at least 10 characters');
  if (Buffer.byteLength(pw, 'utf8') > 72) errs.push('Use at most 72 bytes (about 72 characters)');
  if (COMMON.has(lower)) errs.push('This is a very common password');
  if (/^\d+$/.test(pw)) errs.push('Do not use digits only');
  if (isSequence(lower)) errs.push('Avoid simple sequences such as 123456 or abcdef');
  if (new Set(pw).size < 5) errs.push('Use more varied characters');
  const bits = [ctx.username, String(ctx.email || '').split('@')[0]].filter((x) => x && x.length >= 4).map((x) => x.toLowerCase());
  if (bits.some((b) => lower.includes(b))) errs.push('Do not include your username or email name');
  return [...new Set(errs)];
}

module.exports = { checkPassword };

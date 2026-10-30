// Application types and the rules that decide what is still missing.
// The AI assistant (later phase) only drafts; these rules decide completeness.
const f = (key, ne, en, askNe, askEn, o = {}) => ({ key, ne, en, askNe, askEn, type: 'text', required: true, max: 200, ...o });

const MUNICIPALITIES = [
  { v: 'pokhara', ne: 'पोखरा महानगरपालिका', en: 'Pokhara Metropolitan City' },
  { v: 'annapurna', ne: 'अन्नपूर्ण गाउँपालिका', en: 'Annapurna Rural Municipality' },
  { v: 'machhapuchchhre', ne: 'माछापुच्छ्रे गाउँपालिका', en: 'Machhapuchchhre Rural Municipality' },
  { v: 'madi', ne: 'मादी गाउँपालिका', en: 'Madi Rural Municipality' },
  { v: 'rupa', ne: 'रुपा गाउँपालिका', en: 'Rupa Rural Municipality' },
  { v: 'other', ne: 'अन्य स्थान', en: 'Somewhere else' }
];

const COMMON = [
  f('full_name', 'पूरा नाम', 'Full name', 'तपाईंको पूरा नाम के हो?', 'What is your full name?', { max: 120 }),
  f('phone', 'मोबाइल नम्बर', 'Mobile number', 'तपाईंको मोबाइल नम्बर कति हो?', 'What is your mobile number?', { type: 'phone', max: 20 }),
  f('municipality', 'पालिका', 'Municipality', 'तपाईं कुन पालिकामा बस्नुहुन्छ?', 'Which municipality do you live in?', { type: 'select', options: MUNICIPALITIES }),
  f('ward', 'वडा नं.', 'Ward no.', 'तपाईंको वडा नं. कति हो?', 'What is your ward number?', { type: 'number', min: 1, max: 33 }),
  f('tole', 'टोल / गाउँ', 'Village / tole', 'तपाईंको टोल वा गाउँको नाम?', 'Your village or tole?', { required: false, max: 120 }),
  f('citizenship_no', 'नागरिकता नं.', 'Citizenship no.', 'नागरिकता नम्बर (भए)', 'Citizenship number (if any)', { required: false, max: 40 }),
  f('email', 'इमेल (भए मात्र)', 'Email (only if you have one)', 'इमेल ठेगाना (भए मात्र)', 'Email address (only if you have one)', { type: 'email', required: false, max: 150 })
];

const area = (extra = {}) => f('area', 'क्षेत्रफल', 'Land area', 'कति क्षेत्रफलको जग्गा हो? (रोपनी/कठ्ठा)', 'How big is the land? (ropani / kattha)', { max: 60, ...extra });

const TYPES = [
  { code: 'general', ne: 'सामान्य निवेदन', en: 'General application', subjectNe: 'निवेदन सम्बन्धमा', fields: [
    f('subject', 'विषय', 'Subject', 'निवेदनको विषय के हो?', 'What is the subject of your application?', { max: 200 }),
    f('details', 'विवरण', 'Details', 'कृपया आफ्नो कुरा विस्तारमा लेख्नुहोस्।', 'Please describe your request in detail.', { type: 'textarea', max: 3000 })] },
  { code: 'subsidy', ne: 'अनुदान / कार्यक्रम', en: 'Subsidy or program', subjectNe: 'अनुदान / कार्यक्रम सहयोग सम्बन्धमा', fields: [
    f('program_name', 'कार्यक्रम / अनुदानको नाम', 'Program or subsidy name', 'कुन कार्यक्रम वा अनुदानका लागि निवेदन दिनुहुन्छ?', 'Which program or subsidy are you applying for?'),
    f('activity', 'बाली / पशुपालन / व्यवसाय', 'Crop, livestock or business', 'तपाईं के को खेती वा व्यवसाय गर्नुहुन्छ?', 'What do you farm or run?'),
    area({ required: false }),
    f('support_needed', 'माग गरिएको सहयोग', 'Support requested', 'तपाईंलाई कस्तो सहयोग चाहिएको हो?', 'What support do you need?', { type: 'textarea', max: 2000 })] },
  { code: 'soil_test', ne: 'माटो / मल परीक्षण', en: 'Soil or fertilizer test', subjectNe: 'माटो परीक्षण सेवा सम्बन्धमा', fields: [
    f('crop', 'बाली', 'Crop', 'कुन बालीका लागि माटो परीक्षण गर्ने हो?', 'Which crop is the soil test for?', { max: 100 }),
    f('land_location', 'जग्गाको ठेगाना', 'Land location', 'जग्गा कहाँ पर्छ?', 'Where is the land?', { max: 200 }),
    area({ required: false }),
    f('reason', 'परीक्षण गर्नुपर्ने कारण', 'Reason', 'किन परीक्षण गर्न चाहनुहुन्छ?', 'Why do you want the test?', { required: false, type: 'textarea', max: 1000 })] },
  { code: 'training', ne: 'तालिम सम्बन्धी निवेदन', en: 'Training request', subjectNe: 'तालिम सम्बन्धमा', fields: [
    f('topic', 'तालिमको विषय', 'Training topic', 'कुन विषयमा तालिम चाहिएको हो?', 'What topic do you want training on?'),
    f('participants', 'सहभागी संख्या', 'Number of participants', 'कति जना सहभागी हुनेछन्?', 'How many people will attend?', { type: 'number', min: 1, max: 500 }),
    f('details', 'थप विवरण', 'More details', 'थप कुरा भए लेख्नुहोस्।', 'Anything else we should know?', { required: false, type: 'textarea', max: 2000 })] },
  { code: 'crop_problem', ne: 'बाली / पशु समस्या', en: 'Crop or livestock problem', subjectNe: 'बाली / पशुपालन समस्या समाधान सम्बन्धमा', fields: [
    f('crop', 'बाली / पशु', 'Crop or animal', 'कुन बाली वा पशुमा समस्या आएको हो?', 'Which crop or animal has the problem?', { max: 100 }),
    f('symptoms', 'समस्याका लक्षण', 'What you see', 'के कस्ता लक्षण देख्नुभएको छ?', 'What symptoms do you see?', { type: 'textarea', max: 2000 }),
    f('since', 'कहिलेदेखि', 'Since when', 'यो समस्या कहिलेदेखि छ?', 'Since when has this been happening?', { max: 100 }),
    area({ required: false })] },
  { code: 'complaint', ne: 'गुनासो', en: 'Complaint', subjectNe: 'गुनासो सम्बन्धमा', fields: [
    f('subject', 'गुनासोको विषय', 'Subject', 'गुनासो कुन विषयमा हो?', 'What is your complaint about?'),
    f('details', 'विवरण', 'Details', 'के भयो? कृपया विस्तारमा लेख्नुहोस्।', 'What happened? Please describe it.', { type: 'textarea', max: 3000 }),
    f('incident_date', 'घटनाको मिति', 'Date it happened', 'यो कहिले भएको हो?', 'When did this happen?', { required: false, max: 60 })] },
  { code: 'information', ne: 'सूचना माग निवेदन', en: 'Information request', subjectNe: 'सूचना उपलब्ध गराउने सम्बन्धमा', fields: [
    f('information_requested', 'माग गरिएको सूचना', 'Information requested', 'कुन सूचना चाहिएको हो?', 'What information do you need?', { type: 'textarea', max: 2000 }),
    f('purpose', 'सूचनाको प्रयोजन', 'Purpose', 'यो सूचना किन चाहिएको हो?', 'Why do you need it?', { required: false, max: 500 })] }
];

const byCode = Object.fromEntries(TYPES.map((t) => [t.code, { ...t, fields: [...COMMON, ...t.fields] }]));
const getType = (code) => byCode[code] || null;
const listTypes = () => Object.values(byCode).map((t) => ({ code: t.code, ne: t.ne, en: t.en, fields: t.fields }));

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
function normalizePhone(v) {
  const s = String(v || '').replace(/[\s\-()]/g, '');
  if (/^9[78]\d{8}$/.test(s)) return `+977${s}`;
  if (/^\+[1-9]\d{7,14}$/.test(s)) return s;
  return null;
}

// Returns { values, missing, invalid }. "missing" drives the friendly follow-up questions.
function checkApplication(typeCode, input = {}) {
  const type = getType(typeCode);
  if (!type) return { error: 'Unknown application type' };
  const values = {}, missing = [], invalid = [];
  for (const fld of type.fields) {
    let v = clean(input[fld.key], fld.max);
    if (!v) { if (fld.required) missing.push({ key: fld.key, askNe: fld.askNe, askEn: fld.askEn }); continue; }
    const bad = (ne, en) => invalid.push({ key: fld.key, askNe: ne, askEn: en });
    if (fld.type === 'phone') { v = normalizePhone(v); if (!v) { bad('मोबाइल नम्बर मिलेन। १० अङ्कको नम्बर लेख्नुहोस्।', 'That mobile number looks wrong. Enter a 10-digit number.'); continue; } }
    else if (fld.type === 'email') { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { bad('इमेल मिलेन।', 'That email looks wrong.'); continue; } }
    else if (fld.type === 'number') { const n = Number(v.replace(/[०-९]/g, (d) => '०१२३४५६७८९'.indexOf(d))); if (!Number.isInteger(n) || n < fld.min || n > fld.max) { bad(`${fld.ne} ${fld.min} देखि ${fld.max} को बीचमा हुनुपर्छ।`, `${fld.en} must be between ${fld.min} and ${fld.max}.`); continue; } v = n; }
    else if (fld.type === 'select') { if (!fld.options.some((o) => o.v === v)) { bad('सूचीबाट एउटा छान्नुहोस्।', 'Please pick one from the list.'); continue; } }
    values[fld.key] = v;
  }
  return { type, values, missing, invalid };
}

module.exports = { listTypes, getType, checkApplication, normalizePhone, MUNICIPALITIES };

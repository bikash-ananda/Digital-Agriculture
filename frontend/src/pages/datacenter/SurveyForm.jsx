import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import useLang from '../../utils/useLang';
import LandInput from '../../components/dc/LandInput';
import { lbl } from '../../utils/enumLabels';
import { formatLand } from '../../utils/dc';
import { errMsgs } from '../../utils/errors';
import { getSurvey, saveSurvey, removeSurvey, cacheLookups, readLookups } from '../../utils/surveyStore';

const inp = 'mt-1 w-full border border-gray-300 rounded-md px-3 py-3 bg-white text-base';
const SYSTEMS = ['open_field', 'greenhouse', 'tunnel', 'nursery', 'orchard', 'terrace', 'hydroponic', 'other'];
const SEASONS = ['spring', 'summer', 'winter', 'perennial', 'year_round'];
const ANIMALS = ['cattle', 'buffalo', 'goat', 'sheep', 'pig', 'poultry_layer', 'poultry_broiler', 'duck', 'fish_pond', 'beehive', 'other'];

const Field = ({ label, children }) => (<label className="block text-sm"><span className="font-medium text-terrace-800">{label}</span>{children}</label>);
const Sel = ({ value, onChange, options, lang, blank = true }) => (
  <select value={value} onChange={onChange} className={inp}>{blank && <option value="">-</option>}{options.map((o) => <option key={o} value={o}>{lbl(o, lang)}</option>)}</select>
);

export default function SurveyForm() {
  const { id } = useParams();
  const { lang, t } = useLang();
  const navigate = useNavigate();
  const [s, setS] = useState(() => getSurvey(id));
  const [step, setStep] = useState(0);
  const [lookups, setLookups] = useState(readLookups() || { crops: [], levels: [] });
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState([]);
  const [dup, setDup] = useState(null);
  const [done, setDone] = useState(null);
  const [queued, setQueued] = useState(false);
  const [gps, setGps] = useState('');

  useEffect(() => {
    Promise.all([api.get('/lookups/crops'), api.get('/lookups/local-levels')])
      .then(([c, l]) => { const v = { crops: c.data, levels: l.data }; setLookups(v); cacheLookups(v); }).catch(() => {});
  }, []);

  if (!s && !done) return <div className="p-4 bg-yellow-50 text-yellow-900 rounded">{t('यो सर्वेक्षण यो यन्त्रमा भेटिएन।', 'This survey was not found on this device.')} <Link to="/app/data-center/survey" className="underline">{t('सूचीमा फर्कनुहोस्', 'Back to the list')}</Link></div>;

  const change = (fn) => setS((prev) => { const next = { ...prev, status: 'draft', error: '', data: fn(prev.data) }; saveSurvey(next); return next; });
  const setF = (k) => (e) => change((d) => ({ ...d, farmer: { ...d.farmer, [k]: e.target.value } }));
  const setM = (k) => (e) => change((d) => ({ ...d, farm: { ...d.farm, [k]: e.target.value } }));
  const setRow = (key, i, k, v) => change((d) => ({ ...d, [key]: d[key].map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));
  const addRow = (key, row) => change((d) => ({ ...d, [key]: [...d[key], row] }));
  const delRow = (key, i) => change((d) => ({ ...d, [key]: d[key].filter((_, j) => j !== i) }));

  const d = s ? s.data : null;
  const capture = () => {
    if (!navigator.geolocation) { setGps(t('यो यन्त्रमा GPS उपलब्ध छैन', 'GPS is not available on this device')); return; }
    setGps(t('स्थान खोज्दै…', 'Getting location…'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        change((x) => ({ ...x, farm: { ...x.farm, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6), accuracy: Math.round(pos.coords.accuracy) } }));
        setGps(t(`स्थान प्राप्त भयो (±${Math.round(pos.coords.accuracy)} मि.)`, `Location captured (±${Math.round(pos.coords.accuracy)} m)`));
      },
      () => setGps(t('स्थान प्राप्त भएन। खुला ठाउँमा जानुहोस् वा अनुमति दिनुहोस्।', 'Could not get the location. Move to open sky or allow location access.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  };

  const stepOk = [
    () => (d.farmer.full_name_ne || d.farmer.full_name_en) && d.farmer.local_level_id && d.farmer.ward_no,
    () => (!d.farm.latitude && !d.farm.longitude) || (d.farm.latitude && d.farm.longitude),
    () => true, () => d.consent.data_use
  ];
  const steps = [t('कृषक', 'Farmer'), t('फार्म तथा स्थान', 'Farm & location'), t('बाली तथा पशुपालन', 'Crops & livestock'), t('सहमति तथा पेश', 'Consent & submit')];

  const submit = async (confirm = false) => {
    setBusy(true); setErrs([]); setDup(null);
    const payload = { client_uuid: s.id, farmer: d.farmer, farm: d.farm, crops: d.crops.filter((c) => c.crop_id), livestock: d.livestock.filter((l) => l.animal_type), consent: d.consent, confirm_duplicate: confirm };
    try {
      const r = await api.post('/datacenter/survey', payload);
      removeSurvey(s.id); setDone(r.data);
    } catch (err) {
      const data = err.response && err.response.data;
      if (!err.response) { saveSurvey({ ...s, status: 'queued' }); setQueued(true); }
      else if (err.response.status === 409 && data.needs_confirmation) setDup({ message: data.message, soft: data.soft });
      else if (err.response.status === 409 && data.duplicate) setDup({ message: data.message, hard: data.duplicate });
      else setErrs(errMsgs(err));
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="max-w-xl space-y-4">
        <h2 className="text-2xl font-bold text-terrace-900">✓ {t('कृषक दर्ता भयो', 'Farmer registered')}</h2>
        <p className="text-lg">{done.farmer_code}{done.repeated ? ` (${t('पहिले नै पठाइएको', 'already submitted')})` : ''}</p>
        <p className="text-gray-700">{t('अधिकृतले प्रमाणित गरेपछि अभिलेख अन्तिम हुन्छ।', 'The record is final once an officer verifies it.')}</p>
        <div className="flex flex-wrap gap-3">
          <Link to={`/app/farmers/${done.id}`} className="bg-terrace-800 text-white px-5 py-3 rounded-md font-semibold">{t('अभिलेख खोल्नुहोस्', 'Open the record')}</Link>
          <Link to="/app/data-center/survey" className="border border-terrace-800 text-terrace-800 px-5 py-3 rounded-md font-semibold">{t('अर्को सर्वेक्षण', 'Next survey')}</Link>
        </div>
      </div>
    );
  }
  if (queued) {
    return (
      <div className="max-w-xl space-y-4">
        <h2 className="text-2xl font-bold text-terrace-900">{t('इन्टरनेट नभएकाले पठाउन बाँकी', 'Saved — waiting to send')}</h2>
        <p className="text-gray-700">{t('सर्वेक्षण यो यन्त्रमा सुरक्षित छ। इन्टरनेट आएपछि सूचीबाट “अहिले पठाउनुहोस्” थिच्नुहोस्।', 'The survey is stored on this device. When you have a connection, press “Send now” in the list.')}</p>
        <Link to="/app/data-center/survey" className="inline-block bg-terrace-800 text-white px-5 py-3 rounded-md font-semibold">{t('सूचीमा जानुहोस्', 'Go to the list')}</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Link to="/app/data-center/survey" className="text-sm text-gov-blue underline">← {t('सर्वेक्षण सूची', 'Survey list')}</Link>
      <ol className="flex gap-1" aria-label="Steps">
        {steps.map((n, i) => (
          <li key={n} className="flex-1">
            <button onClick={() => setStep(i)} className={`w-full text-xs sm:text-sm py-2 px-1 border-b-4 ${i === step ? 'border-agri-green text-terrace-900 font-semibold' : i < step ? 'border-terrace-100 text-terrace-800' : 'border-gray-200 text-gray-500'}`}>{n}</button>
          </li>
        ))}
      </ol>
      <p className="text-xs text-gray-500">{t('हरेक परिवर्तन यो यन्त्रमा स्वतः सुरक्षित हुन्छ।', 'Every change is saved on this device automatically.')}</p>

      {step === 0 && (
        <div className="space-y-4 bg-white rounded-lg shadow p-5">
          <Field label={`${t('पूरा नाम (नेपाली)', 'Full name (Nepali)')} *`}><input value={d.farmer.full_name_ne} onChange={setF('full_name_ne')} className={inp} /></Field>
          <Field label={t('पूरा नाम (अंग्रेजी)', 'Full name (English)')}><input value={d.farmer.full_name_en} onChange={setF('full_name_en')} className={inp} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('लिङ्ग', 'Gender')}><Sel value={d.farmer.gender} onChange={setF('gender')} options={['female', 'male', 'other']} lang={lang} /></Field>
            <Field label={t('जन्म मिति (ई.सं.)', 'Date of birth (AD)')}><input type="date" value={d.farmer.date_of_birth} onChange={setF('date_of_birth')} className={inp} /></Field>
          </div>
          <Field label={t('मोबाइल नम्बर', 'Mobile number')}><input type="tel" inputMode="tel" value={d.farmer.phone} onChange={setF('phone')} className={inp} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Field label={`${t('स्थानीय तह', 'Local level')} *`}>
              <select value={d.farmer.local_level_id} onChange={setF('local_level_id')} className={inp}><option value="">-</option>{lookups.levels.map((l) => <option key={l.id} value={l.id}>{lang === 'en' ? l.name_en : l.name_ne}</option>)}</select></Field></div>
            <Field label={`${t('वडा', 'Ward')} *`}><input type="number" inputMode="numeric" min="1" max="35" value={d.farmer.ward_no} onChange={setF('ward_no')} className={inp} /></Field>
          </div>
          <Field label={t('ठेगाना / टोल', 'Address / tole')}><input value={d.farmer.address} onChange={setF('address')} className={inp} /></Field>
          <Field label={t('समूह / सहकारी', 'Group / cooperative')}><input value={d.farmer.group_name} onChange={setF('group_name')} className={inp} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('परिवार सदस्य संख्या', 'Household members')}><input type="number" inputMode="numeric" min="1" value={d.farmer.household_members} onChange={setF('household_members')} className={inp} /></Field>
            <Field label={t('मुख्य पेशा', 'Main occupation')}><Sel value={d.farmer.main_occupation} onChange={setF('main_occupation')} options={['agriculture', 'livestock', 'agri_business', 'service', 'foreign_employment', 'business', 'other']} lang={lang} /></Field>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 bg-white rounded-lg shadow p-5">
          <Field label={t('फार्मको नाम', 'Farm name')}><input value={d.farm.name} onChange={setM('name')} placeholder={t('जस्तै: घर नजिकको बारी', 'e.g. Home plot')} className={inp} /></Field>
          <div className="text-sm"><span className="font-medium text-terrace-800">{t('जमिनको क्षेत्रफल', 'Land area')}</span><LandInput key={`land-${s.id}`} value={d.farm.area_sqm} onChange={(x) => change((z) => ({ ...z, farm: { ...z.farm, area_sqm: x } }))} lang={lang} /></div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('स्वामित्व', 'Ownership')}><Sel value={d.farm.ownership_type} onChange={setM('ownership_type')} options={['owned', 'leased', 'shared', 'government']} lang={lang} blank={false} /></Field>
            <Field label={t('सिँचाइ', 'Irrigation')}><Sel value={d.farm.irrigation_type} onChange={setM('irrigation_type')} options={['none', 'rainfed', 'drip', 'sprinkler', 'canal', 'other']} lang={lang} blank={false} /></Field>
            <Field label={t('माटो', 'Soil')}><Sel value={d.farm.soil_type} onChange={setM('soil_type')} options={['sandy', 'loam', 'clay', 'silty', 'gravelly', 'other']} lang={lang} /></Field>
            <Field label={t('पानीको स्रोत', 'Water source')}><Sel value={d.farm.water_source} onChange={setM('water_source')} options={['rain_only', 'spring_water', 'river_canal', 'tube_well', 'tank', 'municipal', 'lake_pond', 'other']} lang={lang} /></Field>
          </div>
          <div className="border-t pt-4 space-y-3">
            <button type="button" onClick={capture} className="w-full sm:w-auto bg-gov-blue text-white px-5 py-3 rounded-md font-semibold">📍 {t('अहिलेको स्थान (GPS) लिनुहोस्', 'Capture current location (GPS)')}</button>
            {gps && <p className="text-sm text-gray-700">{gps}</p>}
            {d.farm.accuracy > 50 && <p className="text-sm text-yellow-900 bg-yellow-50 rounded p-2">⚠ {t('सटीकता कम छ। खुला ठाउँमा गएर फेरि प्रयास गर्नुहोस्।', 'Accuracy is low. Move to open sky and try again.')}</p>}
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('अक्षांश', 'Latitude')}><input type="number" step="any" value={d.farm.latitude} onChange={setM('latitude')} className={inp} /></Field>
              <Field label={t('देशान्तर', 'Longitude')}><input type="number" step="any" value={d.farm.longitude} onChange={setM('longitude')} className={inp} /></Field>
            </div>
            <p className="text-xs text-gray-500">{t('GPS का लागि HTTPS वा localhost चाहिन्छ। कृषकको घर होइन, फार्मको स्थान लिनुहोस्।', 'GPS needs HTTPS or localhost. Capture the farm’s location, not the farmer’s home.')}</p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-5 space-y-4">
            <h3 className="font-bold text-terrace-900">{t('यस मौसमका बाली', 'Crops this season')}</h3>
            {d.crops.map((c, i) => (
              <div key={i} className="border rounded-md p-3 space-y-3">
                <Field label={t('बाली', 'Crop')}><select value={c.crop_id} onChange={(e) => setRow('crops', i, 'crop_id', e.target.value)} className={inp}><option value="">-</option>{lookups.crops.map((x) => <option key={x.id} value={x.id}>{lang === 'en' ? x.name_en : x.name_ne}</option>)}</select></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('प्रणाली', 'System')}><Sel value={c.production_system} onChange={(e) => setRow('crops', i, 'production_system', e.target.value)} options={SYSTEMS} lang={lang} blank={false} /></Field>
                  <Field label={t('मौसम', 'Season')}><Sel value={c.season} onChange={(e) => setRow('crops', i, 'season', e.target.value)} options={SEASONS} lang={lang} blank={false} /></Field>
                </div>
                <div className="text-sm"><span className="font-medium text-terrace-800">{t('क्षेत्रफल', 'Area')}</span><LandInput key={`crop-${i}-${s.id}`} value={c.area_sqm} onChange={(x) => setRow('crops', i, 'area_sqm', x)} lang={lang} /></div>
                <Field label={t('उत्पादन भइसकेको भए (के.जी.)', 'Production so far, if any (kg)')}><input type="number" inputMode="decimal" min="0" value={c.production_kg} onChange={(e) => setRow('crops', i, 'production_kg', e.target.value)} className={inp} /></Field>
                <button onClick={() => delRow('crops', i)} className="text-gov-red text-sm underline">{t('हटाउनुहोस्', 'Remove')}</button>
              </div>
            ))}
            {d.crops.length < 10 && <button onClick={() => addRow('crops', { crop_id: '', production_system: 'open_field', season: 'summer', area_sqm: '', production_kg: '' })} className="border border-terrace-800 text-terrace-800 px-4 py-2.5 rounded-md font-semibold">+ {t('बाली थप्नुहोस्', 'Add a crop')}</button>}
          </div>
          <div className="bg-white rounded-lg shadow p-5 space-y-4">
            <h3 className="font-bold text-terrace-900">{t('पशुपालन / माछा / मौरी', 'Livestock / fish / bees')}</h3>
            {d.livestock.map((l, i) => (
              <div key={i} className="grid grid-cols-5 gap-3 items-end">
                <div className="col-span-3"><Field label={t('प्रकार', 'Type')}><Sel value={l.animal_type} onChange={(e) => setRow('livestock', i, 'animal_type', e.target.value)} options={ANIMALS} lang={lang} /></Field></div>
                <div className="col-span-1"><Field label={t('संख्या', 'Count')}><input type="number" inputMode="numeric" min="0" value={l.head_count} onChange={(e) => setRow('livestock', i, 'head_count', e.target.value)} className={inp} /></Field></div>
                <button onClick={() => delRow('livestock', i)} className="text-gov-red text-sm underline pb-3">{t('हटाउनुहोस्', 'Remove')}</button>
              </div>
            ))}
            {d.livestock.length < 10 && <button onClick={() => addRow('livestock', { animal_type: '', head_count: '' })} className="border border-terrace-800 text-terrace-800 px-4 py-2.5 rounded-md font-semibold">+ {t('थप्नुहोस्', 'Add')}</button>}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-5 space-y-2 text-sm">
            <h3 className="font-bold text-terrace-900 text-base">{t('सारांश', 'Summary')}</h3>
            <p><b>{d.farmer.full_name_ne || d.farmer.full_name_en || '—'}</b> · {d.farmer.phone || t('फोन छैन', 'no phone')}</p>
            <p>{(lookups.levels.find((l) => String(l.id) === String(d.farmer.local_level_id)) || {})[lang === 'en' ? 'name_en' : 'name_ne'] || '—'} - {d.farmer.ward_no || '—'}</p>
            <p>{d.farm.name || t('मुख्य फार्म', 'Main farm')}: {formatLand(d.farm.area_sqm, lang)} · {d.farm.latitude ? `GPS ${d.farm.latitude}, ${d.farm.longitude}` : t('GPS छैन', 'no GPS')}</p>
            <p>{d.crops.filter((c) => c.crop_id).length} {t('बाली', 'crops')} · {d.livestock.filter((l) => l.animal_type).length} {t('पशु समूह', 'livestock groups')}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5 space-y-4">
            <h3 className="font-bold text-terrace-900">{t('सहमति (कृषकलाई पढेर सुनाउनुहोस्)', 'Consent (read this to the farmer)')}</h3>
            <p className="text-xs text-gray-500">{t('यो शब्दावली मस्यौदा हो — कार्यालय र कानुनी सल्लाहकारबाट पुष्टि गरेर मात्र प्रयोग गर्नुहोस्।', 'This wording is a draft. Have your office and legal adviser confirm it before real use.')}</p>
            <label className="flex items-start gap-3"><input type="checkbox" className="mt-1.5 w-5 h-5" checked={d.consent.data_use} onChange={(e) => change((z) => ({ ...z, consent: { ...z.consent, data_use: e.target.checked, research: e.target.checked ? z.consent.research : false } }))} />
              <span>{t('म तपाईंको नाम, सम्पर्क, जमिन र उत्पादनको विवरण कृषि विकास कार्यालय, कास्कीको सेवा, योजना र अनुगमनका लागि सङ्कलन गर्दैछु। यो विवरण अधिकृत कर्मचारीले मात्र हेर्न पाउँछन्। के तपाईं सहमत हुनुहुन्छ? *', 'I am collecting your name, contact, land and production details for the services, planning and monitoring of the Agriculture Development Office, Kaski. Only authorised staff can see them. Do you agree? *')}</span></label>
            <label className="flex items-start gap-3"><input type="checkbox" className="mt-1.5 w-5 h-5" disabled={!d.consent.data_use} checked={d.consent.research} onChange={(e) => change((z) => ({ ...z, consent: { ...z.consent, research: e.target.checked } }))} />
              <span>{t('के तपाईंको नाम, फोन र ठ्याक्कै स्थान हटाएर (गुमनाम बनाएर) विवरण कृषि अनुसन्धान र अध्ययनमा प्रयोग गर्न सहमत हुनुहुन्छ? (ऐच्छिक)', 'Do you agree that your details, with your name, phone and exact location removed, may be used for agricultural research and study? (optional)')}</span></label>
          </div>
          {errs.length > 0 && <ul role="alert" className="p-3 bg-red-50 text-red-700 rounded text-sm list-disc pl-6">{errs.map((x, i) => <li key={i}>{x}</li>)}</ul>}
          {dup && (
            <div role="alert" className="p-4 bg-yellow-50 border border-yellow-300 rounded space-y-2 text-sm">
              <p className="font-semibold">{dup.message}</p>
              {dup.soft && dup.soft.map((m, i) => <p key={i}>• {m}</p>)}
              {dup.hard && <Link to={`/app/farmers/${dup.hard.id}`} className="text-gov-blue underline">{t('पुरानो अभिलेख खोल्नुहोस्', 'Open the existing record')}</Link>}
              {dup.soft && <button onClick={() => submit(true)} className="bg-terrace-800 text-white px-4 py-2 rounded-md font-semibold">{t('फरक व्यक्ति हो — दर्ता गर्नुहोस्', 'Different person — register anyway')}</button>}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        {step > 0 && <button onClick={() => setStep(step - 1)} className="px-6 py-3 border border-terrace-800 text-terrace-800 rounded-md font-semibold">{t('पछाडि', 'Back')}</button>}
        {step < 3
          ? <button disabled={!stepOk[step]()} onClick={() => setStep(step + 1)} className="flex-1 sm:flex-none px-8 py-3 bg-terrace-800 hover:bg-terrace-900 text-white rounded-md font-semibold disabled:opacity-50">{t('अर्को', 'Next')}</button>
          : <button disabled={!stepOk[3]() || busy} onClick={() => submit(false)} className="flex-1 sm:flex-none px-8 py-3 bg-agri-green hover:bg-green-800 text-white rounded-md font-semibold disabled:opacity-50">{busy ? t('पठाउँदै…', 'Submitting…') : t('दर्ता गरेर पेश गर्नुहोस्', 'Register and submit')}</button>}
        <button onClick={() => navigate('/app/data-center/survey')} className="ml-auto px-4 py-3 text-sm underline text-gray-600">{t('मस्यौदा राखेर बाहिर', 'Save draft and leave')}</button>
      </div>
      {step < 3 && !stepOk[step]() && <p className="text-xs text-gray-500">{step === 0 ? t('नाम, स्थानीय तह र वडा चाहिन्छ।', 'A name, local level and ward are required.') : t('अक्षांश र देशान्तर दुवै भर्नुहोस् वा दुवै खाली छोड्नुहोस्।', 'Fill in both latitude and longitude, or leave both empty.')}</p>}
    </div>
  );
}

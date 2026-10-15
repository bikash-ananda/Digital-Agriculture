import { useEffect, useState } from 'react';
import { AlertTriangle, ImagePlus, LoaderCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import { Callout, PublicPage } from './common';
import { copy, field, surface } from './helpers';

const crops = [['tomato', 'Tomato', 'गोलभेडा'], ['potato', 'Potato', 'आलु'], ['rice', 'Rice', 'धान'], ['maize', 'Maize', 'मकै'], ['cauliflower', 'Cauliflower', 'काउली'], ['other', 'Other crop', 'अन्य बाली']];
const parts = [['leaf', 'Leaf', 'पात'], ['stem', 'Stem', 'डाँठ'], ['root', 'Root', 'जरा'], ['fruit', 'Fruit', 'फल'], ['whole', 'Whole plant', 'सम्पूर्ण बोट'], ['unknown', 'Not sure', 'थाहा छैन']];

export default function CropDoctor() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  const [status, setStatus] = useState(null);
  const [crop, setCrop] = useState('tomato');
  const [part, setPart] = useState('unknown');
  const [stage, setStage] = useState('');
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState('');
  const [recentWeather, setRecentWeather] = useState('');
  const [irrigation, setIrrigation] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  useEffect(() => {
    let active = true;
    api.get('/public-farming/status').then(({ data }) => { if (active) setStatus(data); }).catch(() => { if (active) setStatus({ crop_doctor_configured: false }); });
    return () => { active = false; };
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const clearPhoto = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(''); setFile(null); setResult('');
  };
  const chooseFile = (event) => {
    const next = event.target.files?.[0];
    setError(''); setResult('');
    if (!next) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) { clearPhoto(); setError(copy(lang, 'Choose a JPEG, PNG or WebP image.', 'JPEG, PNG वा WebP तस्बिर छान्नुहोस्।')); return; }
    if (next.size > 5 * 1024 * 1024) { clearPhoto(); setError(copy(lang, 'The image must be 5 MB or smaller.', 'तस्बिर ५ MB वा कम हुनुपर्छ।')); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(URL.createObjectURL(next));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!file || symptoms.trim().length < 8 || !status?.crop_doctor_configured || busy) return;
    setBusy(true); setError(''); setResult(''); setUploadProgress(0);
    const form = new FormData();
    form.append('image', file); form.append('crop', crop); form.append('plant_part', part); form.append('crop_stage', stage); form.append('location', location); form.append('duration', duration); form.append('recent_weather', recentWeather); form.append('irrigation', irrigation); form.append('symptoms', symptoms.trim()); form.append('lang', lang);
    try {
      const { data } = await api.post('/public-farming/crop-doctor', form, { onUploadProgress: (event) => { if (event.total) setUploadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100))); } });
      setResult(data.analysis);
    } catch (cause) {
      setError(cause.response?.data?.message || copy(lang, 'The image could not be analyzed. Check your connection and try again.', 'तस्बिर विश्लेषण हुन सकेन। जडान जाँचेर फेरि प्रयास गर्नुहोस्।'));
      if (cause.response?.status === 503) setStatus((old) => ({ ...old, crop_doctor_configured: false }));
    } finally { setBusy(false); setUploadProgress(null); }
  };
  const configured = status?.crop_doctor_configured;
  return <PublicPage eyebrow={copy(lang, 'CROP PROBLEM TRIAGE', 'बाली समस्या प्रारम्भिक जाँच')} title={copy(lang, 'Crop Doctor', 'बाली समस्या सहायक')} intro={copy(lang, 'Describe what you see and attach a clear photo. Image analysis is preliminary and requires an image-capable AI endpoint on the server.', 'देखिएको समस्या लेख्नुहोस् र स्पष्ट तस्बिर राख्नुहोस्। तस्बिर विश्लेषण प्रारम्भिक हुन्छ र सर्भरमा तस्बिर बुझ्ने एआई सेवा चाहिन्छ।')}>
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,.8fr)]">
      <form onSubmit={submit} className={`${surface} p-5 sm:p-6`}>
        {!configured && <div className="mb-5"><Callout title={copy(lang, 'Image analysis is not connected', 'तस्बिर विश्लेषण जडान छैन')} tone="amber">{copy(lang, 'This form is ready, but no image-capable provider is enabled. Configure FARMING_AI_URL, FARMING_AI_MODEL and FARMING_CROP_DOCTOR_ENABLED=true on the server. The site will not invent a diagnosis.', 'यो फारम तयार छ, तर तस्बिर बुझ्ने सेवा सक्षम छैन। सर्भरमा FARMING_AI_URL, FARMING_AI_MODEL र FARMING_CROP_DOCTOR_ENABLED=true राख्नुहोस्। वेबसाइटले बनावटी रोग निदान देखाउँदैन।')}</Callout></div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-800">{copy(lang, 'Crop', 'बाली')}<select className={`${field} mt-1`} value={crop} onChange={(event) => setCrop(event.target.value)}>{crops.map(([id, en, ne]) => <option key={id} value={id}>{lang === 'en' ? en : ne}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-800">{copy(lang, 'Affected plant part', 'प्रभावित भाग')}<select className={`${field} mt-1`} value={part} onChange={(event) => setPart(event.target.value)}>{parts.map(([id, en, ne]) => <option key={id} value={id}>{lang === 'en' ? en : ne}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-800">{copy(lang, 'Crop stage (optional)', 'बालीको अवस्था (वैकल्पिक)')}<input maxLength={80} className={`${field} mt-1`} value={stage} onChange={(event) => setStage(event.target.value)} placeholder={copy(lang, 'e.g. flowering', 'जस्तै: फूल फुल्ने अवस्था')} /></label>
          <label className="text-sm font-semibold text-slate-800">{copy(lang, 'Location (optional)', 'स्थान (वैकल्पिक)')}<input maxLength={120} className={`${field} mt-1`} value={location} onChange={(event) => setLocation(event.target.value)} placeholder={copy(lang, 'Municipality / ward', 'पालिका / वडा')} /></label>
          <label className="text-sm font-semibold text-slate-800 sm:col-span-2">{copy(lang, 'How long have you observed this? (optional)', 'कति समयदेखि देखिएको हो? (वैकल्पिक)')}<input maxLength={80} className={`${field} mt-1`} value={duration} onChange={(event) => setDuration(event.target.value)} placeholder={copy(lang, 'e.g. 3 days', 'जस्तै: ३ दिन')} /></label>
          <label className="text-sm font-semibold text-slate-800">{copy(lang, 'Recent weather (optional)', 'हालको मौसम (वैकल्पिक)')}<input maxLength={160} className={`${field} mt-1`} value={recentWeather} onChange={(event) => setRecentWeather(event.target.value)} placeholder={copy(lang, 'e.g. heavy rain or dry spell', 'जस्तै: भारी वर्षा वा खडेरी')} /></label>
          <label className="text-sm font-semibold text-slate-800">{copy(lang, 'Irrigation practices (optional)', 'सिँचाइ अभ्यास (वैकल्पिक)')}<input maxLength={160} className={`${field} mt-1`} value={irrigation} onChange={(event) => setIrrigation(event.target.value)} placeholder={copy(lang, 'e.g. drip, furrow, recent watering', 'जस्तै: थोपा, कुलो, हालै पानी दिएको')} /></label>
          <label className="text-sm font-semibold text-slate-800 sm:col-span-2">{copy(lang, 'Describe symptoms', 'लक्षण वर्णन गर्नुहोस्')}<textarea required minLength={8} maxLength={2000} rows="4" className={`${field} mt-1`} value={symptoms} onChange={(event) => setSymptoms(event.target.value)} placeholder={copy(lang, 'What changed, where did it start, and how has it spread?', 'के परिवर्तन भयो, कहाँबाट सुरु भयो र कसरी फैलिएको छ?')} /></label>
          <div className="sm:col-span-2"><p className="mb-1 text-sm font-semibold text-slate-800">{copy(lang, 'Crop photograph', 'बालीको तस्बिर')}</p>{preview ? <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"><img src={preview} alt={copy(lang, 'Selected crop problem photograph preview', 'छानिएको बाली समस्याको तस्बिर')} className="max-h-72 w-full object-contain" /><button type="button" onClick={clearPhoto} aria-label={copy(lang, 'Remove photo', 'तस्बिर हटाउनुहोस्')} className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-white text-slate-800 shadow"><X size={18} aria-hidden="true" /></button></div> : <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center hover:border-emerald-500"><ImagePlus className="text-emerald-800" aria-hidden="true" /><span className="mt-2 text-sm font-semibold text-slate-800">{copy(lang, 'Choose a photo', 'तस्बिर छान्नुहोस्')}</span><span className="mt-1 text-xs text-slate-500">JPEG, PNG, WebP · max 5 MB</span><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={chooseFile} /></label>}</div>
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
        {busy && <div role="status" className="mt-4"><div className="flex justify-between text-xs text-slate-600"><span>{uploadProgress === 100 ? copy(lang, 'Photo uploaded · analysis in progress', 'तस्बिर अपलोड भयो · विश्लेषण हुँदैछ') : copy(lang, 'Uploading photo…', 'तस्बिर अपलोड हुँदैछ…')}</span><span>{uploadProgress ?? 0}%</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-700 transition-[width]" style={{ width: `${uploadProgress ?? 0}%` }} /></div></div>}
        <button type="submit" disabled={!configured || !file || symptoms.trim().length < 8 || busy} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40">{busy && <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />}{busy ? (uploadProgress === 100 ? copy(lang, 'Analyzing the case…', 'समस्या विश्लेषण हुँदैछ…') : copy(lang, 'Uploading the case…', 'विवरण अपलोड हुँदैछ…')) : copy(lang, 'Submit for preliminary review', 'प्रारम्भिक जाँचका लागि पठाउनुहोस्')}</button>
      </form>
      <div className="space-y-4"><Callout title={copy(lang, 'Preliminary only', 'प्रारम्भिक जानकारी मात्र')} tone="amber"><span className="inline-flex gap-2"><AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />{copy(lang, 'An image cannot confirm a plant disease. Similar symptoms can have different causes. Do not apply pesticide based only on this result.', 'तस्बिरबाट रोग पुष्टि गर्न सकिँदैन। उस्तै लक्षणका कारण फरक हुन सक्छन्। यस नतिजाको आधारमा मात्रै विषादी प्रयोग नगर्नुहोस्।')}</span></Callout><aside className={`${surface} p-5`}><h2 className="font-bold text-slate-950">{copy(lang, 'Prepare a useful case', 'उपयोगी विवरण तयार गर्नुहोस्')}</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">{(lang === 'en' ? ['Photograph the whole plant and a close-up in daylight.', 'Include crop, stage, affected area and how long it has been changing.', 'Keep the original photo clear; avoid filters and screenshots.'] : ['दिनको उज्यालोमा बोट र प्रभावित भागको नजिकबाट तस्बिर लिनुहोस्।', 'बाली, अवस्था, प्रभावित भाग र कति समयदेखि परिवर्तन भयो लेख्नुहोस्।', 'फिल्टर वा स्क्रिनसट नगरी स्पष्ट मूल तस्बिर प्रयोग गर्नुहोस्।']).map((item) => <li className="flex gap-2" key={item}><span className="font-bold text-emerald-700">•</span>{item}</li>)}</ul></aside><a href="/contact" className="block rounded-2xl border border-emerald-200 bg-white p-5 text-sm font-semibold text-emerald-950 hover:bg-emerald-50">{copy(lang, 'Need local inspection? Contact the Agriculture Development Office, Kaski →', 'स्थानीय निरीक्षण चाहिन्छ? कृषि विकास कार्यालय, कास्कीलाई सम्पर्क गर्नुहोस् →')}</a></div>
    </div>
    {result && <section className={`${surface} mx-auto mt-6 max-w-6xl p-5 sm:p-6`} aria-live="polite"><p className="text-xs font-bold uppercase tracking-wider text-amber-800">{copy(lang, 'PRELIMINARY AI RESPONSE', 'प्रारम्भिक एआई उत्तर')}</p><h2 className="mt-1 text-xl font-bold text-slate-950">{copy(lang, 'Possible observations and next steps', 'सम्भावित अवलोकन र अर्को कदम')}</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-800">{result}</p><p className="mt-4 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-600">{copy(lang, 'This is not a confirmed diagnosis. Get local expert advice for severe, spreading or uncertain symptoms.', 'यो पुष्टि भएको रोग निदान होइन। गम्भीर, फैलिँदो वा अन्योलको लक्षणमा स्थानीय प्राविधिकको सल्लाह लिनुहोस्।')}</p></section>}
  </PublicPage>;
}

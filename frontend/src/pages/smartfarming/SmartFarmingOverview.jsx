import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import FormField, { inputCls } from '../../components/common/FormField';
import { errMsgs } from '../../utils/errors';

const empty = { name_en: '', name_ne: '', site_type: 'demonstration', address: '', latitude: '', longitude: '' };

export default function SmartFarmingOverview() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  const t = (ne, en) => lang === 'en' ? en : ne;
  const { can } = useAuth();
  const [sites, setSites] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState([]);

  const load = () => {
    setLoading(true); setError('');
    return api.get('/smart/sites').then((r) => setSites(r.data)).catch((e) => setError(errMsgs(e)[0])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault(); setErrors([]);
    try { await api.post('/smart/sites', form); setForm(empty); setShow(false); load(); }
    catch (err) { setErrors(errMsgs(err)); }
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold text-gov-blue">{t('स्मार्ट फार्मिङ', 'Smart Farming')}</h2>{can('smart_farming.create') && <button type="button" onClick={() => setShow(!show)} className="min-h-11 rounded-lg bg-agri-green px-4 text-sm font-semibold text-white hover:bg-green-800">+ {t('साइट थप्नुहोस्', 'Add site')}</button>}</div>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-800"><span>{error}</span><button type="button" onClick={load} className="min-h-11 rounded-lg bg-white px-3 font-semibold ring-1 ring-red-200">{t('फेरि प्रयास गर्नुहोस्', 'Retry')}</button></div>}
    {show && <form onSubmit={submit} className="grid gap-3 rounded-lg bg-white p-4 shadow sm:grid-cols-2">
      {errors.length > 0 && <ul role="alert" className="list-disc rounded bg-red-50 p-3 pl-6 text-sm text-red-700 sm:col-span-2">{errors.map((item, i) => <li key={i}>{item}</li>)}</ul>}
      <FormField label={`${t('साइटको नाम (अंग्रेजी)', 'Site name (English)')} *`}><input required value={form.name_en} onChange={set('name_en')} className={inputCls} /></FormField>
      <FormField label={t('साइटको नाम (नेपाली)', 'Site name (Nepali)')}><input value={form.name_ne} onChange={set('name_ne')} className={inputCls} /></FormField>
      <FormField label={t('प्रकार', 'Type')}><select value={form.site_type} onChange={set('site_type')} className={inputCls}>{['demonstration', 'farm', 'research', 'other'].map((item) => <option key={item}>{item}</option>)}</select></FormField>
      <FormField label={t('ठेगाना', 'Address')}><input value={form.address} onChange={set('address')} className={inputCls} /></FormField>
      <FormField label={t('अक्षांश', 'Latitude')}><input type="number" step="any" value={form.latitude} onChange={set('latitude')} className={inputCls} /></FormField>
      <FormField label={t('देशान्तर', 'Longitude')}><input type="number" step="any" value={form.longitude} onChange={set('longitude')} className={inputCls} /></FormField>
      <div className="sm:col-span-2"><button className="min-h-11 rounded-lg bg-agri-green px-4 text-sm font-semibold text-white">{t('सुरक्षित गर्नुहोस्', 'Save')}</button></div>
    </form>}
    {loading ? <p role="status" className="rounded-lg bg-white p-5 text-sm text-gray-600">{t('फार्महरू लोड हुँदैछन्…', 'Loading farms…')}</p> : sites.length === 0 && !error ? <div className="rounded-xl border border-dashed border-terrace-200 bg-white p-8 text-center text-gray-600"><p className="font-medium">{t('कुनै फार्म दर्ता गरिएको छैन।', 'No farms have been registered yet.')}</p><p className="mt-1 text-sm">{can('smart_farming.create') ? t('सुरु गर्न फार्म साइट थप्नुहोस्।', 'Add a farm site to get started.') : t('प्रवेशका लागि प्रशासकलाई सम्पर्क गर्नुहोस्।', 'Contact an administrator for access.')}</p></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{sites.map((site) => <Link key={site.id} to={`/app/smart-farming/sites/${site.id}`} className="rounded-xl border-t-4 border-agri-green bg-white p-5 shadow-sm transition hover:shadow-md"><p className="text-xs text-gray-500">{site.code} · {site.site_type}</p><h3 className="mt-1 text-lg font-semibold text-gov-blue">{lang === 'en' ? site.name_en : (site.name_ne || site.name_en)}</h3><p className="text-sm text-gray-600">{(lang === 'en' ? site.local_level_en : site.local_level_ne) || site.address || '—'}</p><div className="mt-3 flex gap-4 text-sm"><span>🌱 {site.unit_count} {t('इकाई', 'units')}</span><span>📟 {site.device_count} {t('यन्त्र', 'devices')}</span></div></Link>)}</div>}
  </div>;
}
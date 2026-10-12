
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
  const t = (ne, en) => (lang === 'en' ? en : ne);
  const { can } = useAuth();
  const [sites, setSites] = useState([]);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState([]);

  const load = () => api.get('/smart/sites').then((r) => setSites(r.data)).catch((e) => setError(errMsgs(e)[0]));
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErrors([]);
    try { await api.post('/smart/sites', form); setForm(empty); setShow(false); load(); }
    catch (err) { setErrors(errMsgs(err)); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gov-blue">{t('स्मार्ट फार्मिङ', 'Smart Farming')}</h2>
        {can('smart_farming.create') && (
          <button onClick={() => setShow(!show)} className="bg-agri-green hover:bg-green-800 text-white px-4 py-2 rounded font-semibold text-sm">
            + {t('साइट थप्नुहोस्', 'Add Site')}
          </button>
        )}
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

      {show && (
        <form onSubmit={submit} className="bg-white rounded shadow p-4 grid sm:grid-cols-2 gap-3">
          {errors.length > 0 && <ul className="sm:col-span-2 p-3 bg-red-50 text-red-700 rounded text-sm list-disc pl-6">{errors.map((x, i) => <li key={i}>{x}</li>)}</ul>}
          <FormField label={`${t('साइटको नाम (अंग्रेजी)', 'Site Name (English)')} *`}><input required value={form.name_en} onChange={set('name_en')} className={inputCls} /></FormField>
          <FormField label={t('साइटको नाम (नेपाली)', 'Site Name (Nepali)')}><input value={form.name_ne} onChange={set('name_ne')} className={inputCls} /></FormField>
          <FormField label={t('प्रकार', 'Type')}>
            <select value={form.site_type} onChange={set('site_type')} className={inputCls}>
              {['demonstration', 'farm', 'research', 'other'].map((x) => <option key={x}>{x}</option>)}
            </select>
          </FormField>
          <FormField label={t('ठेगाना', 'Address')}><input value={form.address} onChange={set('address')} className={inputCls} /></FormField>
          <FormField label={t('अक्षांश', 'Latitude')}><input type="number" step="any" value={form.latitude} onChange={set('latitude')} className={inputCls} /></FormField>
          <FormField label={t('देशान्तर', 'Longitude')}><input type="number" step="any" value={form.longitude} onChange={set('longitude')} className={inputCls} /></FormField>
          <div className="sm:col-span-2"><button className="bg-agri-green text-white px-4 py-2 rounded text-sm">{t('सुरक्षित गर्नुहोस्', 'Save')}</button></div>
        </form>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {sites.length === 0 && !error && <p className="text-gray-500">{t('कुनै साइट छैन', 'No sites yet')}</p>}
        {sites.map((s) => (
          <Link key={s.id} to={`/app/smart-farming/sites/${s.id}`} className="bg-white rounded-lg shadow hover:shadow-lg transition p-5 border-t-4 border-agri-green">
            <p className="text-xs text-gray-500">{s.code} · {s.site_type}</p>
            <h3 className="font-semibold text-gov-blue text-lg">{lang === 'en' ? s.name_en : s.name_ne}</h3>
            <p className="text-sm text-gray-600">{(lang === 'en' ? s.local_level_en : s.local_level_ne) || s.address || '-'}</p>
            <div className="mt-3 flex gap-4 text-sm">
              <span>🌱 {s.unit_count} {t('इकाई', 'units')}</span>
              <span>📟 {s.device_count} {t('यन्त्र', 'devices')}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

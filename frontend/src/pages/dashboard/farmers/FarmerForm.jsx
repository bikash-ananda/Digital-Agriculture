import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';

const empty = { full_name_en: '', full_name_ne: '', gender: '', date_of_birth: '', phone: '', email: '', local_level_id: '', ward_no: '', address: '', group_name: '' };

export default function FarmerForm() {
  const { i18n } = useTranslation();
  const t = (ne, en) => (i18n.language === 'en' ? en : ne);
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [levels, setLevels] = useState([]);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/lookups/local-levels').then((r) => setLevels(r.data));
    if (id) {
      api.get(`/farmers/${id}`).then((r) => {
        const f = r.data.farmer;
        setForm({
          ...empty,
          ...Object.fromEntries(Object.keys(empty).map((k) => [k, f[k] ?? ''])),
          date_of_birth: f.date_of_birth ? String(f.date_of_birth).slice(0, 10) : ''
        });
      });
    }
  }, [id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setBusy(true);
    try {
      const res = id ? await api.put(`/farmers/${id}`, form) : await api.post('/farmers', form);
      navigate(`/app/farmers/${id || res.data.id}`);
    } catch (err) {
      const d = err.response?.data;
      setErrors(d?.errors?.map((x) => `${x.field}: ${x.message}`) || [d?.message || 'Request failed']);
    } finally { setBusy(false); }
  };

  const Field = ({ label, k, type = 'text', required }) => (
    <label className="block">
      <span className="text-sm font-medium">{label}{required && ' *'}</span>
      <input type={type} value={form[k]} onChange={set(k)} required={required} className="mt-1 w-full border rounded p-2" />
    </label>
  );

  return (
    <form onSubmit={submit} className="max-w-3xl bg-white rounded shadow p-6">
      <h2 className="text-2xl font-bold text-gov-blue mb-4">{id ? t('कृषक सम्पादन', 'Edit Farmer') : t('नयाँ कृषक दर्ता', 'Register Farmer')}</h2>
      {errors.length > 0 && <ul role="alert" className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm list-disc pl-6">{errors.map((x, i) => <li key={i}>{x}</li>)}</ul>}
      <div className="grid sm:grid-cols-2 gap-4">
        {Field({ label: t('पूरा नाम (अंग्रेजी)', 'Full Name (English)'), k: 'full_name_en', required: true })}
        {Field({ label: t('पूरा नाम (नेपाली)', 'Full Name (Nepali)'), k: 'full_name_ne' })}
        <label className="block">
          <span className="text-sm font-medium">{t('लिङ्ग', 'Gender')}</span>
          <select value={form.gender} onChange={set('gender')} className="mt-1 w-full border rounded p-2 bg-white">
            <option value="">-</option>
            <option value="male">{t('पुरुष', 'Male')}</option>
            <option value="female">{t('महिला', 'Female')}</option>
            <option value="other">{t('अन्य', 'Other')}</option>
          </select>
        </label>
        {Field({ label: t('जन्म मिति', 'Date of Birth'), k: 'date_of_birth', type: 'date' })}
        {Field({ label: t('फोन', 'Phone'), k: 'phone' })}
        {Field({ label: t('इमेल', 'Email'), k: 'email', type: 'email' })}
        <label className="block">
          <span className="text-sm font-medium">{t('स्थानीय तह', 'Local Level')}</span>
          <select value={form.local_level_id} onChange={set('local_level_id')} className="mt-1 w-full border rounded p-2 bg-white">
            <option value="">-</option>
            {levels.map((l) => <option key={l.id} value={l.id}>{i18n.language === 'en' ? l.name_en : l.name_ne}</option>)}
          </select>
        </label>
        {Field({ label: t('वडा नं.', 'Ward No.'), k: 'ward_no', type: 'number' })}
        {Field({ label: t('ठेगाना', 'Address'), k: 'address' })}
        {Field({ label: t('समूह / सहकारी', 'Group / Cooperative'), k: 'group_name' })}
      </div>
      <div className="mt-6 flex gap-3">
        <button disabled={busy} className="bg-agri-green hover:bg-green-800 text-white px-5 py-2 rounded font-semibold disabled:opacity-60">{t('सुरक्षित गर्नुहोस्', 'Save')}</button>
        <Link to={id ? `/app/farmers/${id}` : '/app/farmers'} className="px-5 py-2 border rounded">{t('रद्द', 'Cancel')}</Link>
      </div>
    </form>
  );
}

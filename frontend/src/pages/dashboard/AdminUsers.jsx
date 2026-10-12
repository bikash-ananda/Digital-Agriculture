import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import useT from '../../utils/useT';
import { useAuth } from '../../context/AuthContext';
import PasswordInput from '../../components/auth/PasswordInput';
import { apiMessages } from '../../utils/passwordHints';

const ROLES = [
  ['office_admin', 'Office administrator'], ['agriculture_officer', 'Agriculture officer'],
  ['agriculture_technician', 'Agriculture technician'], ['iot_operator', 'IoT operator'],
  ['content_manager', 'Content manager'], ['farmer', 'Farmer'], ['learner', 'Learner']
];

export default function AdminUsers() {
  const { t } = useT();
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('super_admin');
  const [status, setStatus] = useState('pending');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ fullName: '', email: '', phone: '+977', password: '', roleCode: 'agriculture_officer' });

  const loadUsers = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await api.get('/auth/admin/users', { params: { status } }); setUsers(response.data.users || []); }
    catch (err) { setError(apiMessages(err)[0]); }
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const approve = async (id) => {
    setBusyId(id); setError(''); setNotice('');
    try { const response = await api.patch(`/auth/admin/users/${id}/approve`); setNotice(response.data.message); await loadUsers(); }
    catch (err) { setError(apiMessages(err)[0]); }
    finally { setBusyId(null); }
  };

  const create = async (e) => {
    e.preventDefault(); setError(''); setNotice(''); setBusyId('create');
    try {
      const response = await api.post('/auth/admin/users', { ...form, fullName: form.fullName.trim(), email: form.email.trim() });
      setNotice(response.data.message);
      setForm({ fullName: '', email: '', phone: '+977', password: '', roleCode: 'agriculture_officer' });
      setStatus('pending');
      await loadUsers();
    } catch (err) { setError(apiMessages(err)[0]); }
    finally { setBusyId(null); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <header>
        <p className="text-sm font-semibold text-agri-green">{t('खाता व्यवस्थापन', 'Account management')}</p>
        <h1 className="text-3xl font-bold text-terrace-900">{t('खाता प्रमाणीकरण र स्वीकृति', 'Account verification and approval')}</h1>
        <p className="mt-2 text-gray-700">{t('इमेल र मोबाइल प्रमाणित भएका खातालाई यहाँ समीक्षा गरी स्वीकृत गर्नुहोस्।', 'Review accounts here after users have verified both their email and mobile number.')}</p>
      </header>

      {error && <div role="alert" className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
      {notice && <div role="status" className="p-3 rounded-md bg-green-50 border border-green-200 text-green-900 text-sm">{notice}</div>}

      {isSuperAdmin && <section className="bg-white rounded-xl shadow p-6 md:p-8">
        <h2 className="text-xl font-bold text-terrace-900">{t('प्रशासक वा कर्मचारी खाता बनाउनुहोस्', 'Create an administrator or staff account')}</h2>
        <p className="mt-1 text-sm text-gray-600">{t('नयाँ ID इमेल ठेगाना हुनेछ। प्रयोगकर्ताले OTP प्रमाणित गरेपछि प्रशासकले स्वीकृत गर्नुपर्छ।', 'The email address becomes the login ID. After OTP verification, an administrator must approve the account.')}</p>
        <form onSubmit={create} className="mt-5 grid md:grid-cols-2 gap-4">
          <div><label htmlFor="admin-name" className="block text-sm font-semibold">{t('पूरा नाम', 'Full name')}</label><input id="admin-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required maxLength={150} className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2.5" /></div>
          <div><label htmlFor="admin-email" className="block text-sm font-semibold">{t('इमेल / लगइन ID', 'Email / login ID')}</label><input id="admin-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={150} className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2.5" /></div>
          <div><label htmlFor="admin-phone" className="block text-sm font-semibold">{t('मोबाइल (देशको कोडसहित)', 'Mobile (with country code)')}</label><input id="admin-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2.5" /></div>
          <div><label htmlFor="admin-role" className="block text-sm font-semibold">{t('भूमिका', 'Role')}</label><select id="admin-role" value={form.roleCode} onChange={(e) => setForm({ ...form, roleCode: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2.5 bg-white">{ROLES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div>
          <div className="md:col-span-2"><PasswordInput id="admin-initial-password" label={t('अस्थायी पासवर्ड', 'Temporary password')} value={form.password} onChange={(password) => setForm({ ...form, password })} autoComplete="new-password" hints ctx={{ email: form.email }} /></div>
          <div className="md:col-span-2"><button disabled={busyId === 'create'} className="bg-terrace-800 hover:bg-terrace-900 text-white px-5 py-2.5 rounded-md font-semibold disabled:opacity-60">{busyId === 'create' ? '…' : t('खाता बनाउनुहोस् र कोड पठाउनुहोस्', 'Create account and send codes')}</button></div>
        </form>
      </section>}

      <section className="bg-white rounded-xl shadow p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-bold text-terrace-900">{t('प्रयोगकर्ता खाताहरू', 'User accounts')}</h2><p className="text-sm text-gray-600">{t('प्रमाणीकरण र स्वीकृतिको अवस्था', 'Verification and approval status')}</p></div>
          <label className="text-sm font-semibold">{t('फिल्टर', 'Filter')} <select value={status} onChange={(e) => setStatus(e.target.value)} className="ml-2 border border-gray-300 rounded-md px-3 py-2 bg-white"><option value="pending">{t('स्वीकृति पर्खँदै', 'Pending')}</option><option value="active">{t('सक्रिय', 'Active')}</option><option value="all">{t('सबै', 'All')}</option></select></label>
        </div>
        {loading ? <p className="py-8 text-center text-gray-600">{t('लोड हुँदैछ…', 'Loading…')}</p> : users.length === 0 ? <p className="py-8 text-center text-gray-600">{t('यस फिल्टरमा खाता छैन।', 'No accounts in this filter.')}</p> : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead><tr><th className="p-3">{t('खाता', 'Account')}</th><th className="p-3">{t('सम्पर्क पुष्टि', 'Contacts verified')}</th><th className="p-3">{t('भूमिका / अवस्था', 'Role / status')}</th><th className="p-3">{t('कार्य', 'Action')}</th></tr></thead>
              <tbody>{users.map((item) => {
                const roles = Array.isArray(item.roles) ? item.roles.join(', ') : item.roles;
                const canApprove = item.status === 'pending' && item.emailVerified && item.phoneVerified;
                return <tr key={item.id} className="border-t border-terrace-100 align-top">
                  <td className="p-3"><strong>{item.fullName || '—'}</strong><br /><span>{item.email}</span><br /><span className="text-gray-600">{item.phone}</span></td>
                  <td className="p-3"><span className={item.emailVerified ? 'text-green-700' : 'text-amber-700'}>{item.emailVerified ? '✓' : '○'} {t('इमेल', 'Email')}</span><br /><span className={item.phoneVerified ? 'text-green-700' : 'text-amber-700'}>{item.phoneVerified ? '✓' : '○'} {t('मोबाइल', 'Mobile')}</span></td>
                  <td className="p-3"><span className="capitalize">{String(roles || '—').replaceAll('_', ' ')}</span><br /><span className="capitalize text-gray-600">{item.status}</span></td>
                  <td className="p-3">{item.status === 'pending' ? <button type="button" disabled={!canApprove || busyId === item.id} onClick={() => approve(item.id)} className="bg-agri-green text-white px-3 py-1.5 rounded-md disabled:opacity-40">{busyId === item.id ? '…' : t('स्वीकृत गर्नुहोस्', 'Approve')}</button> : <span className="text-gray-500">—</span>}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

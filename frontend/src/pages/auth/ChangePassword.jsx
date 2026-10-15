import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import useT from '../../utils/useT';
import { useAuth } from '../../context/useAuth';
import PasswordInput from '../../components/auth/PasswordInput';
import { apiMessages } from '../../utils/passwordHints';

export default function ChangePassword() {
  const { t } = useT();
  const { user, loading, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [errs, setErrs] = useState([]);
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="p-10 text-center text-gray-600">…</div>;
  if (!user) return <Navigate to="/login" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErrs([]);
    if (pw !== pw2) { setErrs([t('दुई पासवर्ड मिलेनन्', 'The two new passwords do not match')]); return; }
    setBusy(true);
    try { await api.post('/auth/change-password', { current_password: cur, new_password: pw }); await refresh(); navigate('/app', { replace: true }); }
    catch (err) { setErrs(apiMessages(err)); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 md:py-16">
      <form onSubmit={submit} className="bg-white rounded-xl shadow p-8 border-t-4 border-agri-green space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">{t('पासवर्ड परिवर्तन', 'Change your password')}</h1>
        {user.mustChangePassword && <p className="p-3 rounded-md bg-yellow-50 border border-yellow-300 text-yellow-900 text-sm">{t('तपाईं अस्थायी पासवर्ड प्रयोग गर्दै हुनुहुन्छ। जारी राख्न नयाँ, बलियो पासवर्ड बनाउनुहोस्।', 'You are using a temporary password. Choose a new, strong password to continue.')}</p>}
        {errs.length > 0 && <ul role="alert" className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm list-disc pl-6">{errs.map((x, i) => <li key={i}>{x}</li>)}</ul>}
        <PasswordInput id="cp" label={t('हालको पासवर्ड', 'Current password')} value={cur} onChange={setCur} autoComplete="current-password" />
        <PasswordInput id="np" label={t('नयाँ पासवर्ड', 'New password')} value={pw} onChange={setPw} autoComplete="new-password" hints ctx={{ username: user.username, email: user.email }} />
        <PasswordInput id="np2" label={t('नयाँ पासवर्ड पुनः लेख्नुहोस्', 'Repeat the new password')} value={pw2} onChange={setPw2} autoComplete="new-password" />
        <button disabled={busy} className="w-full bg-agri-green hover:bg-green-800 text-white py-3 rounded-md font-semibold disabled:opacity-60">{busy ? '…' : t('पासवर्ड बदल्नुहोस्', 'Change password')}</button>
        <p className="text-sm text-gray-600">{user.mustChangePassword
          ? <button type="button" onClick={async () => { await logout(); navigate('/login'); }} className="text-gov-blue underline">{t('लगआउट', 'Sign out')}</button>
          : <Link to="/app" className="text-gov-blue underline">{t('रद्द गर्नुहोस्', 'Cancel')}</Link>}</p>
      </form>
    </div>
  );
}

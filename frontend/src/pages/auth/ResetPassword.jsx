import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import useT from '../../utils/useT';
import PasswordInput from '../../components/auth/PasswordInput';
import { apiMessages } from '../../utils/passwordHints';

export default function ResetPassword() {
  const { t } = useT();
  const [params] = useSearchParams();
  const [token] = useState(() => params.get('token') || '');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [errs, setErrs] = useState([]);
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  // keep the secret out of the address bar, browser history and Referer headers
  useEffect(() => { if (token) window.history.replaceState(null, '', '/reset-password'); }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setErrs([]);
    if (pw !== pw2) { setErrs([t('दुई पासवर्ड मिलेनन्', 'The two passwords do not match')]); return; }
    setBusy(true);
    try { const r = await api.post('/auth/reset-password', { token, password: pw }); setDone(r.data.message); } catch (err) { setErrs(apiMessages(err)); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 md:py-16">
      <div className="bg-white rounded-xl shadow p-8 border-t-4 border-agri-green">
        <h1 className="text-2xl font-bold text-gray-900">{t('नयाँ पासवर्ड बनाउनुहोस्', 'Choose a new password')}</h1>
        {!token && !done && (
          <div className="mt-4 space-y-3">
            <p className="p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-900 text-sm">{t('यो लिङ्क अधुरो छ वा पहिले नै प्रयोग भइसकेको छ।', 'This link is incomplete or was already used.')}</p>
            <Link to="/forgot-password" className="text-gov-blue underline text-sm">{t('नयाँ लिङ्क मगाउनुहोस्', 'Request a new link')}</Link>
          </div>
        )}
        {done && (
          <div className="mt-4 space-y-3">
            <p role="status" className="p-3 rounded-md bg-green-50 border border-green-200 text-green-900 text-sm">{done}</p>
            <Link to="/login" className="inline-block bg-agri-green text-white px-5 py-2.5 rounded-md font-semibold">{t('लगइन गर्नुहोस्', 'Sign in')}</Link>
          </div>
        )}
        {token && !done && (
          <form onSubmit={submit} className="mt-4 space-y-4">
            {errs.length > 0 && <ul role="alert" className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm list-disc pl-6">{errs.map((x, i) => <li key={i}>{x}</li>)}</ul>}
            <PasswordInput id="np" label={t('नयाँ पासवर्ड', 'New password')} value={pw} onChange={setPw} autoComplete="new-password" hints />
            <PasswordInput id="np2" label={t('पासवर्ड पुनः लेख्नुहोस्', 'Repeat the password')} value={pw2} onChange={setPw2} autoComplete="new-password" />
            <button disabled={busy} className="w-full bg-agri-green hover:bg-green-800 text-white py-3 rounded-md font-semibold disabled:opacity-60">{busy ? '…' : t('पासवर्ड बदल्नुहोस्', 'Change password')}</button>
          </form>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import useT from '../../utils/useT';
import PasswordInput from '../../components/auth/PasswordInput';
import { apiMessages } from '../../utils/passwordHints';

export default function ForgotPassword() {
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [requested, setRequested] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const requestCode = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setRequested(true);
    } catch (err) { setError(apiMessages(err)[0]); }
    finally { setBusy(false); }
  };

  const reset = async (e) => {
    e.preventDefault(); setError('');
    if (password !== confirmation) { setError(t('दुई पासवर्ड मिलेनन्', 'The two passwords do not match')); return; }
    setBusy(true);
    try {
      const response = await api.post('/auth/reset-password', { email: email.trim(), code: code.trim(), password });
      setDone(true);
      setError(response.data.message || '');
    } catch (err) { setError(apiMessages(err)[0]); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 md:py-16">
      <div className="bg-white rounded-xl shadow p-8 border-t-4 border-agri-green">
        <h1 className="text-2xl font-bold text-gray-900">{t('पासवर्ड रिसेट', 'Reset your password')}</h1>
        {done ? (
          <div className="mt-5 space-y-3">
            <p role="status" className="p-3 rounded-md bg-green-50 border border-green-200 text-green-900 text-sm">{error}</p>
            <Link to="/login" className="inline-block text-gov-blue underline text-sm">{t('लगइनमा फर्कनुहोस्', 'Back to sign in')}</Link>
          </div>
        ) : !requested ? (
          <form onSubmit={requestCode} className="mt-4">
            <p className="text-sm text-gray-700">{t('खातामा दर्ता भएको इमेल लेख्नुहोस्। हामी छ-अङ्कको रिसेट कोड पठाउँछौं।', 'Enter the email address on your account. We will send a six-digit reset code.')}</p>
            {error && <div role="alert" className="mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
            <label htmlFor="reset-email" className="block mt-4 text-sm font-semibold text-gray-800">{t('इमेल', 'Email')}</label>
            <input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2.5 bg-white" />
            <button disabled={busy} className="mt-6 w-full bg-agri-green hover:bg-green-800 text-white py-3 rounded-md font-semibold disabled:opacity-60">{busy ? '…' : t('रिसेट कोड पठाउनुहोस्', 'Send reset code')}</button>
          </form>
        ) : (
          <form onSubmit={reset} className="mt-4 space-y-4">
            <p className="text-sm text-gray-700">{t('यदि यो इमेल सक्रिय खातामा छ भने रिसेट कोड पठाइएको छ। कोड १० मिनेटमा समाप्त हुन्छ।', 'If this email belongs to an active account, a reset code has been sent. It expires in 10 minutes.')}</p>
            {error && <div role="alert" className={`p-3 rounded-md text-sm ${done ? 'bg-green-50 border border-green-200 text-green-900' : 'bg-red-50 border border-red-200 text-red-800'}`}>{error}</div>}
            <label htmlFor="reset-code" className="block text-sm font-semibold text-gray-800">{t('इमेलमा आएको छ-अङ्कको कोड', 'Six-digit email code')}</label>
            <input id="reset-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required className="w-full border border-gray-300 rounded-md px-3 py-2.5 bg-white tracking-[0.3em]" />
            <PasswordInput id="reset-password" label={t('नयाँ पासवर्ड', 'New password')} value={password} onChange={setPassword} autoComplete="new-password" hints ctx={{ email }} />
            <PasswordInput id="reset-confirmation" label={t('पासवर्ड फेरि लेख्नुहोस्', 'Confirm new password')} value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
            <button disabled={busy} className="w-full bg-agri-green hover:bg-green-800 text-white py-3 rounded-md font-semibold disabled:opacity-60">{busy ? '…' : t('पासवर्ड रिसेट गर्नुहोस्', 'Reset password')}</button>
            <button type="button" onClick={() => { setRequested(false); setError(''); }} className="text-sm text-gov-blue underline">{t('अर्को इमेल प्रयोग गर्नुहोस्', 'Use a different email')}</button>
          </form>
        )}
        {!done && <p className="mt-4 text-sm"><Link to="/login" className="text-gov-blue underline">{t('लगइनमा फर्कनुहोस्', 'Back to sign in')}</Link></p>}
      </div>
    </div>
  );
}

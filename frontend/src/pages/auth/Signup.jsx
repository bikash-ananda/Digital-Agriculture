import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import useT from '../../utils/useT';
import PasswordInput from '../../components/auth/PasswordInput';
import { apiMessages } from '../../utils/passwordHints';

export default function Signup() {
  const { t } = useT();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+977');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [step, setStep] = useState('details');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const deliveryNote = (delivery) => {
    if (!delivery) return '';
    const emailMessage = delivery.email === 'console'
      ? t('इमेल कोड backend terminal मा छ।', 'Email code is in the backend terminal.')
      : delivery.email === 'failed'
        ? t('इमेल पठाउन सकेन। SMTP सेटअप जाँच्नुहोस्।', 'Email was not delivered. Check SMTP setup.')
        : t('इमेल कोड पठाइयो।', 'Email code sent.');
    const phoneMessage = delivery.phone === 'console'
      ? t('WhatsApp सेटअप नभएकाले मोबाइल कोड backend terminal मा छ।', 'WhatsApp is not configured; the mobile code is in the backend terminal.')
      : delivery.phone === 'failed'
        ? t('WhatsApp कोड पठाउन सकेन। Twilio WhatsApp सेटअप जाँच्नुहोस्।', 'WhatsApp code was not delivered. Check Twilio WhatsApp setup.')
        : t('WhatsApp कोड पठाइयो; यो १ मिनेटमा समाप्त हुन्छ।', 'WhatsApp code sent; it expires in 1 minute.');
    return `${emailMessage} ${phoneMessage}`;
  };

  const begin = async (e) => {
    e.preventDefault(); setError('');
    if (password !== confirmation) { setError(t('दुई पासवर्ड मिलेनन्', 'The two passwords do not match')); return; }
    setBusy(true);
    try {
      const response = await api.post('/auth/register', { fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), password });
      setNotice(`${response.data.message} ${deliveryNote(response.data.delivery)}`);
      setStep('verify');
    } catch (err) { setError(apiMessages(err)[0]); }
    finally { setBusy(false); }
  };

  const verify = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const response = await api.post('/auth/verify-registration', { email: email.trim(), emailCode, phoneCode });
      setNotice(`${response.data.message} ${deliveryNote(response.data.delivery)}`);
      setStep('pending');
    } catch (err) { setError(apiMessages(err)[0]); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    setError(''); setBusy(true);
    try {
      const response = await api.post('/auth/resend-verification', { email: email.trim() });
      setNotice(response.data.message);
    } catch (err) { setError(apiMessages(err)[0]); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12 md:py-16">
      <div className="bg-white rounded-xl shadow p-8 md:p-10 border-t-4 border-agri-green">
        <p className="text-sm font-semibold text-agri-green">{t('खाता प्रमाणीकरण', 'Account verification')}</p>
        <h1 className="mt-1 text-3xl font-bold text-terrace-900">{t('खाता बनाउनुहोस्', 'Create your account')}</h1>
        {error && <div role="alert" className="mt-5 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}

        {step === 'details' && (
          <form onSubmit={begin} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-gray-800" htmlFor="signup-name">{t('पूरा नाम', 'Full name')}</label>
            <input id="signup-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required maxLength={150} className="w-full border border-gray-300 rounded-md px-3 py-2.5" />
            <label className="block text-sm font-semibold text-gray-800" htmlFor="signup-email">{t('इमेल (यही तपाईंको प्रयोगकर्ता ID हुनेछ)', 'Email (this becomes your user ID)')}</label>
            <input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={150} className="w-full border border-gray-300 rounded-md px-3 py-2.5" />
            <label className="block text-sm font-semibold text-gray-800" htmlFor="signup-phone">{t('मोबाइल नम्बर (देशको कोडसहित)', 'Mobile number (include country code)')}</label>
            <input id="signup-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+977 98XXXXXXXX" required className="w-full border border-gray-300 rounded-md px-3 py-2.5" />
            <PasswordInput id="signup-password" label={t('पासवर्ड', 'Password')} value={password} onChange={setPassword} autoComplete="new-password" hints ctx={{ email }} />
            <PasswordInput id="signup-confirm" label={t('पासवर्ड फेरि लेख्नुहोस्', 'Confirm password')} value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
            <p className="text-sm text-gray-600">{t('इमेल र मोबाइल दुवै प्रमाणित भएपछि कार्यालय प्रशासकले खाता स्वीकृत गर्नेछ।', 'After you verify both email and mobile, an office administrator will review your account.')}</p>
            <button disabled={busy} className="w-full bg-agri-green hover:bg-green-800 text-white py-3 rounded-md font-semibold disabled:opacity-60">{busy ? '…' : t('दर्ता गरी कोड पठाउनुहोस्', 'Register and send codes')}</button>
          </form>
        )}

        {step === 'verify' && (
          <form onSubmit={verify} className="mt-6 space-y-4">
            <p className="text-sm text-gray-700">{notice} <span className="font-semibold break-all">{email}</span></p>
            <p className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">{t('WhatsApp कोड १ मिनेट र इमेल कोड १० मिनेट मान्य हुन्छ।', 'The WhatsApp code is valid for 1 minute and the email code for 10 minutes.')}</p>
            <label htmlFor="signup-email-code" className="block text-sm font-semibold text-gray-800">{t('इमेल कोड', 'Email code')}</label>
            <input id="signup-email-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={emailCode} onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required className="w-full border border-gray-300 rounded-md px-3 py-2.5 tracking-[0.3em]" />
            <label htmlFor="signup-phone-code" className="block text-sm font-semibold text-gray-800">{t('SMS मोबाइल कोड', 'SMS mobile code')}</label>
            <input id="signup-phone-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required className="w-full border border-gray-300 rounded-md px-3 py-2.5 tracking-[0.3em]" />
            <button disabled={busy} className="w-full bg-agri-green hover:bg-green-800 text-white py-3 rounded-md font-semibold disabled:opacity-60">{busy ? '…' : t('इमेल र मोबाइल प्रमाणित गर्नुहोस्', 'Verify email and mobile')}</button>
            <button type="button" disabled={busy} onClick={resend} className="text-sm text-gov-blue underline disabled:opacity-60">{t('नयाँ कोड पठाउनुहोस्', 'Resend codes')}</button>
          </form>
        )}

        {step === 'pending' && (
          <div className="mt-6 space-y-4">
            <p role="status" className="rounded-md bg-green-50 border border-green-200 p-4 text-green-900">{notice}</p>
            <p className="text-sm text-gray-700">{t('प्रशासकले स्वीकृत गरेपछि यही इमेल ID बाट लगइन गर्न सक्नुहुन्छ।', 'Once an administrator approves your account, sign in with this email ID.')}</p>
            <Link to="/login" className="inline-block bg-terrace-800 text-white px-5 py-2.5 rounded-md font-semibold">{t('लगइनमा जानुहोस्', 'Go to sign in')}</Link>
          </div>
        )}

        <p className="mt-6 text-sm text-gray-600">{t('पहिले नै खाता छ?', 'Already registered?')} <Link to="/login" className="text-gov-blue underline">{t('लगइन', 'Sign in')}</Link></p>
      </div>
    </div>
  );
}

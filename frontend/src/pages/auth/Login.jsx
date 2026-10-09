import { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import useLang from '../../utils/useLang';
import { useAuth } from '../../context/AuthContext';
import HeroLandscape from '../../components/layout/HeroLandscape';

export default function Login() {
  const { lang, t } = useLang();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await login(username.trim(), password);
      navigate(location.state?.from?.pathname || '/app', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || t('सर्भरमा जडान गर्न सकिएन। इन्टरनेट जाँच्नुहोस् र फेरि प्रयास गर्नुहोस्।', 'Cannot reach the server. Check your connection and try again.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:py-16">
      <div className="grid md:grid-cols-5 bg-white rounded-xl overflow-hidden shadow">
        <div className="hidden md:block md:col-span-2 relative hero-sky min-h-[440px]">
          <div className="relative z-10 p-8">
            <h2 className="text-2xl font-bold text-terrace-900 leading-snug">{t('कृषक, प्राविधिक र अधिकृतका लागि सुरक्षित प्रवेश', 'Secure sign-in for farmers, technicians and officers')}</h2>
            <p className="mt-3 text-sm text-gray-700">{t('तपाईंको भूमिका अनुसारका सेवा र तथ्याङ्क मात्र देखिनेछन्।', 'You will see only the services and data that your role allows.')}</p>
          </div>
          <HeroLandscape tunnel={false} className="absolute inset-x-0 bottom-0 w-full h-3/5" />
        </div>
        <form onSubmit={submit} className="md:col-span-3 p-8 md:p-12">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gov-blue hover:underline"><ArrowLeft size={14} aria-hidden="true" /> {t('वेबसाइटमा फर्कनुहोस्', 'Back to the website')}</Link>
          <h1 className="mt-4 text-3xl font-bold text-terrace-900">{t('प्रणालीमा लगइन गर्नुहोस्', 'Sign in')}</h1>
          {error && <div role="alert" className="mt-5 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}
          <label htmlFor="username" className="block mt-6 text-sm font-semibold text-terrace-800">{t('प्रयोगकर्ता नाम वा इमेल', 'Username or email')}</label>
          <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2.5 bg-white" />
          <label htmlFor="password" className="block mt-4 text-sm font-semibold text-terrace-800">{t('पासवर्ड', 'Password')}</label>
          <div className="relative mt-1">
            <input id="password" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required className="w-full border border-gray-300 rounded-md px-3 py-2.5 pr-11 bg-white" />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-terrace-800">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          <button disabled={busy} className="mt-7 w-full bg-terrace-800 hover:bg-terrace-900 text-white py-3 rounded-md font-semibold disabled:opacity-60">{busy ? t('जाँच गर्दै…', 'Signing in…') : t('लगइन', 'Sign in')}</button>
          <p className="mt-5 text-sm text-gray-600">{t('खाता छैन भने कार्यालयमा सम्पर्क गर्नुहोस्।', 'If you do not have an account, contact the office.')}</p>
        </form>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { ArrowLeft, Globe, LoaderCircle, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useLang from '../../utils/useLang';
import { useAuth } from '../../context/AuthContext';
import HeroLandscape from '../../components/layout/HeroLandscape';
import PasswordInput from '../../components/auth/PasswordInput';

export default function Login() {
  const { lang, t } = useLang();
  const { i18n } = useTranslation();
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return (
    <div className="min-h-[60vh] grid place-items-center" role="status" aria-live="polite">
      <span className="inline-flex items-center gap-2 text-terrace-800"><LoaderCircle className="animate-spin" size={20} />{t('प्रवेश जाँच हुँदैछ…', 'Checking your session…')}</span>
    </div>
  );
  if (user) return <Navigate to={user.mustChangePassword ? '/change-password' : '/app'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const signedIn = await login(email.trim(), password);
      const returnTo = location.state?.from;
      navigate(signedIn.mustChangePassword ? '/change-password' : `${returnTo?.pathname || '/app'}${returnTo?.search || ''}`, { replace: true });
    } catch (err) {
      setError(!err.response || err.code === 'ERR_NETWORK'
        ? t('सर्भरमा जडान हुन सकेन। इन्टरनेट जाँचेर फेरि प्रयास गर्नुहोस्।', 'Could not connect to the server. Check your internet connection and try again.')
        : (err.response?.data?.message || t('लगइन सफल भएन। विवरण जाँचेर फेरि प्रयास गर्नुहोस्।', 'Sign-in failed. Check your details and try again.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-12">
      <div className="grid md:grid-cols-5 bg-white rounded-2xl overflow-hidden shadow-xl ring-1 ring-terrace-900/5">
        <aside className="relative md:col-span-2 min-h-[170px] md:min-h-[560px] overflow-hidden bg-gradient-to-b from-sky-50 to-emerald-100">
          <div className="relative z-10 p-5 md:p-8">
            <div className="flex items-center gap-3">
              <img src="/images/nepal-gov-logo.png" alt="" className="w-11 h-11 md:w-14 md:h-14 object-contain" />
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-terrace-700">{t('डिजिटल कृषि', 'Digital Agriculture')}</p>
                <h2 className="font-bold text-terrace-900 text-lg md:text-2xl leading-tight">{t('स्मार्ट फार्मिङ', 'Smart Farming')}</h2>
              </div>
            </div>
            <p className="hidden md:block mt-8 max-w-xs text-lg font-semibold leading-snug text-terrace-900">{t('कृषक, प्राविधिक र अधिकृतका लागि सुरक्षित प्रवेश', 'Secure access for farmers, technicians and officers')}</p>
            <p className="hidden md:block mt-2 max-w-xs text-sm text-terrace-800">{t('तपाईंको भूमिकाअनुसार फार्म र सेवाहरूमा पहुँच गर्नुहोस्।', 'Access farms and services available to your role.')}</p>
          </div>
          <HeroLandscape tunnel={false} className="absolute inset-x-0 bottom-0 h-[62%] w-full" />
        </aside>

        <form onSubmit={submit} aria-busy={busy} className="md:col-span-3 p-5 sm:p-8 md:p-12">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-gov-blue hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              <ArrowLeft size={16} aria-hidden="true" /> {t('वेबसाइटमा फर्कनुहोस्', 'Back to website')}
            </Link>
            <button type="button" onClick={() => i18n.changeLanguage(lang === 'ne' ? 'en' : 'ne')} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-terrace-200 px-3 text-sm font-semibold text-terrace-800 hover:bg-terrace-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={t('भाषा English मा बदल्नुहोस्', 'Switch language to Nepali')}>
              <Globe size={16} aria-hidden="true" /> {lang === 'ne' ? 'English' : 'नेपाली'}
            </button>
          </div>

          <h1 className="mt-6 text-3xl font-bold text-terrace-900">{t('प्रणालीमा लगइन गर्नुहोस्', 'Sign in')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('आफ्नो खाता विवरण प्रयोग गर्नुहोस्।', 'Use your account credentials to continue.')}</p>
          {error && <div role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><WifiOff size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{error}</span></div>}

          <label htmlFor="email" className="block mt-6 text-sm font-semibold text-terrace-800">{t('इमेल ठेगाना (प्रयोगकर्ता ID)', 'Email address (user ID)')}</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required disabled={busy} className="mt-1 min-h-12 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 focus:border-gov-blue focus:outline-none focus:ring-2 focus:ring-gov-blue/20 disabled:bg-gray-50" />
          <div className="mt-4"><PasswordInput id="password" label={t('पासवर्ड', 'Password')} value={password} onChange={setPassword} autoComplete="current-password" /></div>
          <div className="mt-2 text-right"><Link to="/forgot-password" className="inline-flex min-h-10 items-center text-sm font-medium text-gov-blue underline underline-offset-2">{t('पासवर्ड बिर्सनुभयो?', 'Forgot password?')}</Link></div>
          <button disabled={busy} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-terrace-800 py-3 font-semibold text-white transition hover:bg-terrace-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gov-blue disabled:cursor-wait disabled:opacity-70">
            {busy && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
            {busy ? t('जाँच हुँदैछ…', 'Signing in…') : t('लगइन', 'Sign in')}
          </button>
          {busy && <p role="status" aria-live="polite" className="mt-2 text-center text-xs text-gray-600">{t('सुरक्षित जडान पर्खनुहोस्।', 'Waiting for a secure response…')}</p>}
          <p className="mt-5 text-center text-sm text-gray-600">{t('नयाँ प्रयोगकर्ता हुनुहुन्छ?', 'New to the platform?')} <Link to="/signup" className="font-semibold text-gov-blue underline underline-offset-2">{t('खाता बनाउनुहोस्', 'Create an account')}</Link></p>
        </form>
      </div>
    </div>
  );
}

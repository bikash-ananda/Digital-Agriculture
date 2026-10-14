import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, Phone, Mail, ChevronDown, Globe, MapPin, Clock } from 'lucide-react';
import { office, nav, usefulLinks } from '../../data/office';
import AccessibilityTools from '../common/AccessibilityTools';
import LoginSupportChat from '../auth/LoginSupportChat';

export default function PublicLayout() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  const L = (o) => o[lang];
  const { pathname } = useLocation();
  const [openPath, setOpenPath] = useState(null);
  const open = openPath === pathname;
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') setOpenPath(null); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const topLink = ({ isActive }) =>
    `block px-3 py-3 text-[15px] font-medium border-b-[3px] ${isActive ? 'border-gov-red text-terrace-900' : 'border-transparent text-terrace-800 hover:text-gov-blue hover:border-terrace-100'}`;

  return (
    <div className="min-h-[100svh] flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 bg-white p-3 text-gov-blue">{lang === 'ne' ? 'मुख्य सामग्रीमा जानुहोस्' : 'Skip to main content'}</a>
      <a href="#accessibility-toggle" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-16 focus:z-[80] focus:rounded focus:bg-white focus:p-3 focus:text-gov-blue">{lang === 'ne' ? 'सहज पहुँच सेटिङमा जानुहोस्' : 'Skip to accessibility settings'}</a>

      <div className="bg-terrace-900 text-white text-sm on-dark">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
          <span>{L(office.province)} · {L(office.ministry)}</span>
          <div className="flex items-center gap-5">
            <a href={`tel:+977${office.phone.replace('-', '')}`} className="hidden sm:flex items-center gap-1.5 hover:underline"><Phone size={14} aria-hidden="true" /> {office.phone}</a>
            <a href={`mailto:${office.email}`} className="hidden md:flex items-center gap-1.5 hover:underline"><Mail size={14} aria-hidden="true" /> {office.email}</a>
            <button onClick={() => i18n.changeLanguage(lang === 'ne' ? 'en' : 'ne')} className="flex items-center gap-1.5 font-semibold hover:underline">
              <Globe size={14} aria-hidden="true" /> {lang === 'ne' ? 'English' : 'नेपाली'}
            </button>
          </div>
        </div>
      </div>

      <header className="bg-white">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center gap-4 md:gap-6">
          <Link to="/login" aria-label={lang === 'ne' ? 'साइन इन वा खाता बनाउनुहोस्' : 'Sign in or create an account'} className="shrink-0" title={lang === 'ne' ? 'साइन इन वा खाता बनाउनुहोस्' : 'Sign in or create an account'}>
            <img src="/images/nepal-gov-logo.png" alt="" className="w-16 h-16 md:w-20 md:h-20 object-contain" />
          </Link>
          <div className="min-w-0">
            <p className="font-display font-semibold text-gov-red text-base md:text-lg">{L(office.province)}</p>
            <p className="text-sm text-gray-600 hidden md:block">{L(office.ministry)}</p>
            <p className="font-display font-bold text-terrace-900 text-2xl md:text-4xl leading-tight">{L(office.name)}</p>
            <p className="text-sm text-gray-600">{L(office.city)}, {lang === 'ne' ? 'गण्डकी प्रदेश, नेपाल' : 'Gandaki Province, Nepal'}</p>
          </div>
        </div>
        <div className="h-1 bg-gov-red" />
        <div className="h-0.5 bg-gov-blue" />
      </header>

      <nav aria-label="Main" className="sticky top-0 z-40 bg-white border-b border-terrace-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between lg:hidden py-2">
            <span className="font-semibold text-terrace-800">{lang === 'ne' ? 'मेनु' : 'Menu'}</span>
            <button type="button" onClick={() => setOpenPath(open ? null : pathname)} aria-controls="public-navigation" aria-expanded={open} aria-label={open ? (lang === 'ne' ? 'मेनु बन्द गर्नुहोस्' : 'Close menu') : (lang === 'ne' ? 'मेनु खोल्नुहोस्' : 'Open menu')} className="min-h-11 min-w-11 rounded-lg p-2">{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
          </div>
          <ul id="public-navigation" className={`${open ? 'block pb-3' : 'hidden'} lg:flex lg:flex-wrap lg:items-center`}>
            {nav.map((item, i) => item.children ? (
              <li key={i} className="relative group">
                <button aria-haspopup="true" className={`flex items-center gap-1 px-3 py-3 text-[15px] font-medium border-b-[3px] w-full lg:w-auto ${item.children.some(([to]) => to === pathname) ? 'border-gov-red text-terrace-900' : 'border-transparent text-terrace-800 hover:text-gov-blue'}`}>
                  {L(item.label)} <ChevronDown size={14} aria-hidden="true" />
                </button>
                <ul className="pl-4 lg:pl-0 lg:hidden lg:group-hover:block lg:group-focus-within:block lg:absolute lg:left-0 lg:top-full lg:min-w-64 lg:bg-white lg:border lg:border-terrace-100 lg:border-t-[3px] lg:border-t-gov-red lg:shadow-lg">
                  {item.children.map(([to, label]) => (
                    <li key={to}><Link to={to} onClick={() => setOpenPath(null)} className="block px-4 py-2.5 text-[15px] text-terrace-800 hover:bg-terrace-50 hover:text-gov-blue">{L(label)}</Link></li>
                  ))}
                </ul>
              </li>
            ) : (
              <li key={i}><NavLink to={item.to} end={item.to === '/'} onClick={() => setOpenPath(null)} className={topLink}>{L(item.label)}</NavLink></li>
            ))}
          </ul>
        </div>
      </nav>

      <main id="main" tabIndex="-1" className="flex-1"><Outlet /></main>

      <footer className="bg-terrace-900 text-terrace-100 border-t-4 border-gov-red on-dark mt-16">
        <div className="max-w-7xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-10 text-[15px]">
          <div>
            <p className="font-display font-bold text-white text-lg">{L(office.name)}</p>
            <p className="mt-1">{L(office.province)}</p>
            <ul className="mt-4 space-y-2">
              <li className="flex items-start gap-2"><MapPin size={16} className="mt-1 shrink-0" aria-hidden="true" /> {L(office.city)}, {lang === 'ne' ? 'कास्की' : 'Kaski'}</li>
              <li className="flex items-center gap-2"><Phone size={16} aria-hidden="true" /> {office.phone}</li>
              <li className="flex items-center gap-2"><Mail size={16} aria-hidden="true" /> {office.email}</li>
            </ul>
          </div>
          <div>
            <p className="font-display font-bold text-white text-lg flex items-center gap-2"><Clock size={18} aria-hidden="true" /> {lang === 'ne' ? 'कार्यालय समय' : 'Office hours'}</p>
            <ul className="mt-3 space-y-1.5">{office.hours[lang].map((h, i) => <li key={i}>{h}</li>)}</ul>
          </div>
          <div>
            <p className="font-display font-bold text-white text-lg">{lang === 'ne' ? 'महत्वपूर्ण लिङ्कहरू' : 'Important links'}</p>
            <ul className="mt-3 space-y-1.5">
              {usefulLinks.slice(0, 5).map(([name, url]) => <li key={url}><a href={url} target="_blank" rel="noreferrer" className="hover:text-white hover:underline">{name}</a></li>)}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-sm text-terrace-100/80">
          © {new Date().getFullYear()} {L(office.name)} · {lang === 'ne' ? 'डिजिटल कृषि तथा स्मार्ट फार्मिङ प्लेटफर्म' : 'Digital Agriculture & Smart Farming Platform'}
        </div>
      </footer>
      <AccessibilityTools />
      {pathname === '/login' && <LoginSupportChat />}
    </div>
  );
}

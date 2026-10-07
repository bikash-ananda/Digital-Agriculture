import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X } from 'lucide-react';

const nav = [
  ['/', 'home'], ['/about', 'about'], ['/notices', 'notices'], ['/programs', 'programs'],
  ['/knowledge', 'knowledge'], ['/smart-farming', 'smart'], ['/learning', 'learning'],
  ['/downloads', 'downloads'], ['/gallery', 'gallery'], ['/contact', 'contact']
];

export default function PublicLayout() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const linkClass = ({ isActive }) =>
    `block px-3 py-3 text-sm font-medium hover:bg-green-800 ${isActive ? 'bg-green-800' : ''}`;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-gov-blue text-white text-sm">
        <div className="max-w-7xl mx-auto px-4 py-1 flex justify-between">
          <span>{t('government')} · {t('province')}</span>
          <button onClick={() => i18n.changeLanguage(i18n.language === 'ne' ? 'en' : 'ne')}
            className="underline">{i18n.language === 'ne' ? 'English' : 'नेपाली'}</button>
        </div>
      </div>

      <header className="bg-white border-b-4 border-gov-red shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <div className="w-16 h-16 shrink-0 rounded-full bg-gov-blue text-white flex items-center justify-center text-xs text-center">LOGO</div>
          <div>
            <p className="text-sm text-gray-600">{t('government')}</p>
            <h1 className="text-xl md:text-2xl font-bold text-gov-blue">{t('office')}</h1>
          </div>
        </div>
      </header>

      <nav className="bg-agri-green text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between lg:hidden py-2">
            <span className="font-semibold">Menu</span>
            <button onClick={() => setOpen(!open)} aria-label="Toggle menu">
              {open ? <X /> : <Menu />}
            </button>
          </div>
          <div className={`${open ? 'block' : 'hidden'} lg:flex lg:items-center`}>
            {nav.map(([to, key]) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={linkClass}>
                {t(key)}
              </NavLink>
            ))}
            <Link to="/login" onClick={() => setOpen(false)}
              className="lg:ml-auto my-2 inline-block bg-white text-agri-green px-4 py-2 rounded font-semibold text-sm">
              {t('login')}
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1"><Outlet /></main>

      <footer className="bg-gov-blue text-white mt-10">
        <div className="max-w-7xl mx-auto px-4 py-6 text-sm">
          © {new Date().getFullYear()} {t('office')} · {t('address')}
        </div>
      </footer>
    </div>
  );
}

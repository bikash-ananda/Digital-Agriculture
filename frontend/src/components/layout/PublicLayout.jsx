import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, Phone, Mail, ChevronDown } from 'lucide-react';
import { office, nav } from '../../data/office';

export default function PublicLayout() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  const L = (o) => o[lang];
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const top = ({ isActive }) => `block px-3 py-3 text-sm font-medium hover:bg-green-800 ${isActive ? 'bg-green-800' : ''}`;

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only bg-white p-2">Skip to main content</a>

      <div className="bg-gov-blue text-white text-sm">
        <div className="max-w-7xl mx-auto px-4 py-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-4">
            <a href={`tel:+977${office.phone.replace('-', '')}`} className="flex items-center gap-1"><Phone size={14} /> {office.phone}</a>
            <a href={`mailto:${office.email}`} className="flex items-center gap-1"><Mail size={14} /> {office.email}</a>
            <a href={office.facebook} target="_blank" rel="noreferrer" className="underline">Facebook</a>
          </div>
          <button onClick={() => i18n.changeLanguage(lang === 'ne' ? 'en' : 'ne')} className="underline">
            {lang === 'ne' ? 'English' : 'नेपाली'}
          </button>
        </div>
      </div>

      <header className="bg-white border-b-4 border-gov-red shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <img src="/images/nepal-gov-logo.png" alt="Nepal Government Logo" className="w-20 h-20 object-contain shrink-0" />
          <div className="text-center flex-1">
            <p className="text-sm md:text-base font-semibold text-gov-red">{L(office.province)}</p>
            <p className="text-xs md:text-sm text-gray-700">{L(office.ministry)}</p>
            <h1 className="text-xl md:text-3xl font-bold text-gov-blue">{L(office.name)}</h1>
            <p className="text-sm text-gray-700">{L(office.city)}</p>
          </div>
        </div>
      </header>

      <nav className="bg-agri-green text-white relative z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between lg:hidden py-2">
            <span className="font-semibold">{lang === 'ne' ? 'मेनु' : 'Menu'}</span>
            <button onClick={() => setOpen(!open)} aria-label="Toggle menu">{open ? <X /> : <Menu />}</button>
          </div>
          <ul className={`${open ? 'block' : 'hidden'} lg:flex lg:flex-wrap lg:items-center`}>
            {nav.map((item, i) => item.children ? (
              <li key={i} className="group relative">
                <span tabIndex={0} className="flex items-center gap-1 px-3 py-3 text-sm font-medium cursor-pointer hover:bg-green-800">
                  {L(item.label)} <ChevronDown size={14} />
                </span>
                <ul className="pl-4 lg:pl-0 lg:hidden lg:group-hover:block lg:group-focus-within:block lg:absolute lg:left-0 lg:top-full lg:bg-white lg:text-gray-800 lg:shadow-lg lg:min-w-56">
                  {item.children.map(([to, label]) => (
                    <li key={to}><Link to={to} onClick={close} className="block px-4 py-2 text-sm hover:bg-green-800 lg:hover:bg-green-50">{L(label)}</Link></li>
                  ))}
                </ul>
              </li>
            ) : (
              <li key={i}><NavLink to={item.to} end={item.to === '/'} onClick={close} className={top}>{L(item.label)}</NavLink></li>
            ))}
            <li className="lg:ml-auto">
              <Link to="/login" onClick={close} className="my-2 inline-block bg-white text-agri-green px-4 py-2 rounded font-semibold text-sm">
                {lang === 'ne' ? 'लगइन' : 'Login'}
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      <main id="main" className="flex-1"><Outlet /></main>

      <footer className="bg-gov-blue text-white mt-10">
        <div className="max-w-7xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <p className="font-bold text-base">{L(office.name)}</p>
            <p>{L(office.province)} · {L(office.ministry)}</p>
            <p className="mt-2">📞 {office.phone}</p>
            <p>✉️ {office.email}</p>
            <p>🌐 {office.website}</p>
          </div>
          <div>
            <p className="font-bold text-base">{lang === 'ne' ? 'कार्यालय समय' : 'Office Hours'}</p>
            {office.hours[lang].map((h, i) => <p key={i}>{h}</p>)}
          </div>
        </div>
        <div className="border-t border-blue-800 text-center text-xs py-3">© {new Date().getFullYear()} {L(office.name)}</div>
      </footer>
    </div>
  );
}

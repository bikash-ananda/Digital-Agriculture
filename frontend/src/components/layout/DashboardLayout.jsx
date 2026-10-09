import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, LogOut, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useLang from '../../utils/useLang';
import { modules, groups } from '../../data/modules';
import { ICONS } from '../../utils/icons';
import { roleLabel } from '../../utils/roles';
import { office } from '../../data/office';

export default function DashboardLayout() {
  const { i18n } = useTranslation();
  const { lang, t } = useLang();
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);

  const allowed = modules.filter((m) => !m.perm || can(m.perm));
  const current = [...modules].sort((a, b) => b.to.length - a.to.length)
    .find((m) => (m.end ? pathname === m.to : pathname === m.to || pathname.startsWith(`${m.to}/`)));
  const name = user.fullNameEn || user.username;
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const doLogout = async () => { await logout(); navigate('/login'); };

  const itemCls = ({ isActive }) =>
    `flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-r-md border-l-[3px] text-[15px] ${isActive ? 'bg-white/10 text-white border-gov-red font-semibold' : 'text-terrace-100/80 border-transparent hover:bg-white/5 hover:text-white'}`;

  return (
    <div className="min-h-screen lg:flex">
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside className={`on-dark fixed inset-y-0 left-0 z-50 w-72 bg-terrace-900 text-terrace-100 flex flex-col overflow-y-auto transform transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shrink-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <img src="/images/nepal-gov-logo.png" alt="" className="w-11 h-11 object-contain bg-white rounded-full p-1" />
          <div className="min-w-0">
            <p className="font-display font-bold text-white leading-tight">{t('डिजिटल कृषि', 'Digital Agriculture')}</p>
            <p className="text-xs text-terrace-100/70 truncate">{office.name[lang]}</p>
          </div>
          <button className="ml-auto lg:hidden p-1" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
        </div>
        <nav aria-label="Dashboard" className="flex-1 py-4 space-y-5 pr-3">
          {groups.map((g) => {
            const items = allowed.filter((m) => m.group === g.key);
            if (!items.length) return null;
            return (
              <div key={g.key}>
                <p className="px-4 pb-1.5 text-xs font-semibold text-terrace-100/55">{g.label[lang]}</p>
                <ul>
                  {items.map((m) => {
                    const Icon = ICONS[m.icon] || ICONS.LayoutDashboard;
                    return <li key={m.to}><NavLink to={m.to} end={m.end} className={itemCls}><Icon size={19} aria-hidden="true" /> {m.label[lang]}</NavLink></li>;
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-sm">
          <Link to="/" className="hover:text-white hover:underline">{t('सार्वजनिक वेबसाइट हेर्नुहोस्', 'View public website')}</Link>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white border-b border-terrace-100">
          <div className="flex items-center gap-3 px-4 md:px-8 h-16">
            <button className="lg:hidden p-1" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
            <h1 className="flex-1 min-w-0 truncate text-xl font-bold text-terrace-900">{current ? current.label[lang] : t('डिजिटल कृषि', 'Digital Agriculture')}</h1>
            <button onClick={() => i18n.changeLanguage(lang === 'ne' ? 'en' : 'ne')} className="flex items-center gap-1.5 text-sm font-medium text-terrace-800 hover:text-gov-blue">
              <Globe size={16} aria-hidden="true" /> {lang === 'ne' ? 'English' : 'नेपाली'}
            </button>
            <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-terrace-100">
              <span className="w-9 h-9 rounded-full bg-terrace-800 text-white grid place-items-center text-sm font-bold" aria-hidden="true">{initials}</span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-terrace-900">{name}</p>
                <p className="text-xs text-gray-500">{user.roles.map((r) => roleLabel(r, lang)).join(', ')}</p>
              </div>
            </div>
            <button onClick={doLogout} className="flex items-center gap-1.5 border border-terrace-800 text-terrace-800 hover:bg-terrace-50 px-3 py-1.5 rounded-md text-sm font-semibold">
              <LogOut size={15} aria-hidden="true" /> {t('लगआउट', 'Sign out')}
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}

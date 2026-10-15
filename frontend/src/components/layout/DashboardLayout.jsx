import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, X, LogOut, Globe, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import useLang from '../../utils/useLang';
import { modules, groups } from '../../data/modules';
import { ICONS } from '../../utils/icons';
import { roleLabel } from '../../utils/roles';
import { office } from '../../data/office';
import AccessibilityTools from '../common/AccessibilityTools';
import { ThemeControl, UiSoundToggle } from '../common/UiExperience';

export default function DashboardLayout() {
  const { i18n } = useTranslation();
  const { lang, t } = useLang();
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [openPath, setOpenPath] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState('auto');
  const open = openPath === pathname;
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const asideRef = useRef(null);
  const menuButtonRef = useRef(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (open && !desktop) {
      const panel = asideRef.current;
      const focusable = panel?.querySelectorAll('a[href], button:not([disabled])') || [];
      focusable[0]?.focus();
      const onKeyDown = (event) => {
        if (event.key === 'Escape') { event.preventDefault(); setOpenPath(null); }
        if (event.key !== 'Tab' || !focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      };
      document.addEventListener('keydown', onKeyDown);
      wasOpen.current = true;
      return () => document.removeEventListener('keydown', onKeyDown);
    }
    if (wasOpen.current && !desktop) menuButtonRef.current?.focus();
    wasOpen.current = false;
    return undefined;
  }, [open, desktop]);

  const allowed = modules.filter((m) => !m.perm || can(m.perm));
  const current = [...modules].sort((a, b) => b.to.length - a.to.length)
    .find((m) => (m.end ? pathname === m.to : pathname === m.to || pathname.startsWith(`${m.to}/`)));
  const activeGroup = current?.group || 'main';
  const openGroup = expandedGroup === 'auto' ? activeGroup : expandedGroup;
  const name = user.fullNameEn || user.username;
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const doLogout = async () => { await logout(); navigate('/login'); };

  const itemCls = ({ isActive }) =>
    `flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-r-md border-l-[3px] text-[15px] ${isActive ? 'bg-white/10 text-white border-gov-red font-semibold' : 'text-terrace-100/80 border-transparent hover:bg-white/5 hover:text-white'}`;

  return (
    <div className="agri-app agri-app-dashboard min-h-[100svh] lg:flex">
      <a href="#app-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded focus:bg-white focus:p-3 focus:text-gov-blue">{t('मुख्य सामग्रीमा जानुहोस्', 'Skip to main content')}</a>
      <a href="#accessibility-toggle" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-16 focus:z-[80] focus:rounded focus:bg-white focus:p-3 focus:text-gov-blue">{t('सहज पहुँच सेटिङमा जानुहोस्', 'Skip to accessibility settings')}</a>
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpenPath(null)} aria-hidden="true" />}

      <aside ref={asideRef} id="dashboard-navigation" role={open && !desktop ? 'dialog' : undefined} aria-modal={open && !desktop ? 'true' : undefined} aria-label={t('ड्यासबोर्ड नेभिगेसन', 'Dashboard navigation')} aria-hidden={!open && !desktop} inert={!open && !desktop} className={`on-dark print:hidden fixed inset-y-0 left-0 z-50 w-72 bg-terrace-900 text-terrace-100 flex flex-col overflow-y-auto transform transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shrink-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <img src="/images/nepal-gov-logo.png" alt="" className="w-11 h-11 object-contain bg-white rounded-full p-1" />
          <div className="min-w-0">
            <p className="font-display font-bold text-white leading-tight">{t('डिजिटल कृषि', 'Digital Agriculture')}</p>
            <p className="text-xs text-terrace-100/70 truncate">{office.name[lang]}</p>
          </div>
          <button type="button" className="ml-auto lg:hidden min-h-11 min-w-11 rounded-lg p-2" onClick={() => setOpenPath(null)} aria-label={t('मेनु बन्द गर्नुहोस्', 'Close menu')}><X size={20} aria-hidden="true" /></button>
        </div>
        <nav aria-label="Dashboard" className="flex-1 py-4 space-y-5 pr-3">
          {groups.map((g) => {
            const items = allowed.filter((m) => m.group === g.key);
            if (!items.length) return null;
            return (
              <div key={g.key}>
                <button type="button" aria-expanded={openGroup === g.key} onClick={() => setExpandedGroup(openGroup === g.key ? 'none' : g.key)} className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-xs font-semibold text-terrace-100/65 hover:text-white">
                  <span className="flex-1">{g.label[lang]}</span><span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{items.length}</span><ChevronDown size={15} className={`transition-transform ${openGroup === g.key ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {openGroup === g.key && <ul>
                  {items.map((m) => {
                    const Icon = ICONS[m.icon] || ICONS.LayoutDashboard;
                    return <li key={m.to}><NavLink to={m.to} end={m.end} onClick={() => { setOpenPath(null); setExpandedGroup('auto'); }} className={itemCls}><Icon size={19} aria-hidden="true" /> {m.label[lang]}</NavLink></li>;
                  })}
                </ul>}
              </div>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-sm">
          <Link to="/" onClick={() => setOpenPath(null)} className="hover:text-white hover:underline">{t('सार्वजनिक वेबसाइट हेर्नुहोस्', 'View public website')}</Link>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="print:hidden sticky top-0 z-30 bg-white border-b border-terrace-100">
          <div className="flex items-center gap-3 px-4 md:px-8 h-16">
            <button ref={menuButtonRef} type="button" className="lg:hidden min-h-11 min-w-11 rounded-lg p-2" onClick={() => setOpenPath(pathname)} aria-controls="dashboard-navigation" aria-expanded={open} aria-label={t('मेनु खोल्नुहोस्', 'Open menu')}><Menu aria-hidden="true" /></button>
            <h1 className="flex-1 min-w-0 truncate text-xl font-bold text-terrace-900">{current ? current.label[lang] : t('डिजिटल कृषि', 'Digital Agriculture')}</h1>
            <ThemeControl />
            <UiSoundToggle className="text-terrace-800 hover:bg-terrace-50" />
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
        <main id="app-main" tabIndex="-1" className="min-w-0 flex-1 p-4 sm:p-5 md:p-8"><Outlet /></main>
      </div>
      <AccessibilityTools />
    </div>
  );
}

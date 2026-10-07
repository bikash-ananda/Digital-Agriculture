import { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, LogOut, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { modules } from '../../data/modules';
import { office } from '../../data/office';

export default function DashboardLayout() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = modules.filter((m) => !m.perm || can(m.perm));
  const link = ({ isActive }) =>
    `block px-4 py-2 rounded text-sm font-medium ${isActive ? 'bg-agri-green text-white' : 'text-gray-700 hover:bg-green-50'}`;

  const doLogout = async () => { await logout(); navigate('/login'); };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-gov-blue text-white border-b-4 border-gov-red">
        <div className="px-4 py-3 flex items-center gap-3">
          <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">{open ? <X /> : <Menu />}</button>
          <img src="/images/nepal-gov-logo.png" alt="" className="w-10 h-10 object-contain bg-white rounded-full p-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">{office.name[lang]}</p>
            <p className="text-xs opacity-80 truncate">{lang === 'ne' ? 'डिजिटल कृषि तथा स्मार्ट फार्मिङ प्लेटफर्म' : 'Digital Agriculture & Smart Farming Platform'}</p>
          </div>
          <button onClick={() => i18n.changeLanguage(lang === 'ne' ? 'en' : 'ne')} className="flex items-center gap-1 text-sm underline">
            <Globe size={14} /> {lang === 'ne' ? 'English' : 'नेपाली'}
          </button>
          <div className="hidden sm:block text-right text-sm">
            <p className="font-semibold">{user.fullNameEn}</p>
            <p className="text-xs opacity-80">{user.roles.join(', ')}</p>
          </div>
          <button onClick={doLogout} className="flex items-center gap-1 bg-white text-gov-blue px-3 py-1.5 rounded text-sm font-semibold">
            <LogOut size={14} /> {lang === 'ne' ? 'लगआउट' : 'Logout'}
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className={`${open ? 'block' : 'hidden'} lg:block w-64 shrink-0 bg-white border-r p-3 space-y-1`}>
          {items.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end} onClick={() => setOpen(false)} className={link}>{m.label[lang]}</NavLink>
          ))}
          <Link to="/" className="block px-4 py-2 mt-4 text-sm text-gov-blue underline">{lang === 'ne' ? '← सार्वजनिक वेबसाइट' : '← Public website'}</Link>
        </aside>
        <main className="flex-1 p-4 md:p-6 min-w-0"><Outlet /></main>
      </div>
    </div>
  );
}

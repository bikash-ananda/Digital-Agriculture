import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Search, Cpu, Database, GraduationCap, Megaphone, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import useLang from '../../utils/useLang';
import { useAuth } from '../../context/AuthContext';
import { modules, groups } from '../../data/modules';
import { ICONS } from '../../utils/icons';
import { roleLabel } from '../../utils/roles';
import { nf } from '../../utils/dc';

const ACTIONS = [
  { perm: 'farmers.create', to: '/app/farmers/new', icon: UserPlus, ne: 'कृषक दर्ता गर्नुहोस्', en: 'Register a farmer' },
  { perm: 'farmers.view', to: '/app/farmers', icon: Search, ne: 'कृषक खोज्नुहोस्', en: 'Find a farmer' },
  { perm: 'smart_farming.view', to: '/app/smart-farming', icon: Cpu, ne: 'ग्रीनहाउस अनुगमन गर्नुहोस्', en: 'Monitor a greenhouse' },
  { perm: 'datacenter.view', to: '/app/data-center', icon: Database, ne: 'डाटा केन्द्र हेर्नुहोस्', en: 'Open the Data Center' },
  { perm: 'knowledge.view', to: '/app/knowledge?tab=training', icon: GraduationCap, ne: 'सिक्न थाल्नुहोस्', en: 'Start learning' },
  { perm: 'notices.view', to: '/app/notices', icon: Megaphone, ne: 'सूचना हेर्नुहोस्', en: 'Read notices' }
];

export default function DashboardHome() {
  const { lang, t } = useLang();
  const { user, can } = useAuth();
  const canSeeOverview = user?.permissions?.includes('datacenter.view');
  const [ov, setOv] = useState(null);
  useEffect(() => { if (canSeeOverview) api.get('/datacenter/overview').then((r) => setOv(r.data)).catch(() => {}); }, [canSeeOverview]);

  const h = new Date().getHours();
  const greet = h < 12 ? t('शुभ प्रभात', 'Good morning') : h < 17 ? t('शुभ दिन', 'Good afternoon') : t('शुभ साँझ', 'Good evening');
  const date = new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : 'ne-NP', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const actions = ACTIONS.filter((a) => can(a.perm)).slice(0, 4);
  const strip = ov ? [
    [t('सक्रिय कृषक', 'Active farmers'), nf(ov.farmers.active)],
    [t('दर्ता फार्म', 'Registered farms'), nf(ov.farms.count)],
    [`${t('उत्पादन', 'Production')} (${ov.fiscal_year})`, `${nf(ov.production.kg / 1000, 1)} t`],
    [t('अनलाइन यन्त्र', 'Devices online'), `${ov.devices.online} / ${ov.devices.total}`]
  ] : null;

  return (
    <div className="max-w-6xl space-y-10">
      <section className="contour bg-white rounded-xl p-6 md:p-8 shadow">
        <p className="text-sm text-gray-600">{date}</p>
        <h2 className="mt-1 text-3xl font-bold text-terrace-900">{greet}, {user.fullNameNe || user.fullNameEn}</h2>
        <p className="mt-1 text-gray-700">{user.roles.map((r) => roleLabel(r, lang)).join(', ')}</p>
        {strip && (
          <dl className="mt-6 grid grid-cols-2 md:grid-cols-4 border-t border-terrace-100">
            {strip.map(([k, v], i) => (
              <div key={k} className={`pt-4 pr-4 ${i > 0 ? 'md:pl-5 md:border-l md:border-terrace-100' : ''}`}>
                <dt className="text-sm text-gray-600">{k}</dt>
                <dd className="font-display text-3xl font-bold text-terrace-800">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {actions.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-terrace-900 mb-3">{t('सुरु गर्नुहोस्', 'Get started')}</h2>
          <div className="flex flex-wrap gap-3">
            {actions.map(({ to, icon: Icon, ne, en }, i) => (
              <Link key={to} to={to} className={`flex items-center gap-2 px-5 py-3 rounded-md font-semibold ${i === 0 ? 'bg-terrace-800 hover:bg-terrace-900 text-white' : 'bg-white border border-terrace-800 text-terrace-800 hover:bg-terrace-50'}`}>
                <Icon size={18} aria-hidden="true" /> {lang === 'en' ? en : ne}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-8">
        {groups.map((g) => {
          const items = modules.filter((m) => m.group === g.key && m.to !== '/app' && (!m.perm || can(m.perm)));
          if (!items.length) return null;
          return (
            <div key={g.key}>
              <h2 className="text-xl font-bold text-terrace-900 border-b-2 border-terrace-100 pb-2">{g.label[lang]}</h2>
              <ul className="grid md:grid-cols-2 gap-x-10">
                {items.map((m) => {
                  const Icon = ICONS[m.icon] || ICONS.LayoutDashboard;
                  return (
                    <li key={m.to} className="border-b border-terrace-100">
                      <Link to={m.to} className="group flex items-center gap-4 py-4">
                        <span className="w-11 h-11 shrink-0 rounded-full bg-terrace-50 text-terrace-800 grid place-items-center group-hover:bg-terrace-800 group-hover:text-white transition-colors"><Icon size={20} aria-hidden="true" /></span>
                        <span className="flex-1"><span className="block font-semibold text-terrace-900">{m.label[lang]}</span><span className="block text-sm text-gray-600">{m.desc[lang]}</span></span>
                        <ChevronRight size={18} className="text-gray-400 group-hover:text-gov-red" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}

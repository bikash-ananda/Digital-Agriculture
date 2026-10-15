import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Search, Cpu, FlaskConical, Database, GraduationCap, Megaphone, ChevronRight, Sprout, MapPin, LoaderCircle } from 'lucide-react';
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
  { perm: 'research.view', to: '/app/knowledge?tab=research', icon: FlaskConical, ne: 'अनुसन्धान केन्द्र खोल्नुहोस्', en: 'Open the Research Center' },
  { perm: 'datacenter.view', to: '/app/data-center', icon: Database, ne: 'डाटा केन्द्र हेर्नुहोस्', en: 'Open the Data Center' },
  { perm: 'knowledge.view', to: '/app/knowledge?tab=training', icon: GraduationCap, ne: 'सिक्न थाल्नुहोस्', en: 'Start learning' },
  { perm: 'notices.view', to: '/app/notices', icon: Megaphone, ne: 'सूचना हेर्नुहोस्', en: 'Read notices' }
];
const SAVED_SITE = 'da.selectedFarmId';

export default function DashboardHome() {
  const { lang, t } = useLang();
  const { user, can } = useAuth();
  const canSeeOverview = can('datacenter.view');
  const canSeeFarms = can('smart_farming.view');
  const [ov, setOv] = useState(null);
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [siteLoading, setSiteLoading] = useState(canSeeFarms);
  const [siteError, setSiteError] = useState('');

  useEffect(() => {
    if (!canSeeOverview) return undefined;
    let active = true;
    api.get('/datacenter/overview').then((r) => { if (active) setOv(r.data); }).catch(() => {});
    return () => { active = false; };
  }, [canSeeOverview]);

  useEffect(() => {
    if (!canSeeFarms) return undefined;
    let active = true;
    api.get('/smart/sites').then((r) => {
      if (!active) return;
      const list = Array.isArray(r.data) ? r.data : [];
      setSites(list);
      let saved = '';
      try { saved = window.localStorage.getItem(SAVED_SITE) || ''; } catch { /* Storage can be disabled by the browser. */ }
      setSelectedSiteId(list.some((site) => String(site.id) === saved) ? saved : String(list[0]?.id || ''));
      setSiteError('');
    }).catch((e) => {
      if (active) setSiteError(e.response?.data?.message || t('फार्मको सूची लोड भएन।', 'Could not load farms.'));
    }).finally(() => { if (active) setSiteLoading(false); });
    return () => { active = false; };
  }, [canSeeFarms, t]);

  const selectSite = (id) => {
    setSelectedSiteId(id);
    try { window.localStorage.setItem(SAVED_SITE, id); } catch { /* Keep the selection for this visit. */ }
  };
  const selectedSite = sites.find((site) => String(site.id) === selectedSiteId);
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
    <div className="max-w-6xl space-y-8">
      <section className="contour overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-terrace-900/5 md:p-8">
        <p className="text-sm text-gray-600">{date}</p>
        <h2 className="mt-1 text-2xl font-bold text-terrace-900 md:text-3xl">{greet}, {user.fullNameNe || user.fullNameEn}</h2>
        <p className="mt-1 text-sm text-gray-700">{user.roles.map((r) => roleLabel(r, lang)).join(', ')}</p>

        {canSeeFarms && <div className="mt-5 flex flex-col gap-3 rounded-xl border border-terrace-100 bg-terrace-50/60 p-4 sm:flex-row sm:items-center">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-agri-green shadow-sm"><Sprout size={22} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <label htmlFor="farm-select" className="block text-xs font-semibold uppercase tracking-wide text-gray-600">{t('छानिएको फार्म', 'Selected farm')}</label>
            {siteLoading ? <p role="status" className="mt-1 inline-flex items-center gap-2 text-sm text-gray-600"><LoaderCircle size={15} className="animate-spin" />{t('फार्म लोड हुँदैछ…', 'Loading farms…')}</p> : siteError ? <p role="alert" className="mt-1 text-sm text-red-700">{siteError}</p> : sites.length === 0 ? <p className="mt-1 text-sm text-gray-600">{t('अहिलेसम्म फार्म दर्ता गरिएको छैन।', 'No farms are registered yet.')}</p> : <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
              <select id="farm-select" value={selectedSiteId} onChange={(e) => selectSite(e.target.value)} className="min-h-11 min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-terrace-900 focus:border-gov-blue focus:outline-none focus:ring-2 focus:ring-gov-blue/20 sm:max-w-sm">
                {sites.map((site) => <option key={site.id} value={site.id}>{lang === 'en' ? site.name_en : (site.name_ne || site.name_en)}</option>)}
              </select>
              {selectedSite && <span className="inline-flex items-center gap-1 text-xs text-gray-600"><MapPin size={13} aria-hidden="true" />{selectedSite.address || selectedSite.code} · {selectedSite.unit_count} {t('इकाई', 'units')}</span>}
            </div>}
          </div>
          {selectedSite && <Link to={`/app/smart-farming/sites/${selectedSite.id}`} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-terrace-800 px-4 text-sm font-semibold text-white hover:bg-terrace-900">{t('फार्म खोल्नुहोस्', 'Open farm')}<ChevronRight size={16} aria-hidden="true" /></Link>}
        </div>}

        {strip && <dl className="mt-5 grid grid-cols-2 gap-y-4 border-t border-terrace-100 pt-4 md:grid-cols-4 md:gap-y-0">
          {strip.map(([k, v], i) => <div key={k} className={`pr-3 ${i > 0 ? 'md:border-l md:border-terrace-100 md:pl-5' : ''}`}>
            <dt className="text-xs text-gray-600 sm:text-sm">{k}</dt><dd className="mt-1 font-display text-2xl font-bold text-terrace-800 sm:text-3xl">{v}</dd>
          </div>)}
        </dl>}
      </section>

      {actions.length > 0 && <section>
        <h2 className="mb-3 text-lg font-bold text-terrace-900">{t('सुरु गर्नुहोस्', 'Quick actions')}</h2>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          {actions.map(({ to, icon: Icon, ne, en }, i) => <Link key={to} to={to} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition sm:justify-start ${i === 0 ? 'bg-terrace-800 text-white hover:bg-terrace-900' : 'border border-terrace-200 bg-white text-terrace-800 hover:bg-terrace-50'}`}>
            <Icon size={18} aria-hidden="true" /> {lang === 'en' ? en : ne}
          </Link>)}
        </div>
      </section>}

      <details className="rounded-2xl border border-terrace-100 bg-white shadow-sm">
        <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 font-semibold text-terrace-900">{t('सबै उपकरण तथा पृष्ठहरू', 'Browse all tools and pages')}<span className="text-xs font-normal text-gray-500">{t('आवश्यक पर्दा मात्र खोल्नुहोस्', 'Expand when you need a tool')}</span></summary>
        <section className="space-y-7 border-t border-terrace-100 p-4 md:p-6">
        {groups.map((g) => {
          const items = modules.filter((m) => m.group === g.key && m.to !== '/app' && (!m.perm || can(m.perm)));
          if (!items.length) return null;
          return <div key={g.key}>
            <h2 className="border-b-2 border-terrace-100 pb-2 text-lg font-bold text-terrace-900">{g.label[lang]}</h2>
            <ul className="grid gap-x-10 md:grid-cols-2">
              {items.map((m) => {
                const Icon = ICONS[m.icon] || ICONS.LayoutDashboard;
                return <li key={m.to} className="border-b border-terrace-100">
                  <Link to={m.to} className="group flex min-h-[76px] items-center gap-4 py-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-terrace-50 text-terrace-800 transition-colors group-hover:bg-terrace-800 group-hover:text-white"><Icon size={20} aria-hidden="true" /></span>
                    <span className="flex-1"><span className="block font-semibold text-terrace-900">{m.label[lang]}</span><span className="block text-sm text-gray-600">{m.desc[lang]}</span></span>
                    <ChevronRight size={18} className="text-gray-400 group-hover:text-gov-red" aria-hidden="true" />
                  </Link>
                </li>;
              })}
            </ul>
          </div>;
        })}
        </section>
      </details>
    </div>
  );
}

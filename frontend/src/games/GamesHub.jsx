import { Award, BookOpen, CloudSun, Droplets, Gamepad2, Leaf, Sprout, Wheat } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useLang from '../utils/useLang';
import { readMyFarmProgress } from './progressStore';

const upcomingGames = [
  { icon: Droplets, ne: 'स्मार्ट सिँचाइ', en: 'Smart Irrigation', bodyNe: 'मौसम र माटो हेरेर पानी दिने सही समय छान्नुहोस्।', bodyEn: 'Choose when to irrigate using weather and soil clues.' },
  { icon: Leaf, ne: 'बाली स्वास्थ्य', en: 'Crop Health', bodyNe: 'लक्षण चिन्नुहोस् र सुरक्षित अर्को कदम छान्नुहोस्।', bodyEn: 'Spot crop symptoms and choose a safe next step.' },
  { icon: Wheat, ne: 'बालीदेखि बजारसम्म', en: 'Farm to Market', bodyNe: 'उत्पादन, भण्डारण र बजारका निर्णय अभ्यास गर्नुहोस्।', bodyEn: 'Practice production, storage and market decisions.' },
  { icon: CloudSun, ne: 'कृषि-मौसम चुनौती', en: 'Agro-weather Challenge', bodyNe: 'स्थानीय मौसमअनुसार खेतको काम योजना गर्नुहोस्।', bodyEn: 'Plan field tasks around local weather.' }
];

export default function GamesHub({ onPlay }) {
  const { t } = useLang();
  const { user } = useAuth();
  const farm = readMyFarmProgress(user);
  const level = Math.floor(farm.xp / 100) + 1;
  const stage = farm.harvested ? t('भित्र्याइएको', 'Harvested') : farm.planted ? t('बाली हुर्कँदै', 'Crop growing') : t('सुरु गर्न तयार', 'Ready to start');
  const progressCopy = t(
    'तपाईंको प्रगति यो ब्राउजरमा सुरक्षित हुन्छ; खेल्न लगइन आवश्यक छैन।',
    'Progress is saved in this browser. No sign-in is needed to play.'
  );

  return (
    <div className="space-y-6">
      <header className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-teal-900 to-lime-800 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 -z-10 h-72 w-72 rounded-full border-[42px] border-white/5" />
        <div className="grid gap-7 lg:grid-cols-[1.4fr_.6fr] lg:items-end">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[.16em] text-lime-100"><Gamepad2 size={15}/>{t('खेलेर सिक्नुहोस्', 'Learn by playing')}</p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{t('कृषि खेल केन्द्र', 'Game Hub')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-emerald-50 sm:text-base">{t('फार्मका निर्णय गरेर बाली हुर्काउनुहोस्। प्रत्येक चरणमा अभ्यासको नतिजा र त्यसको कारण देख्नुहोस्।', 'Grow a crop by making farm decisions. See what each choice changes and why.')}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3"><strong className="block text-xl">{level}</strong><span className="text-[11px] text-emerald-100">{t('स्तर', 'Level')}</span></div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3"><strong className="block text-xl">{farm.xp}</strong><span className="text-[11px] text-emerald-100">XP</span></div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3"><strong className="block text-xl">{farm.badges.length}</strong><span className="text-[11px] text-emerald-100">{t('ब्याज', 'Badges')}</span></div>
          </div>
        </div>
      </header>

      <section aria-labelledby="featured-game-title" className="grid overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm lg:grid-cols-[1.1fr_.9fr]">
        <div className="relative flex min-h-64 items-center justify-center overflow-hidden bg-gradient-to-b from-sky-100 via-emerald-50 to-amber-100 p-7">
          <div className="absolute right-8 top-8 grid h-14 w-14 place-items-center rounded-full bg-amber-300/80 text-amber-900"><CloudSun size={30}/></div>
          <div className="absolute inset-x-0 bottom-0 h-20 border-t border-amber-900/10 bg-gradient-to-b from-amber-700 to-amber-900" />
          <div className="relative z-10 mb-7 grid h-32 w-32 place-items-center rounded-full border border-white/70 bg-white/55 text-emerald-800 shadow-lg backdrop-blur-sm"><Sprout size={76} strokeWidth={1.5}/></div>
          <div className="absolute bottom-4 left-5 right-5 flex justify-between text-xs font-semibold text-white/90"><span>{t('आफ्नो खेत', 'Your field')}</span><span>{stage}</span></div>
        </div>
        <div className="flex flex-col justify-center p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">{t('खेल्न तयार', 'Playable now')}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{t('१०–१५ मिनेट', '10–15 min')}</span></div>
          <h3 id="featured-game-title" className="mt-4 font-display text-2xl font-bold text-slate-950">{t('मेरो फार्म', 'My Farm')}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('माटो तयार गर्नुहोस्, टमाटर रोप्नुहोस् र सिँचाइ, झारपात तथा मौसमको निर्णय गरेर बाली भित्र्याउनुहोस्।', 'Prepare a bed, plant tomatoes, and manage water, weeds and weather through harvest.')} {progressCopy}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button onClick={onPlay} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2"><Sprout size={18}/>{farm.prepared ? t('फार्ममा फर्कनुहोस्', 'Continue My Farm') : t('फार्म सुरु गर्नुहोस्', 'Start My Farm')}</button>
            {farm.day > 1 && <span className="text-sm text-slate-600">{t('दिन', 'Day')} {farm.day - 1} · {farm.growthDays}/12 {t('वृद्धि दिन', 'growth days')}</span>}
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="upcoming-games-title">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('अर्को चरणमा', 'On the roadmap')}</p><h3 id="upcoming-games-title" className="mt-1 text-xl font-bold text-slate-950">{t('थप सिकाइ खेलहरू', 'More learning games')}</h3></div><span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500"><BookOpen size={14}/>{t('नयाँ खेलहरू चरणबद्ध रूपमा खुल्नेछन्', 'New games will be released over time')}</span></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {upcomingGames.map(({ icon: Icon, ne, en, bodyNe, bodyEn }) => <article key={en} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-emerald-800 shadow-sm"><Icon size={20}/></span><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('छिट्टै आउँदैछ', 'Coming soon')}</span></div><h4 className="mt-4 font-bold text-slate-900">{t(ne, en)}</h4><p className="mt-1 text-sm leading-relaxed text-slate-600">{t(bodyNe, bodyEn)}</p></article>)}
        </div>
      </section>

      <aside className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-relaxed text-sky-950"><Award className="mt-0.5 shrink-0 text-sky-800" size={19}/><p>{t('XP र सिक्का खेलभित्रका सिकाइ पुरस्कार मात्र हुन्। मौसम र बालीको व्यवहार सरल सिमुलेसन हो; वास्तविक खेतको अवस्थाका लागि स्थानीय प्राविधिक सल्लाह लिनुहोस्।', 'XP and coins are learning rewards inside the game only. Weather and crop behavior are simplified simulations; use local technical advice for real field decisions.')}</p></aside>
    </div>
  );
}

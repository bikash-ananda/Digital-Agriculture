import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Award, BookOpen, Check, CircleHelp, Cloud, CloudRain, Coins, Droplets, Leaf, Map, Package, RotateCcw, ShoppingBasket, Sprout, Sun, Volume2, VolumeX, Wheat } from 'lucide-react';
import useLang from '../utils/useLang';
import { useAuth } from '../context/AuthContext';
import { BADGES, CROPS, FIELDS, SKILLS, TUTORIAL_STEPS } from './farmContent';
import { advanceFarmDay, buySeedBag, completeFarmTutorial, FARM_ECONOMY, getCropCondition, getCropStage, performFarmAction, setFarmField, settleHarvest, startNewFarmSeason, WEATHER, weatherForDay } from './myFarmEngine';
import { gameStorageKey, readMyFarmProgress, saveMyFarmProgress } from './progressStore';

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const actionButton = 'flex min-h-[88px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-700';
const primaryButton = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-700';

const CONDITION_COPY = {
  harvested: ['भित्र्याइएको', 'Harvested'],
  'ready-to-plant': ['रोप्न तयार', 'Ready to plant'],
  'field-empty': ['खाली बारी', 'Empty field'],
  ready: ['पाकेको', 'Ready to harvest'],
  thirsty: ['सुक्खा — पानी जाँच्नुहोस्', 'Dry — check water'],
  waterlogged: ['धेरै भिजेको — निकास दिनुहोस्', 'Too wet — let it drain'],
  weedy: ['झारपात धेरै', 'Weed pressure high'],
  recovering: ['थप हेरचाह चाहिन्छ', 'Needs extra care'],
  'growing-well': ['बढ्दैछ', 'Growing well']
};

const STAGE_COPY = {
  unprepared: ['खाली खेत', 'Empty field'],
  prepared: ['रोप्न तयार', 'Ready to plant'],
  harvested: ['भित्र्याइएको', 'Harvested']
};

function Meter({ label, value, icon: Icon, tone, helper }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-700">{label}</span><Icon className={tone} size={17} aria-hidden="true"/></div>
      <div className="mt-2 flex items-end justify-between gap-2"><strong className="text-xl text-slate-950">{value}%</strong><span className="text-right text-[11px] font-medium text-slate-600">{helper}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="meter" aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={value}>
        <div className={`h-full rounded-full transition-all motion-reduce:transition-none ${tone.includes('blue') ? 'bg-sky-600' : tone.includes('amber') ? 'bg-amber-600' : 'bg-emerald-700'}`} style={{ width: `${value}%` }}/>
      </div>
    </article>
  );
}

function CropIllustration({ farm, stage, t }) {
  const height = Math.min(108, 34 + farm.growthDays * 6);
  const leafCount = farm.growthDays < 2 ? 1 : farm.growthDays < 5 ? 2 : farm.growthDays < 8 ? 4 : 6;
  const fruitCount = farm.growthDays < 8 ? 0 : farm.growthDays < 10 ? 1 : farm.growthDays < 12 ? 3 : 5;
  const leafSpots = [[38, 60, -1], [62, 52, 1], [35, 43, -1], [65, 38, 1], [40, 28, -1], [61, 22, 1]];

  if (!farm.planted) {
    return <div className="mb-2 grid h-20 w-20 place-items-center rounded-full border border-white/70 bg-white/60 text-emerald-900 shadow-sm"><Sprout size={34} aria-hidden="true"/><span className="sr-only">{t('रोप्न तयार बारी', 'Field ready for planting')}</span></div>;
  }

  return (
    <svg aria-label={t(`गोलभेंडा बाली: ${stage}`, `Tomato crop: ${stage}`)} role="img" width="126" height={height} viewBox="0 0 100 120" className={`overflow-visible text-emerald-800 transition-all duration-500 motion-reduce:transition-none ${stage === 'seedling' ? 'motion-safe:animate-pulse' : ''}`}>
      <path d="M50 112 C46 88 55 65 49 12" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/>
      {leafSpots.slice(0, leafCount).map(([x, y, direction], index) => <path key={index} d={direction < 0 ? `M49 ${y + 11} C${x - 18} ${y + 6} ${x - 19} ${y - 10} ${x - 4} ${y - 6} C${x + 5} ${y - 3} 53 ${y + 5} 49 ${y + 11}Z` : `M51 ${y + 11} C${x + 18} ${y + 6} ${x + 19} ${y - 10} ${x + 4} ${y - 6} C${x - 5} ${y - 3} 47 ${y + 5} 51 ${y + 11}Z`} fill={index % 2 ? '#15803d' : '#22a35a'} />)}
      {fruitCount > 0 && [[42, 69], [59, 60], [45, 47], [58, 39], [49, 81]].slice(0, fruitCount).map(([x, y], index) => <g key={index}><circle cx={x} cy={y} r="6.5" fill="#dc3c36" stroke="#9f2824" strokeWidth="1.5"/><path d={`M${x} ${y - 7} l-3 -4 m3 4 l4 -3`} stroke="#166534" strokeWidth="2" strokeLinecap="round"/></g>)}
      <path d="M50 112 C35 114 23 115 15 114 M50 112 C65 114 77 115 85 114" fill="none" stroke="#f2d3a3" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}

function guideFor(farm) {
  const condition = getCropCondition(farm);
  if (condition === 'field-empty') return { ne: 'पहिलो कदम: घाम लाग्ने पाखोबारी छान्नुहोस् र माटो तयार गर्नुहोस्।', en: 'First, choose a field and prepare the soil.' };
  if (condition === 'ready-to-plant') return { ne: 'अब मौज्दातबाट गोलभेंडाको बिउ रोप्नुहोस्।', en: 'Plant a tomato seed from your inventory now.' };
  if (condition === 'harvested') return { ne: 'सिजन पूरा भयो। आफ्नो बाली बेच्ने वा घरमा राख्ने निर्णय गर्नुहोस्।', en: 'The season is complete. Decide whether to sell or keep the harvest.' };
  if (condition === 'ready') return { ne: 'बाली पाकेको байна। अब भित्र्याउन सक्नुहुन्छ।', en: 'The crop is ripe. You can harvest it now.' };
  if (condition === 'thirsty') return { ne: 'माटो सुक्खा छ। पानी दिनुअघि चिस्यान जाँच्नुहोस्।', en: 'The soil is dry. Check moisture and water if needed.' };
  if (condition === 'waterlogged') return { ne: 'माटो धेरै भिजेको छ। अहिले थप पानी नदिनुहोस्।', en: 'The soil is too wet. Hold off on more water.' };
  if (condition === 'weedy') return { ne: 'झारपात धेरै छ। खेत सफा गर्दा बालीलाई मद्दत मिल्छ।', en: 'Weed pressure is high. Clearing the bed will help the crop.' };
  if (condition === 'recovering') return { ne: 'बालीलाई थप हेरचाह चाहिन्छ। चिस्यान र झारपात जाँच्नुहोस्।', en: 'The crop needs extra care. Check moisture and weeds.' };
  return { ne: `${WEATHER[farm.weather]?.ne || 'मौसम'} छ। अवस्था हेरेर तयार हुँदा अर्को दिन जानुहोस्।`, en: `It is ${WEATHER[farm.weather]?.en?.toLowerCase() || 'today'}. Check the field and advance when ready.` };
}

export default function MyFarmGame({ onBack }) {
  const { t } = useLang();
  const { user, loading: authLoading } = useAuth();
  const [farm, setFarm] = useState(() => readMyFarmProgress(user));
  const [saveStatus, setSaveStatus] = useState('saved');
  const [voices, setVoices] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : []);
  const [speechLanguage, setSpeechLanguage] = useState('ne');
  const [muted, setMuted] = useState(false);
  const [speechStatus, setSpeechStatus] = useState('');
  const [tutorialOpen, setTutorialOpen] = useState(() => !readMyFarmProgress(user).tutorialCompleted);
  const [tutorialStep, setTutorialStep] = useState(0);
  const loadedStorageKey = useRef(gameStorageKey(user));

  const updateFarm = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(farm) : updater;
    if (!next || next === farm) return;
    setFarm(next);
    setSaveStatus(saveMyFarmProgress(user, next) ? 'saved' : 'session');
  }, [farm, user]);

  const finishTutorial = useCallback(() => {
    setTutorialOpen(false);
    updateFarm((current) => completeFarmTutorial(current));
  }, [updateFarm]);

  useEffect(() => {
    if (authLoading) return;
    const nextStorageKey = gameStorageKey(user);
    if (loadedStorageKey.current === nextStorageKey) return;
    const nextFarm = readMyFarmProgress(user);
    loadedStorageKey.current = nextStorageKey;
    setFarm(nextFarm);
    setSaveStatus('saved');
    setTutorialOpen(!nextFarm.tutorialCompleted);
    setTutorialStep(0);
  }, [authLoading, user]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined;
    const updateVoices = () => setVoices(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener?.('voiceschanged', updateVoices);
    return () => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.removeEventListener?.('voiceschanged', updateVoices);
    };
  }, []);

  useEffect(() => {
    if (!tutorialOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') finishTutorial();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [tutorialOpen, finishTutorial]);

  const act = (action) => updateFarm((current) => performFarmAction(current, action));
  const guide = guideFor(farm);
  const crop = CROPS[farm.cropId] || CROPS.tomato;
  const stage = getCropStage(farm);
  const stageText = STAGE_COPY[stage] || [crop.stages.find((item) => item.key === stage)?.ne || crop.name.ne, crop.stages.find((item) => item.key === stage)?.en || crop.name.en];
  const condition = getCropCondition(farm);
  const conditionText = CONDITION_COPY[condition] || CONDITION_COPY['growing-well'];
  const field = FIELDS.find((item) => item.id === farm.fieldId) || FIELDS[0];
  const forecast = weatherForDay(farm.day + 1, farm.season);
  const CurrentWeatherIcon = farm.weather === 'rain' ? CloudRain : farm.weather === 'cloudy' ? Cloud : Sun;
  const ForecastIcon = forecast === 'rain' ? CloudRain : forecast === 'cloudy' ? Cloud : Sun;
  const nepaliVoice = voices.find((voice) => voice.lang?.toLowerCase().startsWith('ne'));
  const englishVoice = voices.find((voice) => voice.lang?.toLowerCase().startsWith('en-in')) || voices.find((voice) => voice.lang?.toLowerCase().startsWith('en'));
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const canWater = farm.planted && !farm.harvested && farm.moisture < 62 && !farm.actionsToday.includes('water');
  const canWeed = farm.planted && !farm.harvested && farm.weeds > 5 && !farm.actionsToday.includes('weed');
  const canMulch = farm.planted && !farm.harvested && !farm.mulched;
  const xpInLevel = farm.xp % 100;
  const level = Math.floor(farm.xp / 100) + 1;
  const seasonSettled = farm.harvested && farm.produceInventory === 0;
  const showFieldMap = !farm.prepared && !farm.harvested;

  const missions = [
    { title: t('बारी छान्नुहोस्', 'Choose a field'), done: Boolean(field) },
    { title: t('माटो तयार गर्नुहोस्', 'Prepare soil'), done: farm.prepared },
    { title: t('बिउ रोप्नुहोस्', 'Plant a seed'), done: farm.planted },
    { title: t('बाली हुर्काउनुहोस्', 'Grow the crop'), done: farm.growthDays >= crop.daysToMaturity },
    { title: t('बाली भित्र्याउनुहोस्', 'Harvest'), done: farm.harvested },
    { title: t('बिक्री वा घरको प्रयोग', 'Sell or keep the harvest'), done: seasonSettled }
  ];
  const completedMissions = missions.filter((mission) => mission.done).length;
  const nextMission = missions.find((mission) => !mission.done);
  const nextWeatherName = t(WEATHER[forecast]?.ne || '', WEATHER[forecast]?.en || '');

  const speakText = (content) => {
    if (!speechSupported) {
      setSpeechStatus(t('यो ब्राउजरमा आवाज उपलब्ध छैन। निर्देशन तल पढ्न सक्नुहुन्छ।', 'Audio is unavailable in this browser. You can read the guidance below.'));
      return;
    }
    if (muted) {
      setSpeechStatus(t('आवाज म्युट छ। सुन्न म्युट हटाउनुहोस्।', 'Audio is muted. Unmute to listen.'));
      return;
    }
    window.speechSynthesis.cancel();
    const useNepali = speechLanguage === 'ne' && Boolean(nepaliVoice);
    const voice = useNepali ? nepaliVoice : englishVoice;
    const utterance = new SpeechSynthesisUtterance(useNepali ? content.ne : content.en);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || (useNepali ? 'ne-NP' : 'en-US');
    utterance.rate = 0.9;
    utterance.onend = () => setSpeechStatus(t('निर्देशन पूरा भयो।', 'Guidance finished.'));
    utterance.onerror = () => setSpeechStatus(t('आवाज बज्न सकेन। निर्देशन पढ्न सक्नुहुन्छ।', 'Audio could not play. You can read the guidance instead.'));
    window.speechSynthesis.speak(utterance);
    setSpeechStatus(useNepali ? t('नेपाली निर्देशन बज्दैछ।', 'Playing Nepali guidance.') : speechLanguage === 'ne' ? t('नेपाली आवाज उपलब्ध नभएकाले अंग्रेजी निर्देशन बज्दैछ।', 'No Nepali voice is available; playing English guidance.') : t('अंग्रेजी निर्देशन बज्दैछ।', 'Playing English guidance.'));
  };

  const toggleMute = () => {
    if (!muted && speechSupported) window.speechSynthesis.cancel();
    setMuted((current) => !current);
    setSpeechStatus(muted ? t('आवाज खोलियो।', 'Audio unmuted.') : t('आवाज म्युट गरियो।', 'Audio muted.'));
  };

  const levelName = (points) => Math.floor(points / 5) + 1;
  const skillProgress = (points) => (points % 5) * 20;

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-700"><ArrowLeft size={18}/>{t('सबै खेल', 'All games')}</button>
        <button type="button" onClick={() => { setTutorialStep(0); setTutorialOpen(true); }} className={secondaryButton}><CircleHelp size={17}/>{t('खेल्ने तरिका', 'How to play')}</button>
      </div>

      <header className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-lime-800 p-5 text-white shadow-lg sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-14 -z-10 h-64 w-64 rounded-full border-[36px] border-white/5"/>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl"><p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-lime-100"><Wheat size={14}/>{t('कास्कीको पहाडी फार्म · सिजन', 'Kaski hillside farm · Season')} {farm.season}</p><h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{t('मेरो फार्म', 'My Farm')}</h2><p className="mt-2 text-sm leading-relaxed text-emerald-50">{t('माटो, मौसम र बालीका संकेत हेरेर निर्णय गर्नुहोस्। कुनै समय सीमा छैन; तपाईं तयार हुँदा मात्र दिन अघि बढ्छ।', 'Use soil, weather and crop clues to make decisions. There is no timer; the day advances only when you choose.')}</p></div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="min-w-20 rounded-xl border border-white/10 bg-white/10 p-3"><strong className="block text-xl">{farm.day}</strong><span className="text-[11px] text-emerald-100">{t('दिन', 'Day')}</span></div>
            <div className="min-w-20 rounded-xl border border-white/10 bg-white/10 p-3"><strong className="block text-xl">{level}</strong><span className="text-[11px] text-emerald-100">{t('स्तर', 'Level')}</span></div>
            <div className="min-w-20 rounded-xl border border-white/10 bg-white/10 p-3"><strong className="flex items-center justify-center gap-1 text-xl"><Coins size={17}/>{farm.coins}</strong><span className="text-[11px] text-emerald-100">{t('खेल सिक्का', 'Game coins')}</span></div>
          </div>
        </div>
        <div className="mt-5 max-w-xl"><div className="flex justify-between text-xs font-semibold text-emerald-50"><span>{farm.xp} XP</span><span>{100 - xpInLevel} {t('XP मा अर्को स्तर', 'XP to next level')}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/20" role="meter" aria-label={t('अर्को स्तरको प्रगति', 'Progress to next level')} aria-valuemin="0" aria-valuemax="100" aria-valuenow={xpInLevel}><div className="h-full rounded-full bg-lime-300 transition-all motion-reduce:transition-none" style={{ width: `${xpInLevel}%` }}/></div></div>
      </header>

      <section className={card} aria-labelledby="season-journey-title">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('यो सिजनको यात्रा', 'This season')}</p><h3 id="season-journey-title" className="mt-1 text-lg font-bold text-slate-950">{nextMission ? nextMission.title : t('सिजन पूरा भयो', 'Season complete')}</h3></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-950">{completedMissions}/{missions.length} {t('काम पूरा', 'steps complete')}</span></div>
        <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {missions.map((mission, index) => <li key={mission.title} className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${mission.done ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : index === completedMissions ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white">{mission.done ? <Check size={14} aria-hidden="true"/> : index + 1}</span>{mission.title}</li>)}
        </ol>
      </section>

      {showFieldMap && <section className={card} aria-labelledby="farm-map-title">
        <div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-900"><Map size={22}/></span><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('फार्म नक्सा', 'Farm map')}</p><h3 id="farm-map-title" className="mt-1 text-xl font-bold text-slate-950">{t('यो सिजनको बारी छान्नुहोस्', 'Choose this season’s field')}</h3><p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">{t('बारीको फरक अवस्था खेलको सिमुलेसन हो। पहिलो बाली भित्र्याएपछि दोस्रो बारी खुल्छ।', 'Field differences are part of the game simulation. Harvest once to unlock the second plot.')}</p></div></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {FIELDS.map((plot) => {
            const Icon = plot.icon === 'sun' ? Sun : Cloud;
            const unlocked = farm.unlockedFields.includes(plot.id) || farm.totalHarvests >= plot.unlockedAfterHarvests;
            const selected = farm.fieldId === plot.id;
            return <button key={plot.id} type="button" disabled={!unlocked} onClick={() => updateFarm((current) => setFarmField(current, plot.id))} aria-pressed={selected} className={`rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 ${selected ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600' : 'border-slate-200 bg-white hover:border-emerald-300'}`}>
              <div className="flex items-start justify-between gap-3"><span className={`grid h-11 w-11 place-items-center rounded-xl ${selected ? 'bg-emerald-900 text-white' : 'bg-slate-100 text-slate-800'}`}><Icon size={21}/></span><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${!unlocked ? 'bg-slate-100 text-slate-600' : selected ? 'bg-emerald-900 text-white' : 'bg-white text-emerald-900'}`}>{!unlocked ? t('पहिलो बालीपछि खुल्नेछ', 'Unlocks after first harvest') : selected ? t('छानिएको', 'Selected') : t('छान्नुहोस्', 'Select')}</span></div>
              <h4 className="mt-3 font-bold text-slate-950">{t(plot.name.ne, plot.name.en)}</h4><p className="mt-1 text-sm leading-relaxed text-slate-600">{t(plot.description.ne, plot.description.en)}</p>
            </button>;
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-amber-900"><Sprout size={18}/></span><p><strong>{t('बिउको झोला', 'Seed bag')}:</strong> {t(crop.seedName.ne, crop.seedName.en)} · {farm.seedInventory} {t('बाँकी', 'in inventory')} · {t('यस सिजनमा एउटै बाली उपलब्ध छ।', 'One crop is currently playable.')}</p></div>
      </section>}

      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <section className={`${card} overflow-hidden p-0`} aria-labelledby="farm-field-title">
          <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-4"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t(field.name.ne, field.name.en)} · {crop.name.ne}</p><h3 id="farm-field-title" className="mt-1 text-xl font-bold text-slate-950">{t(stageText[0], stageText[1])}</h3></div><span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-950"><CurrentWeatherIcon size={15} aria-hidden="true"/>{t('आजको मौसम', 'Today')}: {t(WEATHER[farm.weather]?.ne || '', WEATHER[farm.weather]?.en || '')}</span></div>
          <div className="relative flex min-h-72 items-end justify-center overflow-hidden bg-gradient-to-b from-sky-100 via-emerald-50 to-amber-100 px-4 pb-12 pt-8">
            <div className="absolute right-8 top-6 grid h-12 w-12 place-items-center rounded-full bg-amber-300/80 text-amber-950"><CurrentWeatherIcon size={24} aria-hidden="true"/></div>
            <div className="absolute inset-x-0 bottom-0 h-16 border-t border-amber-950/10 bg-gradient-to-b from-amber-700 to-amber-900"/>
            <div className="absolute inset-x-8 bottom-[3.7rem] h-1 rounded-full bg-amber-950/20"/>
            <div className="relative z-10 mb-5 flex items-end justify-center transition-all duration-500 motion-reduce:transition-none" style={{ minHeight: `${Math.min(156, 72 + farm.growthDays * 6)}px` }}>
              <CropIllustration farm={farm} stage={stageText[1]} t={t}/>
              {!farm.planted && <span className="absolute -bottom-1 whitespace-nowrap rounded-full bg-amber-950/70 px-3 py-1 text-[11px] font-semibold text-white">{farm.prepared ? t('रोप्ने प्रतीक्षामा', 'Ready to plant') : t('माटो तयार गर्नुहोस्', 'Prepare the soil')}</span>}
            </div>
            <span className="absolute bottom-3 left-5 text-xs font-semibold text-white">{t('खेतको सतह', 'Field bed')} · {t(field.name.ne, field.name.en)}</span><span className="absolute bottom-3 right-5 text-xs font-semibold text-white">{t('वृद्धि दिन', 'Growth days')}: {farm.growthDays}/{crop.daysToMaturity}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5"><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${condition === 'thirsty' || condition === 'waterlogged' || condition === 'weedy' || condition === 'recovering' ? 'bg-amber-100 text-amber-950' : 'bg-emerald-100 text-emerald-950'}`}>{t('बालीको अवस्था', 'Crop condition')}: {t(conditionText[0], conditionText[1])}</span><span className="text-xs font-semibold text-slate-600">{t('बालीको स्वास्थ्य', 'Crop health')}: {farm.health}%</span></div>
          <div className="grid grid-cols-3 gap-2 p-4 sm:gap-3 sm:p-5"><Meter label={t('माटोको चिस्यान', 'Soil moisture')} value={farm.moisture} icon={Droplets} tone="text-sky-800" helper={farm.moisture < 32 ? t('सुक्खा', 'Dry') : farm.moisture > 76 ? t('धेरै भिजेको', 'Too wet') : t('खेलको लक्ष्य दायरा', 'Game target range')}/><Meter label={t('बालीको स्वास्थ्य', 'Crop health')} value={farm.health} icon={Leaf} tone="text-emerald-800" helper={farm.health < 35 ? t('थप हेरचाह', 'Needs care') : t('स्थिर', 'Stable')}/><Meter label={t('झारपात', 'Weed pressure')} value={farm.weeds} icon={Sprout} tone="text-amber-800" helper={farm.weeds >= 70 ? t('धेरै', 'High') : farm.weeds >= 40 ? t('हेर्नुहोस्', 'Watch') : t('कम', 'Low')}/></div>
        </section>

        <section className="space-y-4" aria-label={t('खेतका निर्णय', 'Field decisions')}>
          <article className={card}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('किसान साथीको निर्देशन', 'Farmer guide')}</p><h3 className="mt-1 text-lg font-bold text-slate-950">{t('आजको काम', 'Today’s plan')}</h3></div><button type="button" onClick={toggleMute} aria-pressed={muted} className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-slate-300 text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-700" aria-label={muted ? t('आवाज खोल्नुहोस्', 'Unmute audio') : t('आवाज म्युट गर्नुहोस्', 'Mute audio')} title={muted ? t('आवाज खोल्नुहोस्', 'Unmute audio') : t('आवाज म्युट गर्नुहोस्', 'Mute audio')}>{muted ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button></div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{farm.planted ? t('अवस्था हेरेर आवश्यक काम छान्नुहोस्। मौसमको असर दिन अघि बढाउँदा लागू हुन्छ।', 'Choose a task from the field conditions. Weather effects apply when you advance the day.') : t('पहिले बारी छान्नुहोस्, माटो तयार गर्नुहोस् र बिउ रोप्नुहोस्।', 'Choose a field, prepare the soil and plant a seed to begin.')}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {!farm.prepared && <button type="button" className={actionButton} onClick={() => act('prepare')}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-900"><Wheat size={19}/></span><span><strong className="block text-sm text-slate-950">{t('माटो तयार', 'Prepare soil')}</strong><span className="mt-0.5 block text-xs text-slate-600">{t('बेड मिलाउनुहोस्', 'Make an even bed')}</span></span></button>}
              {farm.prepared && !farm.planted && farm.seedInventory > 0 && <button type="button" className={actionButton} onClick={() => act('plant')}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-900"><Sprout size={19}/></span><span><strong className="block text-sm text-slate-950">{t('बिउ रोप्नुहोस्', 'Plant seed')}</strong><span className="mt-0.5 block text-xs text-slate-600">{crop.name.ne} · {farm.seedInventory} {t('बिउ बाँकी', 'seed(s) left')}</span></span></button>}
              {farm.planted && !farm.harvested && <button type="button" className={actionButton} onClick={() => act('water')} disabled={!canWater}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-900"><Droplets size={19}/></span><span><strong className="block text-sm text-slate-950">{t('पानी जाँच्नुहोस्', 'Water if needed')}</strong><span className="mt-0.5 block text-xs text-slate-600">{farm.actionsToday.includes('water') ? t('आज पानी दिइयो', 'Watered today') : `${t('चिस्यान', 'Moisture')} ${farm.moisture}%`}</span></span></button>}
              {farm.planted && !farm.harvested && <button type="button" className={actionButton} onClick={() => act('weed')} disabled={!canWeed}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-lime-50 text-lime-900"><Leaf size={19}/></span><span><strong className="block text-sm text-slate-950">{t('झार हटाउनुहोस्', 'Remove weeds')}</strong><span className="mt-0.5 block text-xs text-slate-600">{farm.actionsToday.includes('weed') ? t('आज खेत सफा भयो', 'Cleared today') : `${t('झारपात', 'Weeds')} ${farm.weeds}%`}</span></span></button>}
              {farm.planted && !farm.harvested && <button type="button" className={actionButton} onClick={() => act('mulch')} disabled={!canMulch}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-900"><Wheat size={19}/></span><span><strong className="block text-sm text-slate-950">{farm.mulched ? t('मल्च राखियो', 'Mulch in place') : t('मल्च राख्नुहोस्', 'Add mulch')}</strong><span className="mt-0.5 block text-xs text-slate-600">{t('चिस्यान जोगाउनुहोस्', 'Conserve moisture')}</span></span></button>}
              {farm.planted && !farm.harvested && <button type="button" className={actionButton} onClick={() => act('inspect')} disabled={farm.actionsToday.includes('inspect')}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-900"><CircleHelp size={19}/></span><span><strong className="block text-sm text-slate-950">{t('खेत निरीक्षण', 'Inspect the field')}</strong><span className="mt-0.5 block text-xs text-slate-600">{farm.actionsToday.includes('inspect') ? t('आज निरीक्षण भयो', 'Checked today') : t('अवस्था र निर्देशन हेर्नुहोस्', 'Review condition and advice')}</span></span></button>}
              {farm.growthDays >= crop.daysToMaturity && !farm.harvested && <button type="button" className={`${actionButton} border-emerald-300 bg-emerald-50`} onClick={() => act('harvest')}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-emerald-900"><ShoppingBasket size={19}/></span><span><strong className="block text-sm text-emerald-950">{t('बाली भित्र्याउनुहोस्', 'Harvest crop')}</strong><span className="mt-0.5 block text-xs text-emerald-900">{t('पाकेको', 'Ripe')}</span></span></button>}
            </div>
            {farm.prepared && !farm.planted && farm.seedInventory < 1 && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p>{t('रोप्न बिउ छैन। अर्को सिजनको मौज्दातमा बिउ किन्नुहोस्।', 'No seed is available to plant. Buy a seed bag from your inventory after the harvest.')}</p></div>}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <label className="text-xs font-semibold text-slate-700" htmlFor="speech-language">{t('निर्देशनको भाषा', 'Audio language')}</label><select id="speech-language" value={speechLanguage} onChange={(event) => setSpeechLanguage(event.target.value)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900"><option value="ne">नेपाली</option><option value="en">English</option></select>
              <button type="button" onClick={() => speakText(guide)} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-emerald-950 underline decoration-emerald-300 underline-offset-4 focus:outline-none focus:ring-2 focus:ring-emerald-700"><Volume2 size={16}/>{t('निर्देशन फेरि सुन्नुहोस्', 'Replay guidance')}</button>
            </div>
            {(speechStatus || !speechSupported) && <p role="status" className="mt-2 text-xs text-slate-600">{speechStatus || t('आवाज उपलब्ध छैन; निर्देशन पढ्न सक्नुहुन्छ।', 'Audio is unavailable; the written guidance is here.')}</p>}
          </article>

          <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4" aria-live="polite"><p className="text-xs font-bold uppercase tracking-wider text-emerald-950">{t('तपाईंको निर्णयको असर', 'What changed')}</p><p className="mt-2 text-sm leading-relaxed text-emerald-950">{t(farm.lastResult.ne, farm.lastResult.en)}</p></article>

          <article className={card}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-sky-900">{t('भोलिको खेल-मौसम', 'Next game weather')}</p><h3 className="mt-1 font-bold text-slate-950">{t('भोलि', 'Tomorrow')}: {nextWeatherName}</h3></div><ForecastIcon className="text-sky-800" size={22} aria-hidden="true"/></div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{t('यो खेलभित्रको सिमुलेसन हो, वास्तविक मौसम पूर्वानुमान होइन। अर्को दिन बढाउँदा मौसमले माटोको चिस्यान बदल्छ।', 'This is simulated game weather, not a real forecast. Advancing a day changes the field moisture.')}</p>
            {!farm.harvested && <button type="button" onClick={() => updateFarm(advanceFarmDay)} disabled={!farm.planted || farm.growthDays >= crop.daysToMaturity} className={`${primaryButton} mt-4 w-full`}>{farm.growthDays >= crop.daysToMaturity ? t('बाली पाक्यो — भित्र्याउनुहोस्', 'Crop is ripe — harvest it') : t('अर्को दिनमा जानुहोस्', 'Advance one day')}<span aria-hidden="true">→</span></button>}
            <p className="mt-2 text-center text-xs text-slate-600">{farm.actionsToday.length} {t('आजका काम', 'actions today')} · {saveStatus === 'saved' ? t('यस उपकरणमा सुरक्षित', 'Saved on this device') : t('यो सत्रमा मात्र सुरक्षित; भण्डारण उपलब्ध छैन', 'Session only; browser storage is unavailable')}</p>
          </article>
        </section>
      </div>

      {farm.harvested && <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]" aria-labelledby="harvest-market-title">
        <article className={`${card} border-amber-200 bg-gradient-to-br from-amber-50 to-white`}>
          <p className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-950"><ShoppingBasket size={15}/>{t('फसल भित्र्याइयो', 'Harvest collected')}</p><h3 id="harvest-market-title" className="mt-3 text-2xl font-bold text-slate-950">{farm.produceInventory > 0 ? t('अब बालीको निर्णय गर्नुहोस्', 'Choose what to do with your harvest') : t('सिजनको बजार निर्णय पूरा भयो', 'Season market decision complete')}</h3>
          <div className="mt-4 flex flex-wrap items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-white text-amber-900 shadow-sm"><Package size={24}/></span><p className="text-sm leading-relaxed text-slate-700"><strong>{farm.produceInventory} {t('क्रेट गोलभेंडा मौज्दात', 'crates of tomatoes in inventory')}</strong><br/>{t('स्वास्थ्य र हेरचाहअनुसार खेलले क्रेट संख्या निर्धारण गर्छ।', 'The game determines crate count from the crop’s health and care.')}</p></div>
          {farm.produceInventory > 0 ? <><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => updateFarm((current) => settleHarvest(current, 'sell'))} className="rounded-xl border border-emerald-300 bg-white p-4 text-left transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-700"><span className="flex items-center gap-2 font-bold text-emerald-950"><Coins size={19}/>{t('खेलको बजारमा बेच्नुहोस्', 'Sell in game market')}</span><span className="mt-2 block text-sm text-slate-700">{farm.produceInventory * FARM_ECONOMY.coinsPerCrate} {t('खेल सिक्का प्राप्त', 'game coins earned')}</span></button><button type="button" onClick={() => updateFarm((current) => settleHarvest(current, 'home'))} className="rounded-xl border border-sky-300 bg-white p-4 text-left transition hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-700"><span className="flex items-center gap-2 font-bold text-sky-950"><ShoppingBasket size={19}/>{t('घरका लागि राख्नुहोस्', 'Keep for home')}</span><span className="mt-2 block text-sm text-slate-700">{t('खानाका लागि आफ्नो उत्पादन जोगाउनुहोस्।', 'Keep your produce for household use.')}</span></button></div><p className="mt-3 text-xs leading-relaxed text-slate-600">{t('सिक्का र मूल्य खेलभित्रका उदाहरण मात्र हुन्; वास्तविक बजार मूल्य होइनन्।', 'Coins and prices are illustrative game values, not current market prices.')}</p></> : <div className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-700">{farm.lastTrade?.choice === 'sell' ? t(`${farm.lastTrade.crates} क्रेट बेचेर ${farm.lastTrade.coins} खेल सिक्का प्राप्त भयो।`, `Sold ${farm.lastTrade.crates} crates for ${farm.lastTrade.coins} game coins.`) : t(`${farm.lastTrade?.crates || farm.totalHomeCrates} क्रेट घरमा राखियो।`, `Kept ${farm.lastTrade?.crates || farm.totalHomeCrates} crates for home.`)}</div>}
        </article>

        <article className={card}>
          <div className="flex items-center gap-2"><Award className="text-amber-800" size={20}/><h3 className="font-bold text-slate-950">{t('सिकाइ उपलब्धि', 'Learning achievements')}</h3></div>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{t('XP, स्तर र सिक्का खेलभित्रका सिकाइ पुरस्कार मात्र हुन्; वास्तविक पैसा होइनन्। बिदा लिनुहोस्—तपाईंको प्रगति सुरक्षित रहन्छ।', 'XP, levels and coins are learning rewards only; they have no cash value. Take a break whenever you like—your progress is saved.')}</p>
          <div className="mt-3 flex flex-wrap gap-2">{farm.badges.length ? farm.badges.map((badge) => <span key={badge} className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950"><Award size={14}/>{t(BADGES[badge]?.ne || badge, BADGES[badge]?.en || badge)}</span>) : <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{t('पहिलो बालीपछि उपलब्धि खुल्छ।', 'Harvest your first crop to earn a badge.')}</span>}</div>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-sm"><span className="text-slate-700">{t('बिउ', 'Seeds')}: <strong className="text-slate-950">{farm.seedInventory}</strong></span><span className="text-slate-700">{t('बजारबाट कमाइ', 'Market earned')}: <strong className="text-slate-950">{farm.marketCoins}</strong></span><span className="text-slate-700">{t('बिक्री', 'Sold')}: <strong className="text-slate-950">{farm.totalSoldCrates} {t('क्रेट', 'crates')}</strong></span><span className="text-slate-700">{t('घरका लागि', 'Kept at home')}: <strong className="text-slate-950">{farm.totalHomeCrates} {t('क्रेट', 'crates')}</strong></span></div>
          {farm.harvested && <div className="mt-4 border-t border-slate-100 pt-4">{farm.seedInventory < 1 ? <button type="button" onClick={() => updateFarm(buySeedBag)} disabled={farm.coins < FARM_ECONOMY.seedCost} className={`${secondaryButton} w-full`}><Sprout size={17}/>{t(`बिउको झोला किन्नुहोस् · ${FARM_ECONOMY.seedCost} सिक्का`, `Buy seed bag · ${FARM_ECONOMY.seedCost} coins`)}</button> : <button type="button" onClick={() => updateFarm(startNewFarmSeason)} disabled={!seasonSettled} className={`${primaryButton} w-full`}><RotateCcw size={17}/>{t('अर्को सिजन सुरु गर्नुहोस्', 'Start next season')}</button>}
            {farm.seedInventory < 1 && farm.coins < FARM_ECONOMY.seedCost && <p className="mt-2 text-xs text-slate-600">{t(`बिउ किन्न ${FARM_ECONOMY.seedCost} खेल सिक्का चाहिन्छ।`, `You need ${FARM_ECONOMY.seedCost} game coins to buy seeds.`)}</p>}
            {farm.produceInventory > 0 && <p className="mt-2 text-xs text-slate-600">{t('अर्को सिजनअघि मौज्दातको बाली बेच्नुहोस् वा घरमा राख्नुहोस्।', 'Sell or keep your remaining produce before starting another season.')}</p>}
          </div>}
        </article>
      </section>}

      <section className={card} aria-labelledby="farm-skills-title">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('तपाईंको प्रगति', 'Your progress')}</p><h3 id="farm-skills-title" className="mt-1 text-lg font-bold text-slate-950">{t('खेती सीप', 'Farming skills')}</h3></div><span className="inline-flex items-center gap-2 text-xs text-slate-600"><BookOpen size={15}/>{t('सिजन', 'Seasons')}: {farm.season} · {t('कुल बाली', 'Harvests')}: {farm.totalHarvests}</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{SKILLS.map((skill) => { const points = farm.skills[skill.id] || 0; return <article key={skill.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-900">{t(skill.ne, skill.en)}</span><span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-emerald-950">{t('स्तर', 'Lv')} {levelName(points)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" role="meter" aria-label={t(skill.ne, skill.en)} aria-valuemin="0" aria-valuemax="100" aria-valuenow={skillProgress(points)}><div className="h-full rounded-full bg-emerald-700" style={{ width: `${skillProgress(points)}%` }}/></div></article>; })}</div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-sky-200 bg-sky-50 p-4"><div className="flex items-center gap-2"><Droplets className="text-sky-900" size={19}/><h3 className="font-bold text-slate-950">{t('सिमुलेसनका सिकाइ संकेत', 'Learning from the simulation')}</h3></div><ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-800"><li>• {t('पानी दिनुअघि माटोको अवस्था जाँच्नुहोस्। धेरै सुक्खा वा धेरै भिजेको माटोले खेलमा वृद्धि रोक्न सक्छ।', 'Check soil conditions before watering. Very dry or very wet soil can pause growth in the game.')}</li><li>• {t('झार हटाउँदा बालीसँग हुने प्रतिस्पर्धा घट्छ।', 'Removing weeds reduces competition around the crop.')}</li><li>• {t('मल्चले खेलमा चिस्यान जोगाउन र झारपातको वृद्धि कम गर्न मद्दत गर्छ।', 'In the game, mulch helps conserve moisture and slow weed growth.')}</li></ul><p className="mt-3 border-t border-sky-200 pt-3 text-xs leading-relaxed text-slate-700">{t('खेलका хувь र मौसम सरल सिमुलेसन हुन्, वास्तविक खेतीको सिफारिस होइनन्। स्थानीय अवस्था अनुसार कृषि प्राविधिकको सल्लाह लिनुहोस्।', 'Game percentages and weather are simplified simulations, not real-world recommendations. Ask a local agriculture technician about your conditions.')}</p><a className="mt-3 inline-flex text-xs font-semibold text-emerald-950 underline" href="https://soil.narc.gov.np/crop/bmp/tomatobmp/" target="_blank" rel="noreferrer">{t('NARC को गोलभेंडा व्यवस्थापन स्रोत', 'NARC tomato management reference')} ↗</a></article>
        <article className={card}><div className="flex items-center gap-2"><Package className="text-emerald-900" size={19}/><h3 className="font-bold text-slate-950">{t('मौज्दात', 'Inventory')}</h3></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3"><Sprout className="text-emerald-900" size={20}/><p className="text-sm"><strong className="block text-slate-950">{t(crop.seedName.ne, crop.seedName.en)}</strong><span className="text-slate-700">{farm.seedInventory} {t('झोला', 'bag(s)')}</span></p></div><div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3"><ShoppingBasket className="text-amber-950" size={20}/><p className="text-sm"><strong className="block text-slate-950">{t('गोलभेंडा', 'Tomatoes')}</strong><span className="text-slate-700">{farm.produceInventory} {t('क्रेट', 'crates')}</span></p></div></div><p className="mt-3 text-xs text-slate-600">{t('बचत यही ब्राउजर र उपकरणमा रहन्छ। लगइन वा सर्भर जडान आवश्यक छैन।', 'Progress stays in this browser on this device. No login or server connection is needed.')}</p></article>
      </div>

      {tutorialOpen && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="tutorial-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
        {(() => { const current = TUTORIAL_STEPS[tutorialStep]; const Icon = [Sprout, Map, Wheat, Droplets, ShoppingBasket][tutorialStep] || Sprout; return <>
          <div className="flex items-start justify-between gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-950"><Icon size={27}/></span><button type="button" onClick={finishTutorial} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">{t('Оछ्यान्नुहोस्', 'Skip guide')}</button></div>
          <p className="mt-5 text-xs font-bold uppercase tracking-wider text-emerald-800">{t('खेलको परिचय', 'Game tutorial')} · {tutorialStep + 1}/{TUTORIAL_STEPS.length}</p><h3 id="tutorial-title" className="mt-2 text-2xl font-bold text-slate-950">{t(current.title.ne, current.title.en)}</h3><p className="mt-3 text-base leading-relaxed text-slate-700">{t(current.body.ne, current.body.en)}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2"><button type="button" onClick={() => speakText(current)} className={secondaryButton}><Volume2 size={17}/>{t('निर्देशन सुन्नुहोस्', 'Listen')}</button><span className="text-xs text-slate-600">{t('आफ्नो गतिमा खेल्नुहोस्; कुनै समय सीमा छैन।', 'Play at your own pace; there is no timer.')}</span></div>
          <div className="mt-6 flex items-center justify-between gap-3"><button type="button" onClick={() => setTutorialStep((step) => Math.max(0, step - 1))} disabled={tutorialStep === 0} className={`${secondaryButton} disabled:opacity-40`}>{t('अघिल्लो', 'Back')}</button>{tutorialStep < TUTORIAL_STEPS.length - 1 ? <button type="button" onClick={() => setTutorialStep((step) => step + 1)} className={primaryButton}>{t('अर्को', 'Next')} →</button> : <button type="button" onClick={finishTutorial} className={primaryButton}>{t('फार्म सुरु गर्नुहोस्', 'Start the farm')}<Check size={17}/></button>}</div>
        </>; })()}
      </section></div>}
    </div>
  );
}

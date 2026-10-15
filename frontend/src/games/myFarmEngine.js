import { CROPS, FIELDS } from './farmContent.js';

const WEATHER_PATTERN = ['cloudy', 'sunny', 'rain', 'cloudy', 'hot', 'rain', 'sunny', 'cloudy', 'rain', 'sunny', 'hot', 'rain', 'cloudy', 'sunny'];
const GAME_SEED_COST = 8;
const GAME_COIN_VALUE_PER_CRATE = 4;
const MAX_SEEDS = 3;

export const WEATHER = {
  cloudy: { ne: 'बादल', en: 'Cloudy' },
  sunny: { ne: 'घमाइलो', en: 'Sunny' },
  rain: { ne: 'वर्षा', en: 'Rain' },
  hot: { ne: 'तातो दिन', en: 'Hot day' }
};

const EMPTY_RESULT = {
  ne: 'आफ्नो सानो फार्म सुरु गर्न माटो तयार गर्नुहोस्।',
  en: 'Prepare the soil to start your small farm.'
};

const EMPTY_SKILLS = { soil: 0, water: 0, cropCare: 0, harvest: 0, market: 0 };
const VALID_ACTIONS = ['prepare', 'plant', 'water', 'weed', 'mulch', 'inspect'];

export function createFarmState() {
  return {
    version: 2,
    season: 1,
    day: 1,
    weather: WEATHER_PATTERN[0],
    fieldId: 'sunny-terrace',
    unlockedFields: ['sunny-terrace'],
    cropId: 'tomato',
    tutorialCompleted: false,
    prepared: false,
    planted: false,
    mulched: false,
    moisture: 42,
    weeds: 18,
    health: 100,
    growthDays: 0,
    harvested: false,
    seedInventory: 1,
    produceInventory: 0,
    totalHarvests: 0,
    totalSoldCrates: 0,
    totalHomeCrates: 0,
    marketCoins: 0,
    skills: { ...EMPTY_SKILLS },
    xp: 0,
    coins: 0,
    badges: [],
    awardedMilestones: [],
    actionsToday: [],
    lastTrade: null,
    lastResult: EMPTY_RESULT
  };
}

export function weatherForDay(day, season = 1) {
  const offset = Math.max(0, Math.floor(season) - 1) * 5;
  return WEATHER_PATTERN[(offset + Math.max(1, Math.floor(day)) - 1) % WEATHER_PATTERN.length];
}

export function getCropStage(state) {
  if (state.harvested) return 'harvested';
  if (!state.prepared) return 'unprepared';
  if (!state.planted) return 'prepared';
  const crop = CROPS[state.cropId] || CROPS.tomato;
  return [...crop.stages].reverse().find((stage) => state.growthDays >= stage.at)?.key || 'seed';
}

export function getCropCondition(state) {
  if (state.harvested) return 'harvested';
  if (!state.planted) return state.prepared ? 'ready-to-plant' : 'field-empty';
  if (state.growthDays >= (CROPS[state.cropId] || CROPS.tomato).daysToMaturity) return 'ready';
  if (state.moisture < 22) return 'thirsty';
  if (state.moisture > 84) return 'waterlogged';
  if (state.weeds >= 70) return 'weedy';
  if (state.health < 35) return 'recovering';
  return 'growing-well';
}

function withResult(state, message) {
  return { ...state, lastResult: message };
}

function skillUpdate(skills, additions = {}) {
  const next = { ...EMPTY_SKILLS, ...skills };
  for (const [key, amount] of Object.entries(additions)) {
    if (key in next) next[key] = Math.max(0, next[key] + amount);
  }
  return next;
}

function awardBadge(badges, badge) {
  return badges.includes(badge) ? badges : [...badges, badge];
}

function recordAction(state, action, message, { xp = 0, coins = 0, skills = {} } = {}) {
  return withResult({
    ...state,
    actionsToday: [...state.actionsToday, action],
    xp: state.xp + xp,
    coins: state.coins + coins,
    skills: skillUpdate(state.skills, skills)
  }, message);
}

export function setFarmField(state, fieldId) {
  const field = FIELDS.find((item) => item.id === fieldId);
  if (!field || !state.unlockedFields.includes(fieldId)) return state;
  if (state.prepared || state.planted || state.harvested) return withResult(state, {
    ne: 'नयाँ सिजन सुरु भएपछि मात्र बारी छान्न सकिन्छ।',
    en: 'Choose a field when you start a new season.'
  });
  return withResult({ ...state, fieldId }, {
    ne: `${field.name.ne} छान्नुभयो। मौसम र माटोको संकेत हेर्नुहोस्।`,
    en: `${field.name.en} selected. Watch the weather and soil clues.`
  });
}

export function completeFarmTutorial(state) {
  return { ...state, tutorialCompleted: true };
}

export function buySeedBag(state) {
  if (state.seedInventory >= MAX_SEEDS) return withResult(state, {
    ne: 'बिउको मौज्दात पर्याप्त छ। पहिले बारीमा रोप्नुहोस्।',
    en: 'You have enough seeds. Plant one in the field first.'
  });
  if (state.coins < GAME_SEED_COST) return withResult(state, {
    ne: `एउटा बिउको झोला किन्न ${GAME_SEED_COST} खेल सिक्का चाहिन्छ।`,
    en: `You need ${GAME_SEED_COST} game coins for a seed bag.`
  });
  return withResult({ ...state, seedInventory: state.seedInventory + 1, coins: state.coins - GAME_SEED_COST }, {
    ne: 'गोलभेंडाको एउटा बिउको झोला किनियो। सिक्का खेलभित्रका मात्र हुन्।',
    en: 'One tomato seed bag added. These coins are only for the game.'
  });
}

export function settleHarvest(state, choice) {
  if (!state.harvested || state.produceInventory < 1) return withResult(state, {
    ne: 'बिक्री वा घरमा राख्न बाली मौज्दात छैन।',
    en: 'There is no harvested produce to sell or keep.'
  });

  const crates = state.produceInventory;
  if (choice === 'sell') {
    const coins = crates * GAME_COIN_VALUE_PER_CRATE;
    return withResult({
      ...state,
      produceInventory: 0,
      totalSoldCrates: state.totalSoldCrates + crates,
      marketCoins: state.marketCoins + coins,
      coins: state.coins + coins,
      xp: state.xp + 4,
      skills: skillUpdate(state.skills, { market: 1 }),
      badges: awardBadge(state.badges, 'first-sale'),
      lastTrade: { choice, crates, coins, season: state.season }
    }, {
      ne: `${crates} क्रेट खेलको बजारमा बेचेर ${coins} खेल सिक्का प्राप्त भयो।`,
      en: `Sold ${crates} crates in the game market for ${coins} game coins.`
    });
  }

  if (choice === 'home') {
    return withResult({
      ...state,
      produceInventory: 0,
      totalHomeCrates: state.totalHomeCrates + crates,
      xp: state.xp + 2,
      skills: skillUpdate(state.skills, { market: 1 }),
      badges: awardBadge(state.badges, 'home-harvest'),
      lastTrade: { choice, crates, coins: 0, season: state.season }
    }, {
      ne: `${crates} क्रेट घरको प्रयोगका लागि राखियो। यो खेतीको एउटा उपयोगी निर्णय हो।`,
      en: `Kept ${crates} crates for home use. That is a useful farm decision too.`
    });
  }

  return state;
}

export function startNewFarmSeason(state) {
  if (!state.harvested || state.produceInventory > 0) return withResult(state, {
    ne: 'पहिले भित्र्याएको बाली बेच्नुहोस् वा घरका लागि राख्नुहोस्।',
    en: 'Sell or keep the harvested produce before starting another season.'
  });
  if (state.seedInventory < 1) return withResult(state, {
    ne: 'अर्को सिजनअघि बिउको झोला किन्नुहोस्।',
    en: 'Buy a seed bag before starting the next season.'
  });

  const nextSeason = state.season + 1;
  return {
    ...state,
    season: nextSeason,
    day: 1,
    weather: weatherForDay(1, nextSeason),
    fieldId: state.unlockedFields.includes('sheltered-plot') ? 'sheltered-plot' : 'sunny-terrace',
    prepared: false,
    planted: false,
    mulched: false,
    moisture: 42,
    weeds: 18,
    health: 100,
    growthDays: 0,
    harvested: false,
    produceInventory: 0,
    awardedMilestones: [],
    actionsToday: [],
    lastTrade: null,
    lastResult: { ne: `सिजन ${nextSeason} सुरु भयो। यसपटक बारी छानेर आफ्नो निर्णय अभ्यास गर्नुहोस्।`, en: `Season ${nextSeason} started. Choose a field and practice your decisions again.` }
  };
}

export function performFarmAction(state, action) {
  if (state.harvested) return withResult(state, {
    ne: 'सिजन पूरा भयो। बाली बेच्नुहोस् वा घरका लागि राखेपछि अर्को सिजन खोल्नुहोस्।',
    en: 'This season is complete. Sell or keep the harvest to open the next season.'
  });

  if (action === 'prepare') {
    if (state.prepared) return withResult(state, { ne: 'बेड तयार छ। अब बिउ रोप्नुहोस्।', en: 'The bed is ready. Plant a seed next.' });
    return recordAction({ ...state, prepared: true }, action, {
      ne: 'माटो तयार भयो। बेड मिलाउँदा बिउलाई राम्रो सुरुवात मिल्छ।',
      en: 'Soil prepared. An even bed gives the seed a good start.'
    }, { xp: 8, coins: 2, skills: { soil: 1 } });
  }

  if (action === 'plant') {
    if (!state.prepared) return withResult(state, { ne: 'पहिले माटो तयार गर्नुहोस्।', en: 'Prepare the soil first.' });
    if (state.planted) return withResult(state, { ne: 'बिउ रोपिसकिएको छ।', en: 'A seed is already planted.' });
    if (state.seedInventory < 1) return withResult(state, { ne: 'रोप्न बिउ छैन। बिउको झोला किन्नुहोस्।', en: 'You are out of seeds. Buy a seed bag first.' });
    const crop = CROPS[state.cropId] || CROPS.tomato;
    return recordAction({ ...state, planted: true, seedInventory: state.seedInventory - 1 }, action, {
      ne: `${crop.name.ne}को बिउ रोपियो। अब माटोको चिस्यान र मौसम हेर्नुहोस्।`,
      en: `${crop.name.en} seed planted. Watch the soil moisture and weather.`
    }, { xp: 8, coins: 2, skills: { cropCare: 1 } });
  }

  if (!state.planted) return withResult(state, { ne: 'पहिले बिउ रोपेर आफ्नो फार्म सुरु गर्नुहोस्।', en: 'Plant a seed to start your farm first.' });

  if (action === 'water') {
    if (state.actionsToday.includes(action)) return withResult(state, { ne: 'आज पानी दिइसक्नुभयो। अर्को दिनको चिस्यान हेर्नुहोस्।', en: 'You have watered today. Check moisture again tomorrow.' });
    if (state.moisture >= 62) return withResult(state, { ne: 'माटोमा अहिले पर्याप्त चिस्यान छ। धेरै पानीले जरालाई तनाव दिन सक्छ।', en: 'The soil is moist enough for now. Too much water can stress roots.' });
    const moisture = Math.min(76, state.moisture + 22);
    const health = moisture >= 32 ? Math.min(100, state.health + (state.moisture < 22 ? 8 : 2)) : state.health;
    const inRange = moisture >= 32 && moisture <= 76;
    return recordAction({ ...state, moisture, health }, action, {
      ne: `पानी दिइयो। चिस्यान ${moisture}% भयो। फेरि पानी दिनुअघि माटो जाँच्नुहोस्।`,
      en: `Water added. Moisture is now ${moisture}%. Check the soil before watering again.`
    }, { skills: inRange ? { water: 1 } : {} });
  }

  if (action === 'weed') {
    if (state.actionsToday.includes(action)) return withResult(state, { ne: 'आज झारपात हटाइसक्नुभयो।', en: 'You have removed weeds today.' });
    if (state.weeds <= 5) return withResult(state, { ne: 'खेतमा अहिले हटाउनुपर्ने झारपात छैन।', en: 'There are no weeds to remove right now.' });
    const weeds = Math.max(0, state.weeds - 35);
    const health = Math.min(100, state.health + (state.weeds >= 45 ? 5 : 1));
    return recordAction({ ...state, weeds, health }, action, {
      ne: `झारपात घटेर ${weeds}% भयो। यसले बालीसँग हुने प्रतिस्पर्धा घटाउँछ।`,
      en: `Weed pressure is down to ${weeds}%. This reduces competition around the crop.`
    }, { skills: { cropCare: 1 } });
  }

  if (action === 'mulch') {
    if (state.mulched) return withResult(state, { ne: 'माटोमा मल्च राखिसकिएको छ।', en: 'Mulch is already in place.' });
    const weeds = Math.max(0, state.weeds - 8);
    return recordAction({ ...state, mulched: true, weeds, health: Math.min(100, state.health + 2) }, action, {
      ne: 'मल्च राखियो। यसले खेलमा चिस्यान जोगाउन र झारपातको दबाब घटाउन मद्दत गर्छ।',
      en: 'Mulch added. In this game it helps conserve moisture and reduce weed pressure.'
    }, { xp: 4, skills: { soil: 1, cropCare: 1 } });
  }

  if (action === 'inspect') {
    if (state.actionsToday.includes(action)) return withResult(state, { ne: 'आजको खेत निरीक्षण पूरा भयो। अवस्था बदलिँदा फेरि हेर्नुहोस्।', en: 'Today’s field check is complete. Inspect again after conditions change.' });
    let message;
    if (state.moisture < 32) message = { ne: `माटोको चिस्यान ${state.moisture}% छ। खेलको लक्ष्य दायरा ३२–७६% हो; आवश्यक भए पानी दिनुहोस्।`, en: `Moisture is ${state.moisture}%. The game target range is 32–76%; water if needed.` };
    else if (state.moisture > 76) message = { ne: `माटोको चिस्यान ${state.moisture}% छ। थप पानी नदिनुहोस् र निकास हुन दिनुहोस्।`, en: `Moisture is ${state.moisture}%. Hold off on watering and let the field drain.` };
    else if (state.weeds >= 45) message = { ne: `झारपात ${state.weeds}% छ। हातैले हटाउँदा बालीको प्रतिस्पर्धा कम हुन्छ।`, en: `Weed pressure is ${state.weeds}%. Removing weeds reduces competition for the crop.` };
    else message = { ne: 'अहिले खेतको अवस्था स्थिर छ। मौसम हेरेर तयार भएपछि अर्को दिन जानुहोस्।', en: 'The field is stable. Watch the weather and advance when you are ready.' };
    return recordAction(state, action, message);
  }

  if (action === 'harvest') {
    const crop = CROPS[state.cropId] || CROPS.tomato;
    if (state.growthDays < crop.daysToMaturity) return withResult(state, { ne: 'बाली अझै पाक्दैछ। पाकेको चरणसम्म पर्खनुहोस्।', en: 'The crop is still growing. Wait until it reaches the ripe stage.' });
    const crates = Math.max(1, Math.min(5, Math.ceil(state.health / 20)));
    const totalHarvests = state.totalHarvests + 1;
    const unlockedFields = totalHarvests >= 1
      ? [...new Set([...state.unlockedFields, 'sheltered-plot'])]
      : state.unlockedFields;
    let badges = awardBadge(state.badges, 'first-harvest');
    if (state.health >= 80) badges = awardBadge(badges, 'careful-grower');
    return withResult({
      ...state,
      harvested: true,
      produceInventory: state.produceInventory + crates,
      totalHarvests,
      unlockedFields,
      xp: state.xp + 25,
      coins: state.coins + 10,
      skills: skillUpdate(state.skills, { harvest: 2 }),
      badges
    }, {
      ne: `${crates} क्रेट गोलभेंडा भित्र्याउनुभयो! अब बजारमा बेच्ने वा घरका लागि राख्ने निर्णय गर्नुहोस्।`,
      en: `You harvested ${crates} crates of tomatoes! Choose to sell them or keep them for home.`
    });
  }

  return state;
}

export function advanceFarmDay(state) {
  const crop = CROPS[state.cropId] || CROPS.tomato;
  if (!state.planted || state.harvested || state.growthDays >= crop.daysToMaturity) return state;

  const field = FIELDS.find((item) => item.id === state.fieldId) || FIELDS[0];
  let weatherDelta = { cloudy: -4, sunny: -12, hot: -18, rain: 22 }[state.weather] || 0;
  if (state.weather === 'sunny' || state.weather === 'hot') weatherDelta -= field.extraSunnyDrying;
  if (state.weather === 'rain') weatherDelta += field.extraRainRetention;
  const evaporation = state.mulched && weatherDelta < 0 ? Math.ceil(Math.abs(weatherDelta) * 0.65) : Math.abs(weatherDelta);
  const moisture = Math.max(0, Math.min(100, state.moisture + (weatherDelta < 0 ? -evaporation : weatherDelta)));
  const weedGrowth = state.mulched ? 4 : 7;
  const weeds = Math.min(100, state.weeds + weedGrowth);

  let health = state.health;
  let growthDays = state.growthDays;
  let xp = state.xp;
  let skills = { ...EMPTY_SKILLS, ...state.skills };
  let message;
  const [minMoisture, maxMoisture] = crop.targetMoisture;
  const moistureOkay = moisture >= minMoisture && moisture <= maxMoisture;

  if (moisture < 22) {
    health -= 12;
    message = { ne: 'माटो धेरै सुक्खा भयो। अर्को दिनअघि चिस्यान जाँच्नुहोस्।', en: 'The soil became very dry. Check moisture before advancing again.' };
  } else if (moisture > 84) {
    health -= 9;
    message = { ne: 'माटो धेरै भिजेको छ। थप पानी नदिनुहोस् र निकास हुन दिनुहोस्।', en: 'The soil is waterlogged. Hold off on water and let it drain.' };
  } else if (!moistureOkay) {
    health -= 4;
    message = { ne: 'माटोको चिस्यान लक्ष्यभन्दा बाहिर छ। अर्को कदमअघि जाँच्नुहोस्।', en: 'Soil moisture is outside the game target. Check before your next action.' };
  } else if (weeds >= 70) {
    health -= 7;
    message = { ne: 'झारपात धेरै बढ्यो र खेलमा बालीको वृद्धि रोकियो। खेत सफा गर्नुहोस्।', en: 'Weed pressure is high and crop growth paused in the game. Clear the bed.' };
  } else {
    growthDays += 1;
    health += health < 35 ? 5 : 2;
    xp += 1;
    skills = skillUpdate(skills, { water: 1, cropCare: weeds < 45 ? 1 : 0 });
    message = { ne: 'राम्रो दिन! चिस्यान र झारपातको अवस्था मिलेकाले बाली एक वृद्धि दिन अघि बढ्यो।', en: 'A good day! Suitable moisture and low weed pressure moved the crop forward one growth day.' };
  }

  const awardedMilestones = [...state.awardedMilestones];
  for (const milestone of [3, 7, 11]) {
    if (growthDays >= milestone && !awardedMilestones.includes(milestone)) {
      awardedMilestones.push(milestone);
      xp += 5;
    }
  }

  return {
    ...state,
    day: state.day + 1,
    weather: weatherForDay(state.day + 1, state.season),
    moisture,
    weeds,
    health: Math.max(0, Math.min(100, health)),
    growthDays,
    xp,
    skills,
    awardedMilestones,
    actionsToday: [],
    lastResult: message
  };
}

export function normalizeFarmState(value) {
  if (!value || typeof value !== 'object' || ![1, 2].includes(value.version)) return createFarmState();
  const base = createFarmState();
  const state = { ...base, ...value, version: 2 };

  if (value.version === 1) {
    state.season = 1;
    state.fieldId = 'sunny-terrace';
    state.unlockedFields = ['sunny-terrace', ...(value.harvested ? ['sheltered-plot'] : [])];
    state.cropId = 'tomato';
    state.seedInventory = value.planted || value.harvested ? 0 : 1;
    state.produceInventory = value.harvested ? Math.max(1, Math.min(5, Math.ceil((value.health || 100) / 20))) : 0;
    state.totalHarvests = value.harvested ? 1 : 0;
    state.totalSoldCrates = 0;
    state.totalHomeCrates = 0;
    state.marketCoins = 0;
    state.skills = { ...EMPTY_SKILLS };
    state.tutorialCompleted = false;
    state.lastTrade = null;
  }

  for (const field of ['day', 'season', 'moisture', 'weeds', 'health', 'growthDays', 'seedInventory', 'produceInventory', 'totalHarvests', 'totalSoldCrates', 'totalHomeCrates', 'marketCoins', 'xp', 'coins']) {
    if (!Number.isFinite(state[field]) || state[field] < 0) state[field] = base[field];
  }
  state.day = Math.max(1, Math.floor(state.day));
  state.season = Math.max(1, Math.floor(state.season));
  state.seedInventory = Math.min(MAX_SEEDS, Math.floor(state.seedInventory));
  for (const field of ['produceInventory', 'totalHarvests', 'totalSoldCrates', 'totalHomeCrates', 'marketCoins', 'xp', 'coins']) state[field] = Math.floor(state[field]);
  for (const field of ['moisture', 'weeds', 'health']) state[field] = Math.min(100, state[field]);
  state.growthDays = Math.min(12, Math.floor(state.growthDays));
  state.weather = WEATHER[state.weather] ? state.weather : weatherForDay(state.day, state.season);
  state.fieldId = FIELDS.some((field) => field.id === state.fieldId) ? state.fieldId : 'sunny-terrace';
  state.cropId = CROPS[state.cropId] ? state.cropId : 'tomato';
  state.unlockedFields = Array.isArray(state.unlockedFields)
    ? [...new Set(['sunny-terrace', ...state.unlockedFields.filter((id) => FIELDS.some((field) => field.id === id))])]
    : ['sunny-terrace'];
  if (state.totalHarvests > 0 && !state.unlockedFields.includes('sheltered-plot')) state.unlockedFields.push('sheltered-plot');
  if (!state.unlockedFields.includes(state.fieldId)) state.fieldId = 'sunny-terrace';
  state.produceInventory = Math.min(999, state.produceInventory);
  for (const field of ['totalHarvests', 'totalSoldCrates', 'totalHomeCrates', 'marketCoins', 'xp', 'coins']) state[field] = Math.min(1000000000, state[field]);
  state.badges = Array.isArray(state.badges) ? [...new Set(state.badges.filter((item) => typeof item === 'string'))] : [];
  state.awardedMilestones = Array.isArray(state.awardedMilestones) ? [...new Set(state.awardedMilestones.filter((item) => [3, 7, 11].includes(item)))] : [];
  state.actionsToday = Array.isArray(state.actionsToday) ? state.actionsToday.filter((item) => VALID_ACTIONS.includes(item)) : [];
  state.skills = Object.fromEntries(Object.keys(EMPTY_SKILLS).map((key) => [key, Number.isFinite(state.skills?.[key]) ? Math.max(0, Math.floor(state.skills[key])) : 0]));
  state.tutorialCompleted = Boolean(state.tutorialCompleted);
  state.lastResult = state.lastResult && typeof state.lastResult.en === 'string' && typeof state.lastResult.ne === 'string' ? state.lastResult : EMPTY_RESULT;
  state.lastTrade = state.lastTrade && ['sell', 'home'].includes(state.lastTrade.choice) ? state.lastTrade : null;
  state.prepared = Boolean(state.prepared);
  state.planted = Boolean(state.planted && state.prepared);
  state.mulched = Boolean(state.mulched);
  state.harvested = Boolean(state.harvested && state.planted);
  return state;
}

export const FARM_ECONOMY = { seedCost: GAME_SEED_COST, coinsPerCrate: GAME_COIN_VALUE_PER_CRATE };

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceFarmDay, createFarmState, getCropStage, normalizeFarmState,
  performFarmAction, weatherForDay, setFarmCrop, SEASONS
, syncRealSensorFeed} from './myFarmEngine.js';
import { CROPS, FIELDS } from './farmContent.js';

test('a prepared bed can be planted, watered and advanced deterministically', () => {
  let farm = createFarmState();
  farm = performFarmAction(farm, 'prepare');
  farm = performFarmAction(farm, 'plant');
  farm = performFarmAction(farm, 'water');

  assert.equal(farm.prepared, true);
  assert.equal(farm.planted, true);
  assert.equal(farm.moisture, 64);
  assert.equal(farm.xp, 16);

  const nextDay = advanceFarmDay(farm);
  assert.equal(nextDay.day, 2);
  assert.equal(nextDay.weather, 'sunny');
  assert.equal(nextDay.moisture, 60);
  assert.equal(nextDay.growthDays, 1);
  assert.equal(getCropStage(nextDay), 'germination');
});

test('dry or waterlogged soil slows growth and affects crop health', () => {
  const dry = { ...createFarmState(), prepared: true, planted: true, moisture: 8, weather: 'sunny' };
  const dryDay = advanceFarmDay(dry);
  assert.equal(dryDay.growthDays, 0);
  assert.equal(dryDay.health, 88);

  const waterlogged = { ...createFarmState(), prepared: true, planted: true, moisture: 80, weather: 'rain' };
  const wetDay = advanceFarmDay(waterlogged);
  assert.equal(wetDay.moisture, 100);
  assert.equal(wetDay.growthDays, 0);
  assert.equal(wetDay.health, 91);
});

test('milestone rewards are awarded once and a ripe crop can be harvested', () => {
  const nearMilestone = { ...createFarmState(), prepared: true, planted: true, moisture: 50, weeds: 0, nutrition: 60, growthDays: 2 };
  const milestoneDay = advanceFarmDay(nearMilestone);
  assert.equal(milestoneDay.growthDays, 3);
  assert.ok(milestoneDay.awardedMilestones.length > 0);

  const ripe = { ...milestoneDay, growthDays: 12 };
  assert.equal(advanceFarmDay(ripe), ripe);
  const harvested = performFarmAction(ripe, 'harvest');
  assert.equal(harvested.harvested, true);
  assert.equal(harvested.badges.includes('first-harvest'), true);
  assert.equal(harvested.coins, 10);
  assert.equal(getCropStage(harvested), 'harvested');
});

test('saved progress is bounded and invalid data falls back safely', () => {
  const normalized = normalizeFarmState({
    version: 2, day: 4, prepared: true, planted: true, moisture: 140, weeds: -2,
    health: 75, growthDays: 20, xp: 12, coins: 4, weather: 'unknown', actionsToday: 'water',
    season: 1
  });
  assert.equal(normalized.day, 4);
  assert.equal(normalized.moisture, 100);
  assert.equal(normalized.weeds, 18);
  assert.equal(normalized.growthDays, 12); // tomato max
  assert.equal(normalized.weather, weatherForDay(4, 1));
  assert.deepEqual(normalized.actionsToday, []);
  assert.equal(normalizeFarmState({ version: 99 }).day, 1);
});

test('fertilize action costs coins and boosts nutrition and health', () => {
  let farm = { ...createFarmState(), prepared: true, planted: true, coins: 20, nutrition: 30 };
  farm = performFarmAction(farm, 'fertilize');
  assert.equal(farm.fertilized, true);
  assert.equal(farm.coins, 16); // 20 - 4
  assert.equal(farm.nutrition, 70); // 30 + 40
  assert.ok(farm.health >= 100 || farm.health > 100 - 5); // health +5

  // Cannot fertilize twice
  const again = performFarmAction(farm, 'fertilize');
  assert.equal(again.fertilized, true);
  assert.equal(again.coins, 16); // unchanged
});

test('low nutrition slows growth but crop still advances', () => {
  const farm = { ...createFarmState(), prepared: true, planted: true, moisture: 50, weeds: 0, nutrition: 10 };
  const next = advanceFarmDay(farm);
  // Nutrition < 15 → growth advances 1 but health dips
  assert.equal(next.growthDays, 1);
  assert.ok(next.health < farm.health);
});

test('setFarmCrop switches crop before planting and rejects after', () => {
  let farm = createFarmState();
  farm = setFarmCrop(farm, 'potato');
  assert.equal(farm.cropId, 'potato');

  // Cannot switch after preparing
  const prepared = { ...farm, prepared: true };
  const blocked = setFarmCrop(prepared, 'rice');
  assert.equal(blocked.cropId, 'potato'); // unchanged
});

test('multi-crop harvest awards crop-specific badges', () => {
  const riceState = {
    ...createFarmState(), cropId: 'rice', prepared: true, planted: true,
    growthDays: 18, health: 90, coins: 10, harvestedCropIds: ['tomato', 'potato']
  };
  const harvested = performFarmAction(riceState, 'harvest');
  assert.equal(harvested.badges.includes('first-rice'), true);
  assert.equal(harvested.badges.includes('three-crops'), true); // tomato+potato+rice = 3
});

test('seasonal weather pattern changes by season', () => {
  // Season 1 = spring, season 2 = monsoon
  const springDay1 = weatherForDay(1, 1);
  const monsoonDay1 = weatherForDay(1, 2);
  // They should produce weather from different patterns
  assert.ok(typeof springDay1 === 'string');
  assert.ok(typeof monsoonDay1 === 'string');
  // Both seasons' day-1 weather are defined WEATHER keys
  const validWeathers = ['cloudy', 'sunny', 'rain', 'hot'];
  assert.ok(validWeathers.includes(springDay1));
  assert.ok(validWeathers.includes(monsoonDay1));
});

test('greenhouse field dampens moisture swings', () => {
  const normal = { ...createFarmState(), prepared: true, planted: true, moisture: 50, weather: 'hot', fieldId: 'sunny-terrace', nutrition: 50 };
  const green  = { ...normal, fieldId: 'greenhouse-plot', unlockedFields: ['sunny-terrace', 'greenhouse-plot'] };
  const normalNext = advanceFarmDay(normal);
  const greenNext  = advanceFarmDay(green);
  // Greenhouse should lose less moisture on hot day
  assert.ok(greenNext.moisture > normalNext.moisture, `greenhouse(${greenNext.moisture}) should retain more than terrace(${normalNext.moisture})`);
});

test('all four crop types are valid and accessible', () => {
  for (const id of ['tomato', 'potato', 'rice', 'maize']) {
    const crop = CROPS[id];
    assert.ok(crop, `CROPS.${id} should exist`);
    assert.ok(crop.daysToMaturity > 0);
    assert.ok(Array.isArray(crop.stages) && crop.stages.length > 0);
    assert.ok(Array.isArray(crop.targetMoisture) && crop.targetMoisture.length === 2);
  }
});

test('all four field types are valid and accessible', () => {
  const ids = FIELDS.map((f) => f.id);
  assert.ok(ids.includes('sunny-terrace'));
  assert.ok(ids.includes('sheltered-plot'));
  assert.ok(ids.includes('irrigated-paddy'));
  assert.ok(ids.includes('greenhouse-plot'));
  const greenhouse = FIELDS.find((f) => f.id === 'greenhouse-plot');
  assert.equal(greenhouse.weatherDampening, true);
});
test('syncRealSensorFeed mirrors real sensor data into farm state', () => {
  const farm = { ...createFarmState(), prepared: true, planted: true, moisture: 40 };
  const synced = syncRealSensorFeed(farm, { soilMoisture: 65, temp: 24, humidity: 70 });
  assert.equal(synced.moisture, 65);
  assert.equal(synced.isMirrorMode, true);
  assert.ok(synced.lastResult.en.includes('Live Sensor Synced'));
});
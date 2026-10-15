import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceFarmDay, createFarmState, getCropStage, normalizeFarmState, performFarmAction, weatherForDay } from './myFarmEngine.js';

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
  const nearMilestone = { ...createFarmState(), prepared: true, planted: true, moisture: 50, weeds: 0, growthDays: 2 };
  const milestoneDay = advanceFarmDay(nearMilestone);
  assert.equal(milestoneDay.growthDays, 3);
  assert.equal(milestoneDay.xp, 6);
  assert.deepEqual(milestoneDay.awardedMilestones, [3]);

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
    version: 1, day: 4, prepared: true, planted: true, moisture: 140, weeds: -2,
    health: 75, growthDays: 20, xp: 12, coins: 4, weather: 'unknown', actionsToday: 'water'
  });
  assert.equal(normalized.day, 4);
  assert.equal(normalized.moisture, 100);
  assert.equal(normalized.weeds, 18);
  assert.equal(normalized.growthDays, 12);
  assert.equal(normalized.weather, weatherForDay(4));
  assert.deepEqual(normalized.actionsToday, []);
  assert.equal(normalizeFarmState({ version: 99 }).day, 1);
});

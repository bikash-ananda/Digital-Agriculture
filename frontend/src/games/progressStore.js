import { createFarmState, normalizeFarmState } from './myFarmEngine';

const STORE_PREFIX = 'digital-agriculture:games:my-farm:v1:';

export function gameStorageKey(user) {
  const identity = user
    ? user.id ?? user.username ?? user.email ?? 'signed-in-user'
    : 'guest';
  return `${STORE_PREFIX}${encodeURIComponent(String(identity))}`;
}

export function readMyFarmProgress(user) {
  try {
    const raw = window.localStorage.getItem(gameStorageKey(user));
    return raw ? normalizeFarmState(JSON.parse(raw)) : createFarmState();
  } catch {
    return createFarmState();
  }
}

export function saveMyFarmProgress(user, state) {
  try {
    window.localStorage.setItem(gameStorageKey(user), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

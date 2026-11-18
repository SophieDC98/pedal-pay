// The app's saved state. The fill bookmark reads this same shape, so it is versioned.
//
// answers: { 'YYYY-MM-DD': true }  a ride
//          { 'YYYY-MM-DD': false } no ride
//          key absent               a missed day

export const STORAGE_KEY = 'pedal-pay';

export function emptyState() {
  return { version: 1, kmPerRide: null, ratePerKm: null, reminderTime: '09:00', allowedSites: [], answers: {} };
}

export function loadState(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY));
    if (!parsed || parsed.version !== 1) return emptyState();
    const state = { ...emptyState(), ...parsed };
    if (typeof state.answers !== 'object' || state.answers === null) state.answers = {};
    if (!Array.isArray(state.allowedSites)) state.allowedSites = [];
    return state;
  } catch {
    return emptyState();
  }
}

export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function setAnswer(state, key, ride) {
  return { ...state, answers: { ...state.answers, [key]: ride } };
}

export function clearAnswer(state, key) {
  const answers = { ...state.answers };
  delete answers[key];
  return { ...state, answers };
}

// Sites (origins) the user let the app share their rides with.
export function allowSite(state, origin) {
  if (state.allowedSites.includes(origin)) return state;
  return { ...state, allowedSites: [...state.allowedSites, origin] };
}

export function isSetUp(state) {
  return state.kmPerRide > 0 && state.ratePerKm > 0;
}

export function parseDecimal(text) {
  const clean = String(text ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isFinite(n) && n > 0 ? n : null;
}

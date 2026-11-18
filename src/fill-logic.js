// Pure helpers for the fill bookmark's review panel. Bundled into the bookmark
// together with dates.js, so this file only imports from there.

import { monthDays } from './dates.js';

const MONTHS_NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

// Before the 15th people claim last month; from the 15th, this month.
export function defaultMonth(todayKey) {
  const [y, m, d] = todayKey.split('-').map(Number);
  const back = d < 15 ? 1 : 0;
  const date = new Date(y, m - 1 - back, 1);
  return { year: date.getFullYear(), month0: date.getMonth() };
}

// rides: the app's ride keys, or null when the app gave none.
export function initialTicks(rides, year, month0, existing) {
  const days = monthDays(year, month0);
  const keys = rides === null
    ? days.filter(d => d.workday).map(d => d.key)
    : days.map(d => d.key).filter(k => rides.includes(k));
  return new Set(keys.filter(k => !existing.has(k)));
}

export function travelPurpose(year, month0) {
  return `Fietsvergoeding ${MONTHS_NL[month0]} ${year}`;
}

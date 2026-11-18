// Pure helpers for the fill bookmark. Bundled into the bookmark together with
// dates.js, so this file imports nothing.

const MONTHS_NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

// Before the 15th people claim last month; from the 15th, this month.
export function defaultMonth(todayKey) {
  const [y, m, d] = todayKey.split('-').map(Number);
  const back = d < 15 ? 1 : 0;
  const date = new Date(y, m - 1 - back, 1);
  return { year: date.getFullYear(), month0: date.getMonth() };
}

// What the fill bookmark does to one month so ERPx matches the app: add the
// rides ERPx lacks, remove the bike lines that are not rides.
export function planMonth(rides, bikeDays, year, month0) {
  const prefix = `${year}-${String(month0 + 1).padStart(2, '0')}-`;
  const rideSet = new Set(rides.filter(k => k.startsWith(prefix)));
  const add = [...rideSet].filter(k => !bikeDays.has(k)).sort();
  const remove = [...bikeDays].filter(k => k.startsWith(prefix) && !rideSet.has(k)).sort();
  return { add, remove };
}

export function travelPurpose(year, month0) {
  return `Fietsvergoeding ${MONTHS_NL[month0]} ${year}`;
}

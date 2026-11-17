// The numbers on the main screen, the streak, and when to show the morning prompt.

import { fromKey, toKey, isWorkday } from './dates.js';

export function totals(state, { year, month0 }) {
  const prefix = month0 === undefined
    ? `${year}-`
    : `${year}-${String(month0 + 1).padStart(2, '0')}-`;
  const rides = Object.entries(state.answers)
    .filter(([key, ride]) => ride === true && key.startsWith(prefix)).length;
  const km = Math.round(rides * (state.kmPerRide || 0) * 100) / 100;
  const euros = Math.round(km * (state.ratePerKm || 0) * 100) / 100;
  return { rides, km, euros };
}

// Workdays in a row with a ride. Weekends, holidays and missed days are
// skipped; an explicit "no" ends the streak.
export function streak(state, todayKey) {
  const day = fromKey(todayKey);
  let count = 0;
  for (let i = 0; i < 400; i++) {
    const key = toKey(day);
    if (isWorkday(key)) {
      const answer = state.answers[key];
      if (answer === true) count++;
      else if (answer === false) break;
    }
    day.setDate(day.getDate() - 1);
  }
  return count;
}

export function needsPrompt(state, todayKey) {
  return isWorkday(todayKey) && !(todayKey in state.answers);
}

const euroFormat = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatEuros(n) {
  return `€${euroFormat.format(n)}`;
}

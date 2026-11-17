// Calendar days as local 'YYYY-MM-DD' keys, and Belgian public holidays.

const pad = n => String(n).padStart(2, '0');

export function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Anonymous Gregorian algorithm, as in the colleague's ERPx script.
function easter(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const holidayCache = new Map();

export function belgianHolidays(year) {
  if (holidayCache.has(year)) return holidayCache.get(year);
  const fixed = [[0, 1], [4, 1], [6, 21], [7, 15], [10, 1], [10, 11], [11, 25]];
  const days = fixed.map(([m, d]) => new Date(year, m, d));
  const e = easter(year);
  for (const offset of [1, 39, 50]) {
    days.push(new Date(year, e.getMonth(), e.getDate() + offset));
  }
  const set = new Set(days.map(toKey));
  holidayCache.set(year, set);
  return set;
}

export function isHoliday(key) {
  return belgianHolidays(Number(key.slice(0, 4))).has(key);
}

export function isWorkday(key) {
  const day = fromKey(key).getDay();
  return day !== 0 && day !== 6 && !isHoliday(key);
}

export function monthDays(year, month0) {
  const count = new Date(year, month0 + 1, 0).getDate();
  const days = [];
  for (let day = 1; day <= count; day++) {
    const date = new Date(year, month0, day);
    const key = toKey(date);
    days.push({
      key,
      day,
      weekday0Mon: (date.getDay() + 6) % 7,
      workday: isWorkday(key),
      holiday: isHoliday(key),
    });
  }
  return days;
}

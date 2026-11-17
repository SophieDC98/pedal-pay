import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toKey, fromKey, belgianHolidays, isWorkday, monthDays } from '../src/dates.js';

test('toKey uses the local date', () => {
  assert.equal(toKey(new Date(2026, 2, 29, 0, 30)), '2026-03-29');
  assert.equal(toKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('fromKey round-trips', () => {
  assert.equal(toKey(fromKey('2026-12-31')), '2026-12-31');
});

test('belgian holidays 2026', () => {
  assert.deepEqual([...belgianHolidays(2026)].sort(), [
    '2026-01-01', '2026-04-06', '2026-05-01', '2026-05-14', '2026-05-25',
    '2026-07-21', '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-25']);
});

test('isWorkday', () => {
  assert.equal(isWorkday('2026-11-17'), true);   // Tuesday
  assert.equal(isWorkday('2026-11-14'), false);  // Saturday
  assert.equal(isWorkday('2026-11-11'), false);  // Armistice, a Wednesday
});

test('monthDays November 2026', () => {
  const days = monthDays(2026, 10);
  assert.equal(days.length, 30);
  assert.deepEqual(days[0], { key: '2026-11-01', day: 1, weekday0Mon: 6, workday: false, holiday: true });
  assert.equal(days.filter(d => d.workday).length, 20);
});

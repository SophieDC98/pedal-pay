import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMonth, initialTicks, travelPurpose } from '../src/fill-logic.js';

test('defaultMonth: previous month before the 15th, current month from the 15th', () => {
  assert.deepEqual(defaultMonth('2026-11-14'), { year: 2026, month0: 9 });
  assert.deepEqual(defaultMonth('2026-11-15'), { year: 2026, month0: 10 });
  assert.deepEqual(defaultMonth('2027-01-03'), { year: 2026, month0: 11 });
});

test('initialTicks takes the month\'s rides and leaves out days already in ERPx', () => {
  const ticks = initialTicks(['2026-10-30', '2026-11-02', '2026-11-03'], 2026, 10, new Set(['2026-11-03']));
  assert.deepEqual([...ticks], ['2026-11-02']);
});

test('initialTicks without app data ticks every workday', () => {
  assert.equal(initialTicks(null, 2026, 10, new Set()).size, 20);
  assert.equal(initialTicks(null, 2026, 10, new Set(['2026-11-02'])).size, 19);
});

test('travelPurpose uses the Dutch month name', () => {
  assert.equal(travelPurpose(2026, 10), 'Fietsvergoeding november 2026');
  assert.equal(travelPurpose(2027, 0), 'Fietsvergoeding januari 2027');
});

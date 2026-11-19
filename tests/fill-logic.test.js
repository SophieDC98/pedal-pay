import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMonth, planMonth, rateFromLines, travelPurpose } from '../src/fill-logic.js';

test('defaultMonth: previous month before the 15th, current month from the 15th', () => {
  assert.deepEqual(defaultMonth('2026-11-14'), { year: 2026, month0: 9 });
  assert.deepEqual(defaultMonth('2026-11-15'), { year: 2026, month0: 10 });
  assert.deepEqual(defaultMonth('2027-01-03'), { year: 2026, month0: 11 });
});

test('planMonth adds the month\'s rides that ERPx lacks and removes bike lines that are not rides', () => {
  const rides = ['2026-10-30', '2026-11-02', '2026-11-03', '2026-11-16'];
  const bikeDays = new Set(['2026-11-03', '2026-11-05', '2026-12-01']);
  assert.deepEqual(planMonth(rides, bikeDays, 2026, 10), {
    add: ['2026-11-02', '2026-11-16'],
    remove: ['2026-11-05'],
  });
});

test('planMonth with everything in place has nothing to do', () => {
  assert.deepEqual(planMonth(['2026-11-02'], new Set(['2026-11-02']), 2026, 10), { add: [], remove: [] });
});

test('travelPurpose uses the Dutch month name', () => {
  assert.equal(travelPurpose(2026, 10), 'Fietsvergoeding november 2026');
  assert.equal(travelPurpose(2027, 0), 'Fietsvergoeding januari 2027');
});

test('rateFromLines works out the rate per km from bike lines, ignoring odd ones', () => {
  assert.equal(rateFromLines([{ quantity: 18, amount: 6.84 }, { quantity: 6, amount: 2.28 }]), 0.38);
  assert.equal(rateFromLines([{ quantity: 0, amount: 0 }, { quantity: 10, amount: 55 }, { quantity: 12, amount: 4.32 }]), 0.36);
  assert.equal(rateFromLines([]), null);
  assert.equal(rateFromLines([{ quantity: 18, amount: undefined }]), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totals, streak, needsPrompt, formatEuros } from '../src/stats.js';

const st = { version: 1, kmPerRide: 18, ratePerKm: 0.36, answers: {
  '2026-10-30': true, '2026-11-02': true, '2026-11-03': true, '2026-11-04': false,
  '2026-11-05': true, '2026-11-06': true, '2026-11-09': true, '2026-11-10': true,
  '2026-11-12': true, '2026-11-16': true, '2026-11-17': true } };

test('month totals', () => {
  assert.deepEqual(totals(st, { year: 2026, month0: 10 }), { rides: 9, km: 162, euros: 58.32 });
});

test('year totals include other months', () => {
  assert.deepEqual(totals(st, { year: 2026 }), { rides: 10, km: 180, euros: 64.8 });
});

test('totals of another year are zero', () => {
  assert.deepEqual(totals(st, { year: 2025 }), { rides: 0, km: 0, euros: 0 });
});

test('streak skips weekends, holidays and missed days and stops at a no', () => {
  // 17,16 ride; 13 missed; 12 ride; 11 holiday; 10,9 ride; 6,5 ride; 4 is a no
  assert.equal(streak(st, '2026-11-17'), 7);
});

test('an unanswered today does not break the streak', () => {
  assert.equal(streak(st, '2026-11-18'), 7);
});

test('a no today gives a streak of 0', () => {
  assert.equal(streak({ ...st, answers: { ...st.answers, '2026-11-18': false } }, '2026-11-18'), 0);
});

test('needsPrompt', () => {
  assert.equal(needsPrompt(st, '2026-11-18'), true);   // workday, no answer
  assert.equal(needsPrompt(st, '2026-11-17'), false);  // answered
  assert.equal(needsPrompt(st, '2026-11-11'), false);  // holiday
  assert.equal(needsPrompt(st, '2026-11-21'), false);  // Saturday
});

test('formatEuros', () => {
  assert.equal(formatEuros(64.8), '€64.80');
  assert.equal(formatEuros(1234.5), '€1,234.50');
  assert.equal(formatEuros(0), '€0.00');
});

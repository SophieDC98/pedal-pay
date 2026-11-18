import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totals, streak, needsPrompt, promptDue, minutesOf, formatEuros } from '../src/stats.js';

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

test('streak counts back from today and stops at the first unmarked workday', () => {
  // 17, 16 ride; 13 missed: the streak ends there
  assert.equal(streak(st, '2026-11-17'), 2);
});

test('unmarked weekends and holidays are skipped, marked ones count', () => {
  const s2 = { ...st, answers: { '2026-11-09': true, '2026-11-10': true, '2026-11-12': true, '2026-11-13': true, '2026-11-14': true, '2026-11-16': true } };
  // 16 ride; 15 unmarked Sunday skipped; 14 marked Saturday counts; 13, 12 ride;
  // 11 holiday skipped; 10, 9 ride; 8, 7 weekend skipped; 6 unmarked workday ends it
  assert.equal(streak(s2, '2026-11-16'), 6);   // 16, 14, 13, 12, 10, 9
});

test('an unanswered today does not break the streak; a No today does', () => {
  assert.equal(streak(st, '2026-11-18'), 2);
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

test('promptDue waits for the reminder time on a workday without an answer', () => {
  const s = { ...st, reminderTime: '09:00' };
  assert.equal(promptDue(s, '2026-11-18', 8 * 60 + 59), false);
  assert.equal(promptDue(s, '2026-11-18', 9 * 60), true);
  assert.equal(promptDue(s, '2026-11-18', 14 * 60), true);
  assert.equal(promptDue(s, '2026-11-17', 10 * 60), false);  // answered
  assert.equal(promptDue(s, '2026-11-21', 10 * 60), false);  // Saturday
  assert.equal(promptDue({ ...s, reminderTime: '07:15' }, '2026-11-18', 7 * 60 + 15), true);
});

test('minutesOf reads HH:MM and falls back to 09:00', () => {
  assert.equal(minutesOf('07:15'), 435);
  assert.equal(minutesOf('nonsense'), 540);
  assert.equal(minutesOf(undefined), 540);
});

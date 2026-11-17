import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, loadState, saveState, setAnswer, clearAnswer, isSetUp, parseDecimal, STORAGE_KEY } from '../src/store.js';

const mem = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test('storage key is pedal-pay', () => assert.equal(STORAGE_KEY, 'pedal-pay'));

test('missing, corrupt or wrong-version data gives an empty state', () => {
  assert.deepEqual(loadState(mem()), emptyState());
  assert.deepEqual(loadState(mem({ 'pedal-pay': '{not json' })), emptyState());
  assert.deepEqual(loadState(mem({ 'pedal-pay': '{"version":99}' })), emptyState());
  assert.deepEqual(loadState(mem({ 'pedal-pay': 'null' })), emptyState());
  assert.deepEqual(loadState(null), emptyState());
});

test('storage that throws is survived', () => {
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(loadState(bad), emptyState());
  assert.equal(saveState(bad, emptyState()), false);
});

test('save then load round-trips', () => {
  const s = mem();
  const st = setAnswer({ ...emptyState(), kmPerRide: 18, ratePerKm: 0.36 }, '2026-11-17', true);
  assert.equal(saveState(s, st), true);
  assert.deepEqual(loadState(s), st);
});

test('a version-1 object with missing fields is filled in', () => {
  assert.deepEqual(loadState(mem({ 'pedal-pay': '{"version":1,"kmPerRide":18}' })),
    { ...emptyState(), kmPerRide: 18 });
});

test('setAnswer does not mutate', () => {
  const a = emptyState();
  const b = setAnswer(a, '2026-11-17', false);
  assert.deepEqual(a.answers, {});
  assert.equal(b.answers['2026-11-17'], false);
});

test('isSetUp', () => {
  assert.equal(isSetUp(emptyState()), false);
  assert.equal(isSetUp({ ...emptyState(), kmPerRide: 18, ratePerKm: 0.36 }), true);
});

test('parseDecimal accepts comma and dot', () => {
  assert.equal(parseDecimal('0,36'), 0.36);
  assert.equal(parseDecimal(' 18 '), 18);
  assert.equal(parseDecimal('abc'), null);
  assert.equal(parseDecimal('-2'), null);
  assert.equal(parseDecimal(''), null);
  assert.equal(parseDecimal('1,2,3'), null);
});

test('clearAnswer turns a day back into a missed day without mutating', () => {
  const a = setAnswer(emptyState(), '2026-11-16', true);
  const b = clearAnswer(a, '2026-11-16');
  assert.equal('2026-11-16' in b.answers, false);
  assert.equal(a.answers['2026-11-16'], true);
});

test('the reminder time defaults to 09:00, also for older saved data', () => {
  assert.equal(emptyState().reminderTime, '09:00');
  assert.equal(loadState(mem({ 'pedal-pay': '{"version":1,"kmPerRide":18,"ratePerKm":0.36,"answers":{}}' })).reminderTime, '09:00');
});

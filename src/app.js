// Pedal Pay's screens. The only module that touches the page, storage and notifications.

import { toKey, fromKey, monthDays } from './dates.js';
import { loadState, saveState, setAnswer, isSetUp, parseDecimal } from './store.js';
import { totals, streak, needsPrompt, formatEuros } from './stats.js';

const $ = id => document.getElementById(id);
const storage = (() => { try { return window.localStorage; } catch { return null; } })();
const views = ['setup', 'prompt', 'main', 'settings'];
const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

let state = loadState(storage);
let scope = 'month';
let shown = null; // { year, month0 } of the calendar
let savedTimer = null;

// The browser test sets 'pedal-pay-today' to pin the date.
function today() {
  try {
    const pinned = storage?.getItem('pedal-pay-today');
    if (pinned) return pinned;
  } catch { /* storage blocked */ }
  return toKey(new Date());
}
window.pedalPay = { today };

function show(view) {
  for (const v of views) $(v).hidden = v !== view;
  $('open-settings').hidden = view !== 'main';
}

function save(next) {
  state = next;
  saveState(storage, state);
}

// Picks the screen for the current state and day.
function start() {
  clearTimeout(savedTimer);
  state = loadState(storage);
  if (!isSetUp(state)) return show('setup');
  if (needsPrompt(state, today())) {
    $('prompt-saved').hidden = true;
    show('prompt');
    notify();
    return;
  }
  showMain();
}

function showMain() {
  const t = fromKey(today());
  if (!shown) shown = { year: t.getFullYear(), month0: t.getMonth() };
  renderMain();
  show('main');
}

function renderMain() {
  const todayKey = today();
  const year = scope === 'year' ? fromKey(todayKey).getFullYear() : shown.year;
  const sum = totals(state, scope === 'year' ? { year } : { year: shown.year, month0: shown.month0 });

  $('scope-month').setAttribute('aria-pressed', String(scope === 'month'));
  $('scope-year').setAttribute('aria-pressed', String(scope === 'year'));
  $('stat-km').innerHTML = `${sum.km.toLocaleString('en-GB')}<small>km</small>`;
  $('stat-euros').textContent = formatEuros(sum.euros);
  const n = streak(state, todayKey);
  $('stat-streak').textContent = `🔥 ${n}-day streak`;
  $('stat-streak').hidden = n === 0;

  $('month-label').textContent = monthName.format(new Date(shown.year, shown.month0, 1));
  renderCalendar(todayKey);
}

function renderCalendar(todayKey) {
  const cal = $('calendar');
  cal.replaceChildren();
  for (const w of WEEKDAYS) {
    const el = document.createElement('div');
    el.className = 'weekday';
    el.textContent = w;
    cal.append(el);
  }
  const days = monthDays(shown.year, shown.month0);
  for (let i = 0; i < days[0].weekday0Mon; i++) cal.append(document.createElement('div'));
  for (const d of days) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'day';
    b.dataset.key = d.key;
    b.textContent = String(d.day);
    const ride = state.answers[d.key] === true;
    if (d.holiday) b.classList.add('holiday');
    else if (!d.workday) b.classList.add('weekend');
    if (ride) b.classList.add('ride');
    if (d.key === todayKey) { b.classList.add('today'); b.setAttribute('aria-current', 'date'); }
    b.disabled = d.key > todayKey;
    b.setAttribute('aria-pressed', String(ride));
    b.setAttribute('aria-label', `${d.day} ${monthName.format(fromKey(d.key))}${ride ? ', ride' : ''}`);
    cal.append(b);
  }
}

function moveMonth(delta) {
  const d = new Date(shown.year, shown.month0 + delta, 1);
  shown = { year: d.getFullYear(), month0: d.getMonth() };
  scope = 'month';
  renderMain();
}

// Reads the two number fields of a form; marks the bad ones.
function readNumbers(prefix) {
  const result = {};
  for (const [field, name] of [['km', 'kmPerRide'], ['rate', 'ratePerKm']]) {
    const input = $(`${prefix}-${field}`);
    const error = $(`${prefix}-${field}-error`);
    const value = parseDecimal(input.value);
    input.setAttribute('aria-invalid', String(value === null));
    error.hidden = value !== null;
    error.textContent = value === null ? 'Enter a number above 0, like 18 or 0,36' : '';
    result[name] = value;
  }
  return result.kmPerRide !== null && result.ratePerKm !== null ? result : null;
}

const formatNumber = n => String(n).replace('.', ',');

function answer(ride) {
  save(setAnswer(state, today(), ride));
  $('prompt-saved').hidden = false;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(showMain, 1200);
}

// Filled in by the notifications step. Never throws.
async function notify() {}

$('setup-form').addEventListener('submit', e => {
  e.preventDefault();
  const values = readNumbers('setup');
  if (!values) return;
  save({ ...state, ...values });
  start();
});

$('prompt-yes').addEventListener('click', () => answer(true));
$('prompt-no').addEventListener('click', () => answer(false));

$('scope-month').addEventListener('click', () => { scope = 'month'; renderMain(); });
$('scope-year').addEventListener('click', () => { scope = 'year'; renderMain(); });
$('month-prev').addEventListener('click', () => moveMonth(-1));
$('month-next').addEventListener('click', () => moveMonth(1));

$('calendar').addEventListener('click', e => {
  const b = e.target.closest('button.day');
  if (!b || b.disabled) return;
  save(setAnswer(state, b.dataset.key, state.answers[b.dataset.key] !== true));
  renderMain();
});

$('open-settings').addEventListener('click', () => {
  $('settings-km').value = formatNumber(state.kmPerRide);
  $('settings-rate').value = formatNumber(state.ratePerKm);
  for (const f of ['km', 'rate']) {
    $(`settings-${f}`).removeAttribute('aria-invalid');
    $(`settings-${f}-error`).hidden = true;
  }
  show('settings');
});
$('settings-cancel').addEventListener('click', showMain);
$('settings-form').addEventListener('submit', e => {
  e.preventDefault();
  const values = readNumbers('settings');
  if (!values) return;
  save({ ...state, ...values });
  showMain();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const t = fromKey(today());
  shown = { year: t.getFullYear(), month0: t.getMonth() };
  start();
});

start();

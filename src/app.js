// Pedal Pay's screens. The only module that touches the page, storage and notifications.

import { toKey, fromKey, monthDays } from './dates.js';
import { loadState, saveState, setAnswer, clearAnswer, isSetUp, parseDecimal } from './store.js';
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
let lastDay = null; // the day the screens were last chosen for

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

// Keeps the state in the window even when the browser refuses to store it,
// and tells the user that it will not be kept.
function save(next) {
  state = next;
  $('storage-warning').hidden = saveState(storage, state);
}

// Picks the screen for the current state and day.
function start() {
  clearTimeout(savedTimer);
  lastDay = today();
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

// Sends the morning prompt as a notification too, in case the window opens
// behind others. Does nothing unless notifications were allowed. Never throws.
async function notify() {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.ready;
    if (!reg) return;
    await reg.showNotification('Did you bike to work today?', {
      tag: 'morning-prompt',
      icon: './icons/icon-192.png',
      actions: [{ action: 'yes', title: 'Yes' }, { action: 'no', title: 'No' }],
    });
  } catch { /* the window prompt still works */ }
}

// Asked once, from the Start button, so the browser accepts the request.
function askNotificationPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  } catch { /* not supported */ }
}

$('setup-form').addEventListener('submit', e => {
  e.preventDefault();
  const values = readNumbers('setup');
  if (!values) return;
  save({ ...state, ...values });
  askNotificationPermission();
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
  const key = b.dataset.key;
  // Unmarking a past day makes it a missed day again, so fixing a slip never
  // breaks the streak; unmarking today is a real "No".
  if (state.answers[key] !== true) save(setAnswer(state, key, true));
  else if (key === today()) save(setAnswer(state, key, false));
  else save(clearAnswer(state, key));
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

// The app is rarely closed, so a new day is noticed when the window comes
// back, gets focus, or passes midnight. Same day: leave the user where they are.
function checkDay() {
  const t = today();
  if (t === lastDay) return;
  const d = fromKey(t);
  shown = { year: d.getFullYear(), month0: d.getMonth() };
  scope = 'month';
  if (!$('settings').hidden && !needsPrompt(state, t)) { lastDay = t; return; }
  start();
}

function checkAtMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  setTimeout(() => { checkDay(); checkAtMidnight(); }, next - now);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkDay();
});
window.addEventListener('focus', checkDay);
checkAtMidnight();

// The notification's Yes and No buttons answer through the service worker.
navigator.serviceWorker?.addEventListener('message', e => {
  if (e.data?.type === 'answer' && typeof e.data.ride === 'boolean' && needsPrompt(state, today())) {
    answer(e.data.ride);
  }
});
navigator.serviceWorker?.register('./sw.js').catch(() => {});

start();

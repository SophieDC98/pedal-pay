// Pedal Pay's screens. The only module that touches the page, storage and notifications.

import { toKey, fromKey, monthDays } from './dates.js';
import { loadState, saveState, setAnswer, clearAnswer, isSetUp, parseDecimal } from './store.js';
import { totals, streak, promptDue, needsPrompt, formatEuros } from './stats.js';
import { bookmarkUrl } from './bookmark.js';

const $ = id => document.getElementById(id);
// Binds a handler, skipping an element that an older cached page lacks, so a
// half-updated app still starts instead of showing nothing.
function on(id, type, fn) {
  const el = $(id);
  if (el) el.addEventListener(type, fn);
}
const storage = (() => { try { return window.localStorage; } catch { return null; } })();
const views = ['setup', 'main', 'settings'];
const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const dayName = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const SAVED_MS = 900;

let state = loadState(storage);
let scope = 'month';
let shown = null; // { year, month0 } of the calendar
let lastDay = null; // the day the screens were last set up for
let savedTimer = null;

// The browser tests pin the date and time with 'pedal-pay-today' and 'pedal-pay-now'.
function pinned(key) {
  try { return storage?.getItem(key) || null; } catch { return null; }
}

function today() {
  return pinned('pedal-pay-today') || toKey(new Date());
}

function minutesNow() {
  const p = pinned('pedal-pay-now');
  if (p) return Number(p.slice(0, 2)) * 60 + Number(p.slice(3, 5));
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

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

function resetToToday() {
  const t = today();
  const d = fromKey(t);
  lastDay = t;
  shown = { year: d.getFullYear(), month0: d.getMonth() };
  scope = 'month';
}

function showMain() {
  if (!shown) resetToToday();
  renderMain();
  show('main');
}

// Runs at start, on focus, when the window comes back and every minute:
// moves to a new day and shows the morning prompt once it is due.
// On the same day it leaves the user where they are.
function refresh() {
  if (!isSetUp(state)) return;
  const t = today();
  const newDay = t !== lastDay;
  if (newDay) resetToToday();
  const inSettings = !$('settings').hidden;
  if (!inSettings && (newDay || !$('main').hidden)) showMain();
  if (!inSettings && $('prompt').hidden && promptDue(state, t, minutesNow())) showPrompt();
}

function showPrompt() {
  clearTimeout(savedTimer);
  $('prompt-date').textContent = dayName.format(fromKey(today()));
  $('prompt-ask').hidden = false;
  $('prompt-saved').hidden = true;
  $('prompt').classList.remove('leaving');
  $('prompt').hidden = false;
  notify();
}

function answer(ride) {
  save(setAnswer(state, today(), ride));
  renderMain();
  closeNotification();
  $('prompt-ask').hidden = true;
  $('prompt-saved').hidden = false;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => {
    $('prompt').classList.add('leaving');
    savedTimer = setTimeout(() => { $('prompt').hidden = true; }, 350);
  }, SAVED_MS);
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

function readReminder() {
  const input = $('settings-reminder');
  const ok = /^\d{2}:\d{2}$/.test(input.value);
  input.setAttribute('aria-invalid', String(!ok));
  $('settings-reminder-error').hidden = ok;
  $('settings-reminder-error').textContent = ok ? '' : 'Pick a time, like 09:00';
  return ok ? input.value : null;
}

const formatNumber = n => String(n).replace('.', ',');

// Sends the morning prompt as a notification too, in case the window is
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
  } catch { /* the overlay still works */ }
}

async function closeNotification() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    for (const n of (await reg?.getNotifications({ tag: 'morning-prompt' })) ?? []) n.close();
  } catch { /* nothing to close */ }
}

// The fill bookmark is built from the app's own files, for this app's address.
async function buildFillBookmark() {
  const link = $('fill-bookmark-link');
  if (link.href.startsWith('javascript:')) return;
  try {
    const files = ['./src/dates.js', './src/fill-logic.js', './fill/panel.js'];
    const sources = await Promise.all(files.map(f => fetch(f).then(r => {
      if (!r.ok) throw new Error(f);
      return r.text();
    })));
    link.href = bookmarkUrl(sources, new URL('./', location.href).href);
  } catch {
    link.removeAttribute('href');
    link.textContent = 'The fill bookmark could not be built offline. Try again when online.';
  }
}
on('fill-bookmark-link', 'click', e => e.preventDefault());

// Asked once, from the Start button, so the browser accepts the request.
function askNotificationPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  } catch { /* not supported */ }
}

on('setup-form', 'submit', e => {
  e.preventDefault();
  const values = readNumbers('setup');
  if (!values) return;
  save({ ...state, ...values });
  askNotificationPermission();
  showMain();
  refresh();
});

on('prompt-yes', 'click', () => answer(true));
on('prompt-no', 'click', () => answer(false));

on('scope-month', 'click', () => { scope = 'month'; renderMain(); });
on('scope-year', 'click', () => { scope = 'year'; renderMain(); });
on('month-prev', 'click', () => moveMonth(-1));
on('month-next', 'click', () => moveMonth(1));

on('calendar', 'click', e => {
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

on('open-settings', 'click', () => {
  $('settings-km').value = formatNumber(state.kmPerRide);
  $('settings-rate').value = formatNumber(state.ratePerKm);
  $('settings-reminder').value = state.reminderTime;
  for (const f of ['km', 'rate', 'reminder']) {
    $(`settings-${f}`).removeAttribute('aria-invalid');
    $(`settings-${f}-error`).hidden = true;
  }
  show('settings');
  buildFillBookmark();
});
// Settings save each valid field as soon as it changes; a wrong value shows
// its message and the last good value stays.
function saveSettingsField(field) {
  if (field === 'reminder') {
    const reminderTime = readReminder();
    if (reminderTime) save({ ...state, reminderTime });
    return;
  }
  const name = field === 'km' ? 'kmPerRide' : 'ratePerKm';
  const input = $(`settings-${field}`);
  const error = $(`settings-${field}-error`);
  const value = parseDecimal(input.value);
  input.setAttribute('aria-invalid', String(value === null));
  error.hidden = value !== null;
  error.textContent = value === null ? 'Enter a number above 0, like 18 or 0,36' : '';
  if (value !== null) save({ ...state, [name]: value });
}
for (const field of ['km', 'rate', 'reminder']) {
  on(`settings-${field}`, 'input', () => saveSettingsField(field));
}
on('settings-form', 'submit', e => e.preventDefault());
on('settings-close', 'click', () => { showMain(); refresh(); });

// The notification's Yes and No buttons answer through the service worker.
navigator.serviceWorker?.addEventListener('message', e => {
  if (e.data?.type === 'answer' && typeof e.data.ride === 'boolean' && needsPrompt(state, today())) {
    if ($('prompt').hidden) showPrompt();
    answer(e.data.ride);
  }
});
navigator.serviceWorker?.register('./sw.js').catch(() => {});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refresh();
});
window.addEventListener('focus', refresh);
setInterval(refresh, 60 * 1000);

if (isSetUp(state)) { showMain(); refresh(); } else show('setup');

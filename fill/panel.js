// The fill bookmark. Runs inside ERPx, bundled with src/dates.js and
// src/fill-logic.js; PEDAL_PAY_URL is set by the bookmark. It makes one month
// in ERPx match the app and shows its progress in a small popup.
// The ERPx automation is the colleague's script, reused with their consent.

const PANEL_ID = 'pedal-pay-panel';
const STYLE_ID = 'pedal-pay-style';
const MONTH_NAME = new Intl.DateTimeFormat('en-GB', { month: 'long' });
const LOGO = '<svg viewBox="0 0 64 64" width="24" height="24" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#D4471F"/><g transform="translate(0 -7)"><g fill="none" stroke="#FFC93C" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="40" r="9"/><path d="M18 40 27 27h13l5 13M27 27l4 13H18M31 40l9-13"/></g><circle cx="46" cy="40" r="10" fill="#FFC93C"/></g></svg>';

// The logo's bike, riding to the right; it takes the text colour.
const RIDER = '<svg viewBox="8 18 50 34" width="38" height="26" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="40" r="9"/><path d="M18 40 27 27h13l5 13M27 27l4 13H18M31 40l9-13M24 22h6M40 27l-2-6h5"/></g><circle cx="46" cy="40" r="10" fill="#FFC93C" stroke="currentColor" stroke-width="3"/></svg>';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/////////////////////////////////////////////////////////////
// ERPx (from the colleague's script)
/////////////////////////////////////////////////////////////

const ERPx = {
  addExpenseLine() {
    document.querySelector('[data-u4id="addExpenseLine"]').click();
  },
  selectExpenseType(code) {
    const editor = Ext.ComponentQuery.query('combobox').find(x => x.name === 'expenseType');
    editor.select(editor.getStore().findRecord('value', code));
  },
  setDate(date) {
    Ext.ComponentQuery.query('datefield').find(x => x.name === 'expenseDate').setValue(date);
  },
  setQuantity(km) {
    const editor = Ext.ComponentQuery.query('numberfield').find(x => x.name === 'quantity');
    editor.setValue(km);
    editor.triggerBlur?.();
  },
  commit() {
    Ext.ComponentQuery.query('grid')[0].editingPlugin?.completeEdit();
  },
  // Throws when the expense grid is not there; skips a line it cannot read.
  existingDates() {
    const grid = Ext.ComponentQuery.query('grid')[0];
    if (!grid) throw new Error('no expense grid');
    const dates = new Set();
    grid.getStore().each(record => {
      const raw = record.get('expenseDate');
      if (!raw || !isBikeLine(record.get('expenseType'))) return;
      const date = raw instanceof Date ? raw : new Date(raw);
      if (!Number.isNaN(date.getTime())) dates.add(toKey(date));
    });
    return dates;
  },
  setTravelPurpose(text) {
    const field = Ext.ComponentQuery.query('textfield').find(x => x.u4Id === 'travelPurpose');
    field?.setValue(text);
  },
};

// A line counts as a bike allowance line when its type says so. A line with no
// readable type counts too, so an unknown ERPx field never leads to duplicates.
function isBikeLine(type) {
  if (type === undefined || type === null || type === '') return true;
  return type === 'FIETSVG' || /fiets/i.test(String(type));
}

// Removes the bike allowance line of one day: select that row, press
// "Kosten verwijderen" (u4Id deleteExpenseLine) and confirm. Never use the
// button with u4Id "delete": that one deletes the whole expense claim.
async function removeBikeLine(key) {
  const grid = Ext.ComponentQuery.query('grid')[0];
  const store = grid.getStore();
  let target = null;
  store.each(record => {
    const raw = record.get('expenseDate');
    const date = raw instanceof Date ? raw : new Date(raw);
    if (!target && !Number.isNaN(date.getTime()) && toKey(date) === key && isBikeLine(record.get('expenseType'))) target = record;
  });
  if (!target) return; // already gone
  const selection = grid.getSelectionModel();
  selection.select(target, false);
  await sleep(300);
  const selected = selection.getSelection();
  if (selected.length !== 1 || selected[0] !== target) throw new Error('could not select that line');
  document.querySelector('[data-u4id="deleteExpenseLine"]').click();
  await sleep(400);
  const confirm = Ext.ComponentQuery.query('button').find(b => (b.itemId === 'yes' || b.itemId === 'ok') && b.isVisible?.());
  if (confirm) {
    confirm.el?.dom?.click();
    await sleep(400);
  }
  let stillThere = false;
  store.each(record => { if (record === target) stillThere = true; });
  if (stillThere) throw new Error('ERPx did not remove the line');
}

// Waits until check() holds, looking every 40 ms, so ERPx sets the pace
// instead of fixed pauses. Throws when ERPx takes too long.
async function waitUntil(check, what, timeoutMs = 10000) {
  const start = Date.now();
  for (;;) {
    let ok = false;
    try { ok = Boolean(check()); } catch { ok = false; }
    if (ok) return;
    if (Date.now() - start > timeoutMs) throw new Error(`ERPx did not ${what} in time`);
    await sleep(40);
  }
}

const editorField = (xtype, name) => Ext.ComponentQuery.query(xtype).find(x => x.name === name);
const isShown = c => Boolean(c) && (c.isVisible ? c.isVisible() : true);
function sameDay(value, key) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime()) && toKey(date) === key;
}
function hasBikeLine(key) {
  let found = false;
  Ext.ComponentQuery.query('grid')[0].getStore().each(r => {
    if (sameDay(r.get('expenseDate'), key) && isBikeLine(r.get('expenseType'))) found = true;
  });
  return found;
}

// Sets a value and makes sure it stays: ERPx fills in defaults a moment after
// choosing the category (the date becomes today), so a value that gets
// overwritten is set again. It must hold for holdMs before going on.
async function setAndHold(set, holds, what, holdMs, timeoutMs = 10000) {
  const start = Date.now();
  let since = null;
  set();
  for (;;) {
    let ok = false;
    try { ok = Boolean(holds()); } catch { ok = false; }
    if (ok) {
      if (since === null) since = Date.now();
      if (Date.now() - since >= holdMs) return;
    } else {
      since = null;
      set();
    }
    if (Date.now() - start > timeoutMs) throw new Error(`ERPx did not keep the ${what}`);
    await sleep(40);
  }
}

// Adds one bike allowance line, waiting for ERPx after every step, then
// checks the line was saved with this date.
async function createBikeExpense(key, km) {
  const grid = Ext.ComponentQuery.query('grid')[0];
  ERPx.addExpenseLine();
  await waitUntil(() => isShown(editorField('combobox', 'expenseType')) && grid.editingPlugin?.editing !== false, 'open a new line');
  await setAndHold(
    () => ERPx.selectExpenseType('FIETSVG'),
    () => { const v = editorField('combobox', 'expenseType').getValue?.(); return v === undefined || v === 'FIETSVG'; },
    'category', 400); // long enough for ERPx's defaults to arrive
  await setAndHold(
    () => ERPx.setDate(fromKey(key)),
    () => { const f = editorField('datefield', 'expenseDate'); return !f.getValue || sameDay(f.getValue(), key); },
    'date', 150);
  await setAndHold(
    () => ERPx.setQuantity(km),
    () => { const f = editorField('numberfield', 'quantity'); return !f.getValue || Number(f.getValue()) === Number(km); },
    'km', 150);
  // The date once more: a late default must not slip through while the km were set.
  await setAndHold(
    () => ERPx.setDate(fromKey(key)),
    () => { const f = editorField('datefield', 'expenseDate'); return !f.getValue || sameDay(f.getValue(), key); },
    'date', 0);
  ERPx.commit();
  await waitUntil(() => !grid.editingPlugin?.editing && hasBikeLine(key), 'save the line');
}

/////////////////////////////////////////////////////////////
// Getting the rides from the app
/////////////////////////////////////////////////////////////

const KEY = /^\d{4}-\d{2}-\d{2}$/;

// Resolves with { rides, kmPerRide, today }, or { refused } saying why there
// are none: 'refused', 'not-set-up' or 'no-answer'.
function requestRides() {
  return new Promise(resolve => {
    const appOrigin = new URL(PEDAL_PAY_URL).origin;
    let settled = false;
    let win = null;
    const finish = value => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      clearInterval(poll);
      resolve(value);
    };
    function onMessage(e) {
      if (e.origin !== appOrigin || (win && e.source !== win)) return;
      const data = e.data || {};
      if (data.type === 'pedal-pay-ready') {
        e.source.postMessage({ type: 'pedal-pay-request' }, appOrigin);
      } else if (data.type === 'pedal-pay-rides' && Array.isArray(data.rides)) {
        finish({
          rides: data.rides.filter(k => KEY.test(k)),
          kmPerRide: Number(data.kmPerRide) > 0 ? Number(data.kmPerRide) : null,
          today: KEY.test(data.today) ? data.today : null,
        });
      } else if (data.type === 'pedal-pay-refused') {
        finish({ refused: data.reason === 'not-set-up' ? 'not-set-up' : 'refused' });
      }
    }
    window.addEventListener('message', onMessage);
    const timer = setTimeout(() => finish({ refused: 'no-answer' }), 120000);
    // A closed window without an answer means no rides.
    const poll = setInterval(() => {
      if (win && win.closed) setTimeout(() => finish({ refused: 'no-answer' }), 400);
    }, 500);
    try {
      win = window.open(`${PEDAL_PAY_URL}handoff.html`, 'pedal-pay-handoff', 'popup,width=460,height=360');
    } catch { win = null; }
    if (!win) finish({ refused: 'no-answer' });
  });
}

const WHY_NOT = {
  'refused': 'You chose not to share your Pedal Pay rides with this site. To fill ERPx, click the bookmark again and choose Allow.',
  'not-set-up': "Pedal Pay isn't set up in this browser yet. Open Pedal Pay, enter your km per ride, then click the bookmark again.",
  'no-answer': "Pedal Pay's small window could not open or did not answer. Allow pop-ups for this site, then click the bookmark again.",
};

/////////////////////////////////////////////////////////////
// The popup
/////////////////////////////////////////////////////////////

const STYLE = `
#${PANEL_ID}{--pp-bg:#FFF8F3;--pp-ink:#2B1A14;--pp-muted:#7A6359;--pp-line:#EFDCD2;--pp-brand:#D4471F;--pp-on-brand:#FFFFFF;--pp-track:#F3E7E0;
  position:fixed;top:min(80px,6vh);right:20px;z-index:999999;width:340px;max-width:calc(100vw - 40px);border-radius:16px;overflow:hidden;
  background:var(--pp-bg);color:var(--pp-ink);box-shadow:0 10px 30px rgba(0,0,0,.25);font:14px/1.4 "Fredoka","Segoe UI",system-ui,sans-serif;font-variant-numeric:tabular-nums}
@media (prefers-color-scheme: dark){#${PANEL_ID}{--pp-bg:#151B2E;--pp-ink:#EDF0F8;--pp-muted:#A3ABC6;--pp-line:#2D375A;--pp-brand:#FF8A4C;--pp-on-brand:#151B2E;--pp-track:#262F4D}}
#${PANEL_ID} *{box-sizing:border-box;font:inherit;color:inherit}
#${PANEL_ID} .pp-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#D4471F;color:#fff;font-weight:600;cursor:move}
@media (prefers-color-scheme: dark){#${PANEL_ID} .pp-bar{background:#1E2640;color:var(--pp-ink);border-bottom:1px solid var(--pp-line)}}
#${PANEL_ID} .pp-bar span{flex:1}
#${PANEL_ID} button{cursor:pointer;border:0;background:none;padding:0}
#${PANEL_ID} .pp-x{font-size:18px;line-height:1;padding:2px 6px}
#${PANEL_ID} .pp-body{padding:16px;display:flex;flex-direction:column;gap:12px}
#${PANEL_ID} .pp-message{margin:0;font-weight:600;font-size:15px;text-wrap:balance}
#${PANEL_ID} .pp-track{position:relative;height:30px;border-radius:999px;background:var(--pp-track);overflow:visible}
#${PANEL_ID} .pp-fill{position:absolute;inset:0 auto 0 0;width:0;border-radius:999px;background:var(--pp-brand);transition:width .3s ease}
#${PANEL_ID} .pp-bike{position:absolute;top:50%;left:0;transform:translate(-55%,-62%);line-height:0;color:var(--pp-ink);transition:left .3s ease}
#${PANEL_ID} .pp-row{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--pp-muted);font-size:13px}
#${PANEL_ID} .pp-stop{padding:6px 14px;border-radius:999px;border:2px solid var(--pp-brand);color:var(--pp-brand);font-weight:600}
#${PANEL_ID} .pp-stop:disabled{opacity:.5;cursor:default}
#${PANEL_ID} .pp-status{margin:0;font-weight:600;color:var(--pp-brand)}
#${PANEL_ID} button:focus-visible{outline:2px solid #FFC93C;outline-offset:2px}
@media (prefers-reduced-motion: reduce){#${PANEL_ID} .pp-fill,#${PANEL_ID} .pp-bike{transition:none}}
`;

function closePanel() {
  document.getElementById(PANEL_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
}

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeDraggable(panel, handle) {
  let dx = 0;
  let dy = 0;
  let dragging = false;
  const move = e => {
    if (!dragging || !panel.isConnected) return;
    panel.style.left = `${e.clientX - dx}px`;
    panel.style.top = `${e.clientY - dy}px`;
    panel.style.right = 'auto';
  };
  const up = () => {
    dragging = false;
    if (!panel.isConnected) {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    }
  };
  handle.addEventListener('mousedown', e => {
    if (e.target.closest('button')) return;
    dragging = true;
    dx = e.clientX - panel.offsetLeft;
    dy = e.clientY - panel.offsetTop;
  });
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

// Shows the popup with a first message; returns its body.
function openPanel() {
  const style = el('style', { id: STYLE_ID });
  style.textContent = STYLE;
  document.head.append(style);
  if (!document.querySelector('link[href*="family=Fredoka"]')) {
    // no-referrer: Google must not learn the ERPx address from this request.
    document.head.append(el('link', { rel: 'stylesheet', referrerpolicy: 'no-referrer', href: 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600&display=swap' }));
  }
  const panel = el('div', { id: PANEL_ID, role: 'dialog', 'aria-label': 'Pedal Pay' });
  const bar = el('div', { class: 'pp-bar' });
  bar.innerHTML = LOGO;
  bar.append(el('span', {}, 'Pedal Pay'));
  const close = el('button', { class: 'pp-x', type: 'button', 'aria-label': 'Close' }, '✕');
  close.addEventListener('click', closePanel);
  bar.append(close);
  const body = el('div', { class: 'pp-body' });
  body.append(el('p', { class: 'pp-message', id: 'pedal-pay-message', role: 'status' }, 'Getting your rides from Pedal Pay…'));
  panel.append(bar, body);
  document.body.append(panel);
  makeDraggable(panel, bar);
  return body;
}

function say(body, text) {
  body.replaceChildren(el('p', { class: 'pp-message', id: 'pedal-pay-message', role: 'status' }, text));
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

async function run(body, data) {
  if (data.refused) return say(body, WHY_NOT[data.refused]);
  if (!data.kmPerRide) return say(body, 'Set your km per ride in Pedal Pay first, then click the bookmark again.');

  const todayKey = window.__pedalPayToday || data.today || toKey(new Date());
  const { year, month0 } = defaultMonth(todayKey);
  const monthName = MONTH_NAME.format(new Date(year, month0, 1));
  let bikeDays;
  try {
    bikeDays = ERPx.existingDates();
  } catch {
    return say(body, 'Open your expense claim in ERPx first, then click the bookmark again.');
  }
  const plan = planMonth(data.rides, bikeDays, year, month0);
  const total = plan.add.length + plan.remove.length;
  if (total === 0) {
    say(body, `${monthName} is already up to date in ERPx.`);
    body.append(el('p', { class: 'pp-status', id: 'pedal-pay-status' }, `✅ ${monthName} is already up to date in ERPx.`));
    setTimeout(closePanel, 4000);
    return;
  }

  const parts = [];
  if (plan.add.length) parts.push(`Adding ${plural(plan.add.length, 'day')} of ${monthName} to ERPx`);
  if (plan.remove.length) parts.push(plan.add.length ? `removing ${plan.remove.length}` : `Removing ${plural(plan.remove.length, 'day')} of ${monthName} from ERPx`);
  say(body, parts.join(' · '));
  const track = el('div', { class: 'pp-track', id: 'pedal-pay-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': '0' });
  const fill = el('div', { class: 'pp-fill' });
  const bike = el('div', { class: 'pp-bike', 'aria-hidden': 'true' });
  bike.innerHTML = RIDER;
  track.append(fill, bike);
  const row = el('div', { class: 'pp-row' });
  const count = el('span', {}, `0 of ${total}`);
  const stop = el('button', { class: 'pp-stop', id: 'pedal-pay-stop', type: 'button' }, 'Stop');
  row.append(count, stop);
  const status = el('p', { class: 'pp-status', id: 'pedal-pay-status', role: 'status' });
  body.append(track, row, status);

  let stopping = false;
  stop.addEventListener('click', () => { stopping = true; stop.disabled = true; stop.textContent = 'Stopping…'; });
  let done = 0;
  const step = () => {
    done++;
    const pct = (done / total) * 100;
    fill.style.width = `${pct}%`;
    bike.style.left = `${pct}%`;
    track.setAttribute('aria-valuenow', String(done));
    count.textContent = `${done} of ${total}`;
  };
  let added = 0;
  let removed = 0;
  const tally = () => [added ? `${added} added` : '', removed ? `${removed} removed` : ''].filter(Boolean).join(', ') || 'nothing changed';
  const finish = text => { stop.remove(); status.textContent = text; };

  try { ERPx.setTravelPurpose(travelPurpose(year, month0)); } catch { /* optional field */ }
  const work = [...plan.remove.map(key => ['remove', key]), ...plan.add.map(key => ['add', key])];
  for (const [kind, key] of work) {
    if (stopping) return finish(`Stopped: ${tally()}. Click the bookmark again to do the rest.`);
    try {
      if (kind === 'remove') { await removeBikeLine(key); removed++; }
      else { await createBikeExpense(key, data.kmPerRide); added++; }
    } catch (err) {
      return finish(`Stopped at ${key}: ${err?.message || err}. ${tally()}. Check the claim, then click the bookmark again.`);
    }
    step();
  }
  finish(`✅ ${tally()}. Check and submit the claim in ERPx.`);
  setTimeout(closePanel, 5000);
}

if (document.getElementById(PANEL_ID)) {
  closePanel();
} else {
  const body = openPanel();
  requestRides().then(data => {
    if (document.getElementById(PANEL_ID)) run(body, data);
  });
}

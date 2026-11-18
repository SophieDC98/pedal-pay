// Pedal Pay's review panel. Runs inside ERPx from the fill bookmark, bundled
// with src/dates.js and src/fill-logic.js; PEDAL_PAY_URL is set by the bookmark.
// The ERPx automation is the colleague's script, reused with their consent.

const PANEL_ID = 'pedal-pay-panel';
const STYLE_ID = 'pedal-pay-style';
const MONTH_LABEL = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const LOGO = '<svg viewBox="0 0 64 64" width="24" height="24" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#D4471F"/><g transform="translate(0 -7)"><g fill="none" stroke="#FFC93C" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="40" r="9"/><path d="M18 40 27 27h13l5 13M27 27l4 13H18M31 40l9-13"/></g><circle cx="46" cy="40" r="10" fill="#FFC93C"/></g></svg>';

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

// Adds one bike allowance line, waiting for ERPx after every step, then
// checks the line was saved with this date.
async function createBikeExpense(key, km) {
  ERPx.addExpenseLine();
  await waitUntil(() => isShown(editorField('combobox', 'expenseType')), 'open a new line');
  ERPx.selectExpenseType('FIETSVG');
  await waitUntil(() => {
    const value = editorField('combobox', 'expenseType').getValue?.();
    return value === undefined || value === 'FIETSVG';
  }, 'take the category');
  ERPx.setDate(fromKey(key));
  await waitUntil(() => {
    const f = editorField('datefield', 'expenseDate');
    return !f.getValue || sameDay(f.getValue(), key);
  }, 'take the date');
  ERPx.setQuantity(km);
  await waitUntil(() => {
    const f = editorField('numberfield', 'quantity');
    return !f.getValue || Number(f.getValue()) === Number(km);
  }, 'take the km');
  await sleep(150); // a moment for ERPx to work out the amount for these km
  ERPx.commit();
  const grid = Ext.ComponentQuery.query('grid')[0];
  await waitUntil(() => !grid.editingPlugin?.editing && hasBikeLine(key), 'save the line');
}

/////////////////////////////////////////////////////////////
// Getting the rides from the app
/////////////////////////////////////////////////////////////

// Resolves with { rides, kmPerRide, today } or null when there are none to have.
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
      if (e.origin !== appOrigin) return;
      const data = e.data || {};
      if (data.type === 'pedal-pay-ready') {
        e.source.postMessage({ type: 'pedal-pay-request' }, appOrigin);
      } else if (data.type === 'pedal-pay-rides' && Array.isArray(data.rides)) {
        finish({
          rides: data.rides.filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)),
          kmPerRide: Number(data.kmPerRide) > 0 ? Number(data.kmPerRide) : null,
          today: /^\d{4}-\d{2}-\d{2}$/.test(data.today) ? data.today : null,
        });
      } else if (data.type === 'pedal-pay-refused') {
        finish(null);
      }
    }
    window.addEventListener('message', onMessage);
    const timer = setTimeout(() => finish(null), 120000);
    // A closed window without an answer counts as no rides.
    const poll = setInterval(() => {
      if (win && win.closed) setTimeout(() => finish(null), 400);
    }, 500);
    try {
      win = window.open(`${PEDAL_PAY_URL}handoff.html`, 'pedal-pay-handoff', 'popup,width=460,height=360');
    } catch { win = null; }
    if (!win) finish(null);
  });
}

// Opens the small window that saves the panel's changes into the app. It
// must open on the click itself, or the browser blocks it. Resolves the
// window once it says it is ready, or null.
function openUpdateWindow() {
  const appOrigin = new URL(PEDAL_PAY_URL).origin;
  let win = null;
  try {
    win = window.open(`${PEDAL_PAY_URL}handoff.html?update`, 'pedal-pay-update', 'popup,width=420,height=260');
  } catch { win = null; }
  if (!win) return Promise.resolve(null);
  return new Promise(resolve => {
    const done = value => { window.removeEventListener('message', onMessage); clearTimeout(timer); resolve(value); };
    function onMessage(e) {
      if (e.origin === appOrigin && e.source === win && e.data?.type === 'pedal-pay-ready') done(win);
    }
    window.addEventListener('message', onMessage);
    const timer = setTimeout(() => done(null), 15000);
  });
}

// Sends the changes to the update window and waits for it to confirm.
function sendUpdate(win, set, clear) {
  const appOrigin = new URL(PEDAL_PAY_URL).origin;
  return new Promise(resolve => {
    const done = value => { window.removeEventListener('message', onMessage); clearTimeout(timer); resolve(value); };
    function onMessage(e) {
      if (e.origin === appOrigin && e.source === win && e.data?.type === 'pedal-pay-updated') done(Boolean(e.data.saved));
    }
    window.addEventListener('message', onMessage);
    const timer = setTimeout(() => done(false), 5000);
    try { win.postMessage({ type: 'pedal-pay-update', set, clear }, appOrigin); } catch { done(false); }
  });
}

/////////////////////////////////////////////////////////////
// The panel
/////////////////////////////////////////////////////////////

const STYLE = `
#${PANEL_ID}{--pp-bg:#FFF8F3;--pp-surface:#FFFFFF;--pp-ink:#2B1A14;--pp-muted:#7A6359;--pp-line:#EFDCD2;--pp-brand:#D4471F;--pp-on-brand:#FFFFFF;--pp-sun:#FFC93C;--pp-sun-soft:#FFECB0;--pp-sun-ink:#7A5200;--pp-day:#F3E7E0;--pp-done:#E6DDD7;
  position:fixed;top:min(80px,6vh);right:20px;z-index:999999;width:340px;max-width:calc(100vw - 40px);max-height:calc(100vh - min(80px,6vh) - 16px);display:flex;flex-direction:column;border-radius:16px;overflow:hidden;
  background:var(--pp-bg);color:var(--pp-ink);box-shadow:0 10px 30px rgba(0,0,0,.25);font:14px/1.4 "Fredoka","Segoe UI",system-ui,sans-serif;font-variant-numeric:tabular-nums}
@media (prefers-color-scheme: dark){#${PANEL_ID}{--pp-bg:#151B2E;--pp-surface:#1E2640;--pp-ink:#EDF0F8;--pp-muted:#A3ABC6;--pp-line:#2D375A;--pp-brand:#FF8A4C;--pp-on-brand:#151B2E;--pp-sun-soft:#3D3A2C;--pp-sun-ink:#FFD76A;--pp-day:#262F4D;--pp-done:#2A3352}}
#${PANEL_ID} *{box-sizing:border-box;font:inherit;color:inherit}
#${PANEL_ID} .pp-bar{flex:none;display:flex;align-items:center;gap:8px;padding:10px 14px;background:#D4471F;color:#fff;font-weight:600;cursor:move}
@media (prefers-color-scheme: dark){#${PANEL_ID} .pp-bar{background:var(--pp-surface);color:var(--pp-ink);border-bottom:1px solid var(--pp-line)}}
#${PANEL_ID} .pp-bar span{flex:1}
#${PANEL_ID} button{cursor:pointer;border:0;background:none;padding:0}
#${PANEL_ID} .pp-x{font-size:18px;line-height:1;padding:2px 6px}
#${PANEL_ID} .pp-body{padding:12px 14px 0;display:flex;flex-direction:column;gap:10px;overflow-y:auto;min-height:0}
#${PANEL_ID} .pp-foot{position:sticky;bottom:0;margin:0 -14px;padding:8px 14px 12px;background:var(--pp-bg);display:flex;flex-direction:column;gap:6px}
#${PANEL_ID} .pp-note{margin:0;padding:8px 10px;border-radius:10px;background:var(--pp-sun-soft);color:var(--pp-sun-ink);font-size:13px}
#${PANEL_ID} .pp-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
#${PANEL_ID} .pp-month{font-weight:600;font-size:16px}
#${PANEL_ID} .pp-nav{font-size:20px;padding:0 8px}
#${PANEL_ID} label{font-weight:500}
#${PANEL_ID} input{width:80px;padding:6px 8px;border:1px solid var(--pp-line);border-radius:8px;background:var(--pp-surface);text-align:right}
#${PANEL_ID} .pp-cal{display:grid;grid-template-columns:repeat(7,minmax(0,34px));justify-content:center;gap:4px 8px}
#${PANEL_ID} .pp-wd{font-size:11px;text-align:center;color:var(--pp-muted)}
#${PANEL_ID} .pp-day{aspect-ratio:1/1;border-radius:50%;background:var(--pp-day);font-size:13px;display:flex;align-items:center;justify-content:center}
#${PANEL_ID} .pp-day.off{background:transparent;color:var(--pp-muted)}
#${PANEL_ID} .pp-day.holiday{background:var(--pp-sun-soft);color:var(--pp-sun-ink)}
#${PANEL_ID} .pp-day.tick{background:var(--pp-brand);color:var(--pp-on-brand);font-weight:600}
#${PANEL_ID} .pp-day.done{position:relative;background:var(--pp-done);color:var(--pp-muted)}
#${PANEL_ID} .pp-day.done.remove{background:transparent;box-shadow:inset 0 0 0 2px var(--pp-brand);color:var(--pp-brand);text-decoration:line-through}
#${PANEL_ID} .pp-day.done.remove::after{content:'✕'}
#${PANEL_ID} .pp-day.done::after{content:'✓';position:absolute;top:-3px;right:-3px;width:16px;height:16px;border-radius:50%;background:var(--pp-brand);color:var(--pp-on-brand);font-size:10px;line-height:16px;text-align:center;font-weight:600}
#${PANEL_ID} .pp-day:focus-visible,#${PANEL_ID} .pp-go:focus-visible{outline:2px solid var(--pp-sun);outline-offset:2px}
#${PANEL_ID} .pp-sum{margin:0;color:var(--pp-muted);text-align:center;font-size:13px}
#${PANEL_ID} .pp-go{width:100%;padding:11px;border-radius:999px;background:var(--pp-brand);color:var(--pp-on-brand);font-weight:600;font-size:15px}
#${PANEL_ID} .pp-go:disabled{opacity:.5;cursor:default}
#${PANEL_ID} .pp-status{margin:0;text-align:center;font-weight:600;color:var(--pp-brand)}
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
  handle.addEventListener('mousedown', e => {
    if (e.target.closest('button')) return;
    dragging = true;
    dx = e.clientX - panel.offsetLeft;
    dy = e.clientY - panel.offsetTop;
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    panel.style.left = `${e.clientX - dx}px`;
    panel.style.top = `${e.clientY - dy}px`;
    panel.style.right = 'auto';
  });
  document.addEventListener('mouseup', () => { dragging = false; });
}

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
  body.append(el('p', { class: 'pp-sum' }, 'Getting your rides from Pedal Pay…'));
  panel.append(bar, body);
  document.body.append(panel);
  makeDraggable(panel, bar);
  return body;
}

function startPanel(body, data) {
  const todayKey = window.__pedalPayToday || data?.today || toKey(new Date());
  const rides = data ? data.rides : null;
  let km = data?.kmPerRide || null; // never guess someone's distance
  let month = defaultMonth(todayKey);
  let existing = new Set();
  let canAdd = true;
  let note = data ? '' : 'No rides from Pedal Pay: all workdays are ticked. Untick the days you did not bike.';
  try {
    existing = ERPx.existingDates();
  } catch {
    // Without knowing what is already there, adding could create duplicates.
    canAdd = false;
    note = 'Pedal Pay could not read the lines already in ERPx. Open the expense claim first, then click the bookmark again.';
  }
  let ticks = initialTicks(rides, month.year, month.month0, existing);
  const removes = new Set(); // days already in ERPx whose bike line should go
  let busy = false;

  const setPurpose = () => { try { ERPx.setTravelPurpose(travelPurpose(month.year, month.month0)); } catch { /* optional field */ } };
  setPurpose();

  function render() {
    body.replaceChildren();
    const noteEl = el('p', { id: 'pedal-pay-note', class: 'pp-note' }, note);
    noteEl.hidden = !note;
    body.append(noteEl);

    const nav = el('div', { class: 'pp-row' });
    const prev = el('button', { class: 'pp-nav', type: 'button', 'aria-label': 'Previous month' }, '‹');
    const next = el('button', { class: 'pp-nav', type: 'button', 'aria-label': 'Next month' }, '›');
    const label = el('span', { class: 'pp-month', id: 'pedal-pay-month' }, MONTH_LABEL.format(new Date(month.year, month.month0, 1)));
    const move = delta => {
      if (busy) return;
      const d = new Date(month.year, month.month0 + delta, 1);
      month = { year: d.getFullYear(), month0: d.getMonth() };
      ticks = initialTicks(rides, month.year, month.month0, existing);
      removes.clear();
      setPurpose();
      render();
    };
    prev.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    nav.append(prev, label, next);
    body.append(nav);

    const kmRow = el('div', { class: 'pp-row' });
    kmRow.append(el('label', { for: 'pedal-pay-km' }, 'Km per ride'));
    const kmInput = el('input', { id: 'pedal-pay-km', inputmode: 'decimal', placeholder: 'km', value: km ? String(km).replace('.', ',') : '' });
    kmInput.addEventListener('input', () => {
      const n = Number(kmInput.value.trim().replace(',', '.'));
      km = n > 0 ? n : null;
      summary();
    });
    kmRow.append(kmInput);
    body.append(kmRow);

    const cal = el('div', { class: 'pp-cal' });
    for (const w of WEEKDAY_LABELS) cal.append(el('div', { class: 'pp-wd' }, w));
    const days = monthDays(month.year, month.month0);
    for (let i = 0; i < days[0].weekday0Mon; i++) cal.append(el('div'));
    for (const d of days) {
      const b = el('button', { type: 'button', class: 'pp-day', 'data-key': d.key });
      if (existing.has(d.key)) {
        // Already in ERPx: a click marks its bike line for removal, a second click keeps it.
        b.classList.add('done');
        b.textContent = String(d.day);
        const mark = () => {
          const removing = removes.has(d.key);
          b.classList.toggle('remove', removing);
          b.setAttribute('aria-pressed', String(removing));
          b.title = removing ? `${d.day}: will be removed from ERPx` : `${d.day}: already in ERPx, click to remove`;
          b.setAttribute('aria-label', `${d.day}, already in ERPx${removing ? ', will be removed' : ''}`);
        };
        mark();
        b.addEventListener('click', () => {
          if (busy || !canAdd) return;
          if (removes.has(d.key)) removes.delete(d.key); else removes.add(d.key);
          mark();
          summary();
        });
      } else {
        b.textContent = String(d.day);
        if (d.holiday) b.classList.add('holiday');
        else if (!d.workday) b.classList.add('off');
        if (ticks.has(d.key)) b.classList.add('tick');
        b.setAttribute('aria-pressed', String(ticks.has(d.key)));
        b.addEventListener('click', () => {
          if (busy || existing.has(d.key)) return;
          if (ticks.has(d.key)) ticks.delete(d.key); else ticks.add(d.key);
          b.classList.toggle('tick', ticks.has(d.key));
          b.setAttribute('aria-pressed', String(ticks.has(d.key)));
          summary();
        });
      }
      cal.append(b);
    }
    body.append(cal);

    // The button stays in view at the bottom, even when the calendar scrolls.
    const foot = el('div', { class: 'pp-foot' });
    foot.append(el('p', { class: 'pp-sum', id: 'pedal-pay-sum' }));
    const go = el('button', { class: 'pp-go', id: 'pedal-pay-generate', type: 'button' });
    go.addEventListener('click', generate);
    foot.append(go);
    foot.append(el('p', { class: 'pp-status', id: 'pedal-pay-status', role: 'status' }));
    body.append(foot);
    summary();
  }

  function summary() {
    const n = ticks.size;
    const r = removes.size;
    const days = k => `${k} ${k === 1 ? 'day' : 'days'}`;
    const sum = document.getElementById('pedal-pay-sum');
    const go = document.getElementById('pedal-pay-generate');
    if (!sum || !go) return;
    sum.textContent = days(n) + (km ? ` · ${Math.round(n * km * 100) / 100} km` : '') + (r ? ` · ${r} to remove` : '');
    if (!canAdd) go.textContent = 'Open the expense claim first';
    else if (n && !km) go.textContent = 'Enter your km per ride';
    else if (n && r) go.textContent = `Add ${n} · remove ${r}`;
    else if (r) go.textContent = `Remove ${days(r)} from ERPx`;
    else go.textContent = n ? `Add ${days(n)} to ERPx` : 'No days ticked';
    go.disabled = busy || (n === 0 && r === 0) || !canAdd || (n > 0 && !km);
    const kmInput = document.getElementById('pedal-pay-km');
    if (kmInput) kmInput.disabled = busy;
  }

  // Redraws the panel, then shows a message under the button.
  function renderWith(message) {
    render();
    document.getElementById('pedal-pay-status').textContent = message;
  }

  async function generate() {
    if (busy || (ticks.size === 0 && removes.size === 0) || !canAdd || (ticks.size > 0 && !km)) return;
    busy = true;
    // Only when the rides came from the app does the app hear back.
    const updateReady = rides !== null ? openUpdateWindow() : null;
    const monthPrefix = `${month.year}-${String(month.month0 + 1).padStart(2, '0')}-`;
    const addedKeys = [];
    const removedKeys = [];
    // Tells the app what changed; after a stop, only what really happened.
    const syncApp = async complete => {
      if (!updateReady) return '';
      const win = await updateReady;
      if (!win) return ' Pedal Pay could not be updated: open the app to fix those days.';
      const clear = [...removedKeys];
      if (complete) {
        for (const k of rides) if (k.startsWith(monthPrefix) && !existing.has(k)) clear.push(k);
      }
      const saved = await sendUpdate(win, addedKeys, clear);
      return saved ? ' Pedal Pay updated.' : ' Pedal Pay could not be updated: open the app to fix those days.';
    };
    summary();
    const status = document.getElementById('pedal-pay-status');
    const keys = [...ticks].sort();
    setPurpose();
    const lines = k => `${k} ${k === 1 ? 'line' : 'lines'}`;
    let removed = 0;
    const toRemove = [...removes].sort();
    for (const key of toRemove) {
      status.textContent = `Removing ${removed + 1} of ${toRemove.length}…`;
      try {
        await removeBikeLine(key);
      } catch (err) {
        busy = false;
        const note = await syncApp(false);
        renderWith(`Stopped at ${key}: ${err?.message || err}. ${lines(removed)} removed. Check the claim, then try again.${note}`);
        return;
      }
      removedKeys.push(key);
      removed++;
      removes.delete(key);
      existing.delete(key);
    }
    let added = 0;
    for (const key of keys) {
      status.textContent = `Adding ${added + 1} of ${keys.length}…`;
      try {
        await createBikeExpense(key, km);
      } catch (err) {
        busy = false;
        const note = await syncApp(false);
        renderWith(`Stopped at ${key}: ${err?.message || err}. ${lines(added)} added${removed ? `, ${removed} removed` : ''}. Check the claim, then try again.${note}`);
        return;
      }
      addedKeys.push(key);
      added++;
      existing.add(key);
      ticks.delete(key);
    }
    const done = [added ? `${lines(added)} added` : '', removed ? `${removed} removed` : ''].filter(Boolean).join(', ');
    const note = await syncApp(true);
    renderWith(`✅ ${done}. Check and submit the claim in ERPx.${note}`);
    setTimeout(closePanel, 4000);
  }

  render();
}

if (document.getElementById(PANEL_ID)) {
  closePanel();
} else {
  const body = openPanel();
  requestRides().then(data => {
    if (document.getElementById(PANEL_ID)) startPanel(body, data);
  });
}

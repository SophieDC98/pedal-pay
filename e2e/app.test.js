import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));

let server, browser, base;

const freePort = () => new Promise(resolve => {
  const s = createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

before(async () => {
  const port = await freePort();
  base = `http://localhost:${port}/`;
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { await fetch(base); break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  // The 'chromium' channel (new headless) supports notifications; the default shell does not.
  browser = await chromium.launch({ channel: 'chromium' });
});

after(async () => {
  await browser?.close();
  server?.kill();
});

async function openApp(today, storage = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(([t, s]) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('pedal-pay-today', t);
      localStorage.setItem('pedal-pay-now', '09:30');
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    }
  }, [today, storage]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  return { page, context, errors };
}

const visible = (page, sel) => page.waitForSelector(`${sel}:not([hidden])`, { timeout: 5000 });

test('first run, prompt, main screen', async () => {
  const { page, context, errors } = await openApp('2026-11-17');
  await visible(page, '#setup');
  assert.equal(await page.locator('#setup-rate').count(), 0);
  await page.fill('#setup-km', '18');
  await page.click('#setup-save');
  await visible(page, '#prompt');
  await page.click('#prompt-yes');
  await visible(page, '#prompt-saved');
  await visible(page, '#main');
  assert.match(await page.textContent('#stat-km'), /18/);
  assert.match(await page.textContent('#stat-euros'), /€6\.48/);
  await page.click('#calendar [data-key="2026-11-16"]');
  assert.match(await page.textContent('#stat-km'), /36/);
  assert.match(await page.textContent('#stat-streak'), /2-day streak/);
  await page.click('#scope-year');
  assert.match(await page.textContent('#stat-km'), /36/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('invalid setup input is refused', async () => {
  const { page, context } = await openApp('2026-11-17');
  await visible(page, '#setup');
  await page.fill('#setup-km', 'abc');
  await page.click('#setup-save');
  assert.equal(await page.getAttribute('#setup-km', 'aria-invalid'), 'true');
  assert.equal(await page.isHidden('#setup'), false);
  await context.close();
});

test('waking up the next day prompts again', async () => {
  const state = JSON.stringify({ version: 1, kmPerRide: 18, ratePerKm: 0.36, answers: { '2026-11-17': true } });
  const { page, context } = await openApp('2026-11-17', { 'pedal-pay': state });
  await visible(page, '#main');
  await page.evaluate(() => {
    localStorage.setItem('pedal-pay-today', '2026-11-18');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await visible(page, '#prompt');
  await context.close();
});

test('a weekend does not prompt', async () => {
  const state = JSON.stringify({ version: 1, kmPerRide: 18, ratePerKm: 0.36, answers: {} });
  const { page, context } = await openApp('2026-11-21', { 'pedal-pay': state });
  await visible(page, '#main');
  await context.close();
});

test('bad stored data shows setup', async () => {
  const { page, context, errors } = await openApp('2026-11-17', { 'pedal-pay': '{oops' });
  await visible(page, '#setup');
  assert.deepEqual(errors, []);
  await context.close();
});

test('future days cannot be marked', async () => {
  const state = JSON.stringify({ version: 1, kmPerRide: 18, ratePerKm: 0.36, answers: { '2026-11-17': true } });
  const { page, context } = await openApp('2026-11-17', { 'pedal-pay': state });
  await visible(page, '#main');
  assert.equal(await page.isDisabled('#calendar [data-key="2026-11-18"]'), true);
  await context.close();
});

test('month navigation crosses the year boundary', async () => {
  const state = JSON.stringify({ version: 1, kmPerRide: 18, ratePerKm: 0.36, answers: { '2026-11-17': true } });
  const { page, context } = await openApp('2026-11-17', { 'pedal-pay': state });
  await visible(page, '#main');
  await page.click('#month-next');
  await page.click('#month-next');
  assert.equal(await page.textContent('#month-label'), 'January 2027');
  await context.close();
});

test('the app is installable: manifest, icons and a service worker', async () => {
  const manifest = await (await fetch(new URL('manifest.webmanifest', base))).json();
  assert.equal(manifest.name, 'Pedal Pay');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const res = await fetch(new URL(icon.src, base));
    assert.equal(res.status, 200, icon.src);
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  assert.equal(scope, base);
  await context.close();
});

test('with notifications allowed, the morning prompt also sends one', async () => {
  const state = JSON.stringify({ version: 1, kmPerRide: 18, ratePerKm: 0.36, answers: {} });
  const context = await browser.newContext();
  await context.grantPermissions(['notifications'], { origin: base.slice(0, -1) });
  await context.addInitScript(s => {
    localStorage.setItem('pedal-pay-today', '2026-11-18');
    localStorage.setItem('pedal-pay-now', '09:30');
    localStorage.setItem('pedal-pay', s);
  }, state);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.waitForSelector('#prompt:not([hidden])');
  const titles = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    for (let i = 0; i < 20; i++) {
      const list = await reg.getNotifications({ tag: 'morning-prompt' });
      if (list.length) return list.map(n => n.title);
      await new Promise(r => setTimeout(r, 100));
    }
    return [];
  });
  assert.deepEqual(titles, ['Did you bike to work today?']);
  assert.deepEqual(errors, []);
  await context.close();
});

const setUpState = answers => JSON.stringify({ version: 1, kmPerRide: 18, ratePerKm: 0.36, answers });
const refocus = page => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

test('refocusing does not pile up service worker listeners', async () => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(s => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('pedal-pay-today', '2026-11-17');
      localStorage.setItem('pedal-pay-now', '09:30');
      localStorage.setItem('pedal-pay', s);
    }
    window.__messageListeners = 0;
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, ...rest) {
      if (type === 'message' && typeof ServiceWorkerContainer !== 'undefined' && this instanceof ServiceWorkerContainer) window.__messageListeners++;
      return add.call(this, type, ...rest);
    };
  }, setUpState({ '2026-11-17': true }));
  const page = await context.newPage();
  await page.goto(base);
  await visible(page, '#main');
  for (let i = 0; i < 3; i++) await refocus(page);
  assert.equal(await page.evaluate(() => window.__messageListeners), 1);
  await context.close();
});

test('refocusing on the same day keeps Settings and the shown month', async () => {
  const { page, context } = await openApp('2026-11-17', { 'pedal-pay': setUpState({ '2026-11-17': true }) });
  await visible(page, '#main');
  await page.click('#month-prev');
  await refocus(page);
  assert.equal(await page.textContent('#month-label'), 'October 2026');
  await page.click('#open-settings');
  await page.fill('#settings-rate', '0,40');
  await refocus(page);
  assert.equal(await page.isHidden('#settings'), false);
  assert.equal(await page.inputValue('#settings-rate'), '0,40');
  await context.close();
});

test('a new day is noticed on window focus too', async () => {
  const { page, context } = await openApp('2026-11-17', { 'pedal-pay': setUpState({ '2026-11-17': true }) });
  await visible(page, '#main');
  await page.evaluate(() => {
    localStorage.setItem('pedal-pay-today', '2026-11-18');
    window.dispatchEvent(new Event('focus'));
  });
  await visible(page, '#prompt');
  await context.close();
});

test('when the browser refuses to save, the user is told and rides are kept in the window', async () => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(() => {
    localStorage.setItem('pedal-pay-today', '2026-11-17');
    localStorage.setItem('pedal-pay-now', '09:30');
    Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); };
  });
  const page = await context.newPage();
  await page.goto(base);
  await visible(page, '#setup');
  await page.fill('#setup-km', '18');
  await page.click('#setup-save');
  await visible(page, '#storage-warning');
  await visible(page, '#prompt');
  await page.click('#prompt-yes');
  await visible(page, '#main');
  await page.click('#calendar [data-key="2026-11-16"]');
  await refocus(page);
  assert.match(await page.textContent('#stat-km'), /36/);
  await context.close();
});

test('tapping a day on and off again leaves the streak as it was', async () => {
  // 17 ride, 16 unmarked workday: a 1-day streak
  const { page, context } = await openApp('2026-11-17', { 'pedal-pay': setUpState({ '2026-11-12': true, '2026-11-17': true }) });
  await visible(page, '#main');
  assert.match(await page.textContent('#stat-streak'), /1-day streak/);
  await page.click('#calendar [data-key="2026-11-16"]');
  await page.click('#calendar [data-key="2026-11-16"]');
  assert.match(await page.textContent('#stat-streak'), /1-day streak/);
  await context.close();
});

test('the prompt is a strip over the main screen', async () => {
  const { page, context } = await openApp('2026-11-18', { 'pedal-pay': setUpState({ '2026-11-17': true }) });
  await visible(page, '#prompt');
  assert.equal(await page.isHidden('#main'), false);
  assert.match(await page.textContent('#prompt'), /Biked to work today\?/);
  assert.match(await page.textContent('#prompt-date'), /Wednesday 18 November/);
  await page.click('#prompt-no');
  await visible(page, '#prompt-saved');
  await page.waitForSelector('#prompt', { state: 'hidden', timeout: 5000 });
  await context.close();
});

test('before the reminder time there is no prompt; once it passes there is', async () => {
  const { page, context } = await openApp('2026-11-18', { 'pedal-pay': setUpState({ '2026-11-17': true }), 'pedal-pay-now': '08:30' });
  await visible(page, '#main');
  assert.equal(await page.isHidden('#prompt'), true);
  await page.evaluate(() => {
    localStorage.setItem('pedal-pay-now', '09:00');
    window.dispatchEvent(new Event('focus'));
  });
  await visible(page, '#prompt');
  await context.close();
});

test('the reminder time is saved in Settings', async () => {
  const { page, context } = await openApp('2026-11-17', { 'pedal-pay': setUpState({ '2026-11-17': true }) });
  await visible(page, '#main');
  await page.click('#open-settings');
  assert.equal(await page.inputValue('#settings-reminder'), '09:00');
  await page.fill('#settings-reminder', '07:45');
  await page.click('#settings-close');
  await visible(page, '#main');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pedal-pay')).reminderTime);
  assert.equal(saved, '07:45');
  await context.close();
});

test('Settings offers the fill bookmark, built for this app address', async () => {
  const { page, context } = await openApp('2026-11-17', { 'pedal-pay': setUpState({ '2026-11-17': true }) });
  await visible(page, '#main');
  await page.click('#open-settings');
  await page.waitForFunction(() => document.getElementById('fill-bookmark-link')?.href.startsWith('javascript:'));
  const href = await page.getAttribute('#fill-bookmark-link', 'href');
  const code = decodeURIComponent(href.slice('javascript:'.length));
  assert.match(code, new RegExp(`const PEDAL_PAY_URL = "${base.replace(/[.]/g, '\\.')}";`));
  assert.match(code, /function defaultMonth/);
  assert.doesNotMatch(code, /^\s*(import|export)\s/m);
  await context.close();
});

test('Settings saves every change by itself and closes with the cross', async () => {
  const { page, context } = await openApp('2026-11-17', { 'pedal-pay': setUpState({ '2026-11-17': true }) });
  await visible(page, '#main');
  await page.click('#open-settings');
  // Compare a count, never a page handle: a failing check would try to print the whole browser connection.
  assert.equal(await page.locator('#settings-save').count(), 0);
  await page.fill('#settings-km', '20');
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('pedal-pay')));
  assert.equal((await stored()).kmPerRide, 20);
  await page.fill('#settings-rate', 'abc');
  await visible(page, '#settings-rate-error');
  assert.equal((await stored()).ratePerKm, 0.36);
  await page.click('#settings-close');
  await visible(page, '#main');
  assert.match(await page.textContent('#stat-km'), /20/);
  await context.close();
});

test('the whole month fits in a small app window without scrolling', async () => {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 420, height: 600 } });
  await context.addInitScript(s => {
    localStorage.setItem('pedal-pay-today', '2026-11-17');
    localStorage.setItem('pedal-pay-now', '09:30');
    localStorage.setItem('pedal-pay', s);
  }, setUpState({ '2026-11-17': true }));
  const page = await context.newPage();
  await page.goto(base);
  await visible(page, '#main');
  const bottom = await page.evaluate(() => document.querySelector('#calendar [data-key="2026-11-30"]').getBoundingClientRect().bottom);
  assert.ok(bottom <= 600, `last day ends at ${bottom}px`);
  await context.close();
});

test('the bookmark is named after what it does', async () => {
  const { page, context } = await openApp('2026-11-17', { 'pedal-pay': setUpState({ '2026-11-17': true }) });
  await visible(page, '#main');
  await page.click('#open-settings');
  assert.equal((await page.textContent('#fill-bookmark-link')).trim(), '🚲 Fill bike days in ERPx');
  await context.close();
});

test('an older cached page with a newer script still shows the app', async () => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(s => {
    localStorage.setItem('pedal-pay-today', '2026-11-17');
    localStorage.setItem('pedal-pay-now', '09:30');
    localStorage.setItem('pedal-pay', s);
  }, setUpState({ '2026-11-17': true }));
  // Serve the page without the newest button, as a browser cache might.
  await context.route(/\/(index\.html)?$/, async route => {
    const res = await route.fetch();
    const html = (await res.text()).replace(/<button id="settings-close"[^>]*>.*?<\/button>/, '');
    await route.fulfill({ response: res, body: html });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await visible(page, '#main');
  assert.deepEqual(errors, []);
  await context.close();
});

test('the offline helper always asks the server for the newest files', async () => {
  const sw = await (await fetch(new URL('sw.js', base))).text();
  assert.match(sw, /cache: 'no-cache'/);
  assert.match(sw, /cache: 'reload'/);
});

async function appWithStorage(granted) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(([s, ok]) => {
    localStorage.setItem('pedal-pay-today', '2026-11-17');
    localStorage.setItem('pedal-pay-now', '09:30');
    localStorage.setItem('pedal-pay', s);
    window.__persistCalls = 0;
    let kept = false;
    Object.defineProperty(navigator, 'storage', { value: {
      persisted: async () => kept,
      persist: async () => { window.__persistCalls++; kept = ok; return ok; },
    } });
  }, [setUpState({ '2026-11-17': true }), granted]);
  const page = await context.newPage();
  await page.goto(base);
  await visible(page, '#main');
  return { page, context };
}

test('the app asks Edge to keep its data and Settings says whether it will', async () => {
  const { page, context } = await appWithStorage(true);
  await page.waitForFunction(() => window.__persistCalls === 1);
  await page.click('#open-settings');
  await page.waitForSelector('#storage-kept:has-text("Edge keeps your rides")');
  await context.close();

  const refused = await appWithStorage(false);
  await refused.page.click('#open-settings');
  await refused.page.waitForSelector('#storage-kept:has-text("may clear")');
  await refused.context.close();
});

test('Settings shows the version and the bookmark fingerprint', async () => {
  const { page, context } = await openApp('2026-11-17', { 'pedal-pay': setUpState({ '2026-11-17': true }) });
  await visible(page, '#main');
  await page.click('#open-settings');
  await page.waitForSelector('#app-version:has-text("·")');
  assert.match(await page.textContent('#app-version'), /^Version \d{4}\.\d{2}\.\d{2} · [0-9a-f]{8}$/);
  await context.close();
});

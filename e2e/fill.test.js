import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { bookmarkUrl } from '../src/bookmark.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));

// The app and the fake ERPx share one server but are two sites:
// http://localhost:PORT/ and http://127.0.0.1:PORT/.
let server, browser, appBase, erpBase, bookmarkCode;

const freePort = () => new Promise(resolve => {
  const s = createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

before(async () => {
  const port = await freePort();
  appBase = `http://localhost:${port}/`;
  erpBase = `http://127.0.0.1:${port}/`;
  server = spawn('python3', ['-m', 'http.server', String(port)], { cwd: root, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { await fetch(appBase); break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  const sources = await Promise.all(['src/dates.js', 'src/fill-logic.js', 'fill/panel.js']
    .map(f => readFile(new URL(`../${f}`, import.meta.url), 'utf8')));
  bookmarkCode = decodeURIComponent(bookmarkUrl(sources, appBase).slice('javascript:'.length));
  browser = await chromium.launch({ channel: 'chromium' });
});

after(async () => {
  await browser?.close();
  server?.kill();
});

const appState = JSON.stringify({
  version: 1, kmPerRide: 18, ratePerKm: 0.36, reminderTime: '09:00', allowedSites: [],
  answers: { '2026-11-03': true, '2026-11-16': true, '2026-11-17': true, '2026-11-18': false },
});

async function newContext() {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(s => {
    if (location.hostname === 'localhost' && !localStorage.getItem('pedal-pay')) {
      localStorage.setItem('pedal-pay', s);
      localStorage.setItem('pedal-pay-today', '2026-11-18');
    }
  }, appState);
  return context;
}

async function clickBookmark(context) {
  const page = context.pages()[0] || await context.newPage();
  if (!page.url().startsWith(erpBase)) await page.goto(`${erpBase}e2e/fake-erpx.html`);
  const popup = context.waitForEvent('page', { timeout: 5000 }).catch(() => null);
  await page.evaluate(code => { window.__pedalPayToday = '2026-11-18'; (0, eval)(code); }, bookmarkCode);
  return { page, popup: await popup };
}

const ticked = page => page.$$eval('#pedal-pay-panel [data-key].tick', els => els.map(e => e.dataset.key).sort());
const storedSites = async context => {
  const p = await context.newPage();
  await p.goto(appBase + 'handoff.html');
  const sites = await p.evaluate(() => JSON.parse(localStorage.getItem('pedal-pay')).allowedSites);
  await p.close();
  return sites;
};

test('an unknown site is asked about; after Allow the rides are filled into ERPx', async () => {
  const context = await newContext();
  const { page, popup } = await clickBookmark(context);
  assert.ok(popup, 'the handoff window opened');
  await popup.waitForSelector('#handoff-ask:not([hidden])');
  assert.match(await popup.textContent('#handoff-host'), /127\.0\.0\.1/);
  await popup.click('#handoff-allow');

  await page.waitForSelector('#pedal-pay-panel [data-key].tick');
  assert.deepEqual(await ticked(page), ['2026-11-16', '2026-11-17']);
  assert.equal(await page.isDisabled('#pedal-pay-panel [data-key="2026-11-03"]'), true);
  assert.match(await page.getAttribute('#pedal-pay-panel [data-key="2026-11-03"]', 'aria-label'), /already in ERPx/);
  assert.equal(await page.textContent('#pedal-pay-panel [data-key="2026-11-03"]'), '3');
  assert.equal(await page.inputValue('#pedal-pay-km'), '18');
  assert.equal(await page.evaluate(() => window.fake.purpose.value), 'Fietsvergoeding november 2026');

  await page.click('#pedal-pay-generate');
  await page.waitForFunction(() => window.fake.records.length === 3, null, { timeout: 15000 });
  const added = await page.evaluate(() => window.fake.records.slice(1).map(r => ({
    date: `${r.data.expenseDate.getFullYear()}-${r.data.expenseDate.getMonth() + 1}-${r.data.expenseDate.getDate()}`,
    type: r.data.expenseType, km: r.data.quantity })));
  assert.deepEqual(added, [
    { date: '2026-11-16', type: 'FIETSVG', km: 18 },
    { date: '2026-11-17', type: 'FIETSVG', km: 18 },
  ]);
  await page.waitForSelector('#pedal-pay-status:has-text("2 lines added")');
  await page.waitForSelector('#pedal-pay-panel', { state: 'detached', timeout: 8000 });
  assert.deepEqual(await storedSites(context), [new URL(erpBase).origin]);

  // The second time, the allowed site is not asked again.
  const second = await clickBookmark(context);
  // 16 and 17 November are now in ERPx, so they show as done; no question was asked.
  await page.waitForSelector('#pedal-pay-panel [data-key="2026-11-16"].done', { timeout: 8000 });
  assert.equal(await page.isHidden('#pedal-pay-note'), true);
  assert.deepEqual(await ticked(page), []);
  if (second.popup && !second.popup.isClosed()) {
    assert.equal(await second.popup.isHidden('#handoff-ask').catch(() => true), true);
  }
  await context.close();
});

test('Don\'t allow ticks every workday, explains why, and remembers nothing', async () => {
  const context = await newContext();
  const { page, popup } = await clickBookmark(context);
  await popup.waitForSelector('#handoff-ask:not([hidden])');
  await popup.click('#handoff-deny');
  await page.waitForSelector('#pedal-pay-note:not([hidden])');
  assert.match(await page.textContent('#pedal-pay-note'), /all workdays are ticked/);
  assert.equal((await ticked(page)).length, 19);   // 20 workdays, 3 November already in ERPx
  assert.deepEqual(await storedSites(context), []);
  await context.close();
});

test('clicking the bookmark again closes the panel', async () => {
  const context = await newContext();
  const { page, popup } = await clickBookmark(context);
  await popup.waitForSelector('#handoff-ask:not([hidden])');
  await popup.click('#handoff-deny');
  await page.waitForSelector('#pedal-pay-panel');
  await page.evaluate(code => (0, eval)(code), bookmarkCode);
  assert.equal(await page.$('#pedal-pay-panel'), null);
  await context.close();
});

test('when the app is not set up, the window says so and the panel falls back', async () => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(`${erpBase}e2e/fake-erpx.html`);
  const popupEvent = context.waitForEvent('page', { timeout: 5000 });
  await page.evaluate(code => { window.__pedalPayToday = '2026-11-18'; (0, eval)(code); }, bookmarkCode);
  const popup = await popupEvent;
  await popup.waitForSelector('#handoff-setup:not([hidden])');
  await page.waitForSelector('#pedal-pay-note:not([hidden])');
  assert.equal((await ticked(page)).length, 19);
  await context.close();
});

async function openAllowed(context, before) {
  const page = await context.newPage();
  await page.goto(`${erpBase}e2e/fake-erpx.html`);
  if (before) await page.evaluate(before);
  const popupEvent = context.waitForEvent('page', { timeout: 5000 });
  await page.evaluate(code => { window.__pedalPayToday = '2026-11-18'; (0, eval)(code); }, bookmarkCode);
  const popup = await popupEvent;
  await popup.waitForSelector('#handoff-ask:not([hidden])');
  await popup.click('#handoff-allow');
  return page;
}

test('after an ERPx error, days already added are locked and never added twice', async () => {
  const context = await newContext();
  const page = await openAllowed(context, () => { window.fake.failOnDay = 17; });
  await page.waitForSelector('#pedal-pay-panel [data-key].tick');
  await page.click('#pedal-pay-generate');
  await page.waitForSelector('#pedal-pay-status:has-text("Stopped")', { timeout: 15000 });
  assert.equal(await page.isDisabled('#pedal-pay-panel [data-key="2026-11-16"]'), true);
  assert.deepEqual(await ticked(page), ['2026-11-17']);
  await page.evaluate(() => { window.fake.failOnDay = null; });
  await page.click('#pedal-pay-generate');
  await page.waitForSelector('#pedal-pay-status:has-text("1 line added")', { timeout: 15000 });
  const days = await page.evaluate(() => window.fake.records.filter(r => r.data.expenseDate).map(r => new Date(r.data.expenseDate).getDate()).sort((a, b) => a - b));
  assert.deepEqual(days, [3, 16, 17]);
  await context.close();
});

test('existing dates stored as text still count, and without the expense grid nothing can be added', async () => {
  const context = await newContext();
  const page = await openAllowed(context, () => { window.fake.records.push({ data: { expenseDate: '2026-11-17T00:00:00' } }); });
  await page.waitForSelector('#pedal-pay-panel [data-key="2026-11-17"].done');
  assert.deepEqual(await ticked(page), ['2026-11-16']);
  await context.close();

  const context2 = await newContext();
  const page2 = await openAllowed(context2, () => { window.fake.noGrid = true; });
  await page2.waitForSelector('#pedal-pay-note:not([hidden])');
  assert.match(await page2.textContent('#pedal-pay-note'), /could not read/);
  assert.equal(await page2.isDisabled('#pedal-pay-generate'), true);
  await context2.close();
});

test('Allow cannot be clicked the instant the question appears', async () => {
  const context = await newContext();
  const page = await context.newPage();
  await page.goto(`${erpBase}e2e/fake-erpx.html`);
  const popupEvent = context.waitForEvent('page', { timeout: 5000 });
  await page.evaluate(code => { window.__pedalPayToday = '2026-11-18'; (0, eval)(code); }, bookmarkCode);
  const popup = await popupEvent;
  await popup.waitForSelector('#handoff-ask:not([hidden])');
  assert.equal(await popup.isDisabled('#handoff-allow'), true);
  await popup.waitForSelector('#handoff-allow:not([disabled])', { timeout: 3000 });
  await context.close();
});

test('without rides from the app, km per ride starts empty and must be filled in', async () => {
  const context = await newContext();
  const { page, popup } = await clickBookmark(context);
  await popup.waitForSelector('#handoff-ask:not([hidden])');
  await popup.click('#handoff-deny');
  await page.waitForSelector('#pedal-pay-note:not([hidden])');
  assert.equal(await page.inputValue('#pedal-pay-km'), '');
  assert.equal(await page.isDisabled('#pedal-pay-generate'), true);
  assert.match(await page.textContent('#pedal-pay-generate'), /km per ride/);
  await page.fill('#pedal-pay-km', '12,5');
  assert.equal(await page.isDisabled('#pedal-pay-generate'), false);
  await context.close();
});

test('only bike allowance lines (or lines without a type) mark a day as already in ERPx', async () => {
  const context = await newContext();
  const page = await openAllowed(context, () => {
    window.fake.records.push({ data: { expenseDate: new Date(2026, 10, 16), expenseType: 'TREIN' } });
    window.fake.records.push({ data: { expenseDate: new Date(2026, 10, 17) } });
    window.fake.records.push({ data: { expenseDate: new Date(2026, 10, 12), expenseType: 'Fietsvergoeding (woon-werkverkeer)' } });
  });
  await page.waitForSelector('#pedal-pay-panel [data-key="2026-11-17"].done');
  assert.equal(await page.isDisabled('#pedal-pay-panel [data-key="2026-11-12"]'), true);
  assert.equal(await page.isDisabled('#pedal-pay-panel [data-key="2026-11-16"]'), false);
  assert.deepEqual(await ticked(page), ['2026-11-16']);
  await context.close();
});

test('the panel\'s font request does not tell Google the ERPx address', async () => {
  const context = await newContext();
  const page = await openAllowed(context);
  await page.waitForSelector('#pedal-pay-panel [data-key].tick');
  assert.equal(await page.getAttribute('link[href*="family=Fredoka"]', 'referrerpolicy'), 'no-referrer');
  await context.close();
});

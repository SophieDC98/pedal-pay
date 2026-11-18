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

const ride = keys => Object.fromEntries(keys.map(k => [k, true]));
const stateWith = (answers, extra = {}) => JSON.stringify({
  version: 1, kmPerRide: 18, ratePerKm: 0.36, reminderTime: '09:00', allowedSites: [], answers, ...extra });

// A browser where the app holds these answers; the fake ERPx starts with a
// bike line on 3 November.
async function newContext(answers = { ...ride(['2026-11-03', '2026-11-16', '2026-11-17']), '2026-11-18': false }, extra) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  if (answers !== null) {
    await context.addInitScript(s => {
      if (location.hostname === 'localhost' && !localStorage.getItem('pedal-pay')) {
        localStorage.setItem('pedal-pay', s);
        localStorage.setItem('pedal-pay-today', '2026-11-18');
      }
    }, stateWith(answers, extra));
  }
  return context;
}

// Opens the fake ERPx, runs `before` there, clicks the bookmark and returns
// the ERPx page and the small Pedal Pay window.
async function clickBookmark(context, before) {
  let page = context.pages().find(p => p.url().startsWith(erpBase));
  if (!page) {
    page = await context.newPage();
    await page.goto(`${erpBase}e2e/fake-erpx.html`);
    if (before) await page.evaluate(before);
  }
  const popup = context.waitForEvent('page', { timeout: 5000 }).catch(() => null);
  await page.evaluate(code => { window.__pedalPayToday = '2026-11-18'; (0, eval)(code); }, bookmarkCode);
  return { page, popup: await popup };
}

async function clickAndAllow(context, before) {
  const { page, popup } = await clickBookmark(context, before);
  await popup.waitForSelector('#handoff-ask:not([hidden])');
  await popup.click('#handoff-allow');
  return page;
}

const message = page => page.textContent('#pedal-pay-message');
const status = page => page.textContent('#pedal-pay-status');
const doneWith = (page, text, timeout = 30000) => page.waitForSelector(`#pedal-pay-status:has-text("${text}")`, { timeout });
const lines = page => page.evaluate(() => window.fake.records.map(r =>
  `${new Date(r.data.expenseDate).getDate()}:${r.data.expenseType ?? '-'}:${r.data.quantity ?? '-'}`).sort((a, b) => parseInt(a) - parseInt(b)));
const storedSites = async context => {
  const p = await context.newPage();
  await p.goto(appBase + 'handoff.html');
  const sites = await p.evaluate(() => JSON.parse(localStorage.getItem('pedal-pay')).allowedSites);
  await p.close();
  return sites;
};

test('after Allow, the month\'s rides are added with a progress bar, and the popup closes', async () => {
  const context = await newContext();
  const { page, popup } = await clickBookmark(context);
  assert.ok(popup, 'the small window opened');
  await popup.waitForSelector('#handoff-ask:not([hidden])');
  assert.match(await popup.textContent('#handoff-host'), /127\.0\.0\.1/);
  await popup.click('#handoff-allow');

  await page.waitForSelector('#pedal-pay-progress');
  assert.match(await message(page), /Adding 2 days of November to ERPx/);
  assert.equal(await page.locator('#pedal-pay-panel .pp-road .pp-bike .pp-wheel').count(), 2);
  assert.equal(await page.locator('#pedal-pay-panel .pp-flag').count(), 1);
  await doneWith(page, '2 added');
  assert.equal((await page.textContent('#pedal-pay-km')).replace(/\s+/g, ' ').trim(), '36 of 36 km');
  assert.deepEqual(await lines(page), ['3:FIETSVG:18', '16:FIETSVG:18', '17:FIETSVG:18']);
  assert.equal(await page.evaluate(() => window.fake.purpose.value), 'Fietsvergoeding november 2026');
  await page.waitForSelector('#pedal-pay-panel', { state: 'detached', timeout: 8000 });
  assert.deepEqual(await storedSites(context), [new URL(erpBase).origin]);

  // The second time there is no question, and nothing left to do.
  await clickBookmark(context);
  await doneWith(page, 'already up to date', 10000);
  await context.close();
});

test('bike lines that are not rides in the app are removed; other lines and the claim stay', async () => {
  const context = await newContext(ride(['2026-11-16']));
  const page = await clickAndAllow(context, () => {
    window.fake.records.push({ data: { expenseDate: new Date(2026, 10, 3), expenseType: 'TREIN' } });
  });
  await page.waitForSelector('#pedal-pay-progress');
  assert.match(await message(page), /Adding 1 day of November to ERPx · removing 1/);
  await doneWith(page, '1 removed');
  assert.deepEqual(await lines(page), ['3:TREIN:-', '16:FIETSVG:18']);
  assert.equal(await page.evaluate(() => window.fake.claimDeleted), false);
  await context.close();
});

test('Stop halts after the current day', async () => {
  const context = await newContext(ride(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09']));
  const page = await clickAndAllow(context, () => { window.fake.delay = 400; });
  await page.waitForSelector('#pedal-pay-stop');
  await page.click('#pedal-pay-stop');
  await doneWith(page, 'Stopped');
  const added = (await lines(page)).length - 1;
  assert.ok(added >= 0 && added < 5, `${added} days were added after Stop`);
  await context.close();
});

test('after an ERPx error it stops; clicking again adds only what is missing', async () => {
  const context = await newContext();
  const page = await clickAndAllow(context, () => { window.fake.failOnDay = 17; });
  await doneWith(page, 'Stopped at 2026-11-17');
  await page.evaluate(() => { window.fake.failOnDay = null; });
  await page.click('#pedal-pay-panel .pp-x');
  await clickBookmark(context);
  await doneWith(page, '1 added');
  assert.deepEqual(await lines(page), ['3:FIETSVG:18', '16:FIETSVG:18', '17:FIETSVG:18']);
  await context.close();
});

test('Don\'t allow explains what to do and adds nothing', async () => {
  const context = await newContext();
  const { page, popup } = await clickBookmark(context);
  await popup.waitForSelector('#handoff-ask:not([hidden])');
  await popup.click('#handoff-deny');
  await page.waitForSelector('#pedal-pay-message:has-text("chose not to share")');
  assert.equal(await page.locator('#pedal-pay-progress').count(), 0);
  assert.equal(await page.evaluate(() => window.fake.records.length), 1);
  assert.deepEqual(await storedSites(context), []);
  await context.close();
});

test('when the app is not set up, the popup says so and adds nothing', async () => {
  const context = await newContext(null);
  const { page, popup } = await clickBookmark(context);
  await popup.waitForSelector('#handoff-setup:not([hidden])');
  await page.waitForSelector('#pedal-pay-message:has-text("isn\'t set up")');
  assert.equal(await page.evaluate(() => window.fake.records.length), 1);
  await context.close();
});

test('without the expense claim open, nothing is added', async () => {
  const context = await newContext();
  const page = await clickAndAllow(context, () => { window.fake.noGrid = true; });
  await page.waitForSelector('#pedal-pay-message:has-text("Open your expense claim")');
  assert.equal(await page.locator('#pedal-pay-progress').count(), 0);
  await context.close();
});

test('existing dates stored as text are recognised', async () => {
  const context = await newContext();
  const page = await clickAndAllow(context, () => {
    window.fake.records.push({ data: { expenseDate: '2026-11-17T00:00:00', expenseType: 'FIETSVG' } });
  });
  await doneWith(page, '1 added');
  assert.deepEqual(await lines(page), ['3:FIETSVG:18', '16:FIETSVG:18', '17:FIETSVG:-']);
  await context.close();
});

test('clicking the bookmark again closes the popup', async () => {
  const context = await newContext();
  const { page, popup } = await clickBookmark(context);
  await popup.waitForSelector('#handoff-ask:not([hidden])');
  await page.waitForSelector('#pedal-pay-panel');
  await page.evaluate(code => (0, eval)(code), bookmarkCode);
  assert.equal(await page.locator('#pedal-pay-panel').count(), 0);
  await context.close();
});

test('days are added as fast as ERPx is ready, and a slow ERPx is waited for', async () => {
  const six = ['2026-11-02', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10'];
  const context = await newContext(ride(six));
  const page = await clickAndAllow(context, () => { window.fake.records.length = 0; });
  const started = Date.now();
  await doneWith(page, '6 added');
  const seconds = (Date.now() - started) / 1000;
  assert.ok(seconds < 6, `6 days took ${seconds}s (fixed waits took about 11s)`);
  await context.close();

  const slow = await newContext(ride(six.slice(0, 2)));
  const page2 = await clickAndAllow(slow, () => { window.fake.records.length = 0; window.fake.delay = 900; });
  await doneWith(page2, '2 added');
  assert.deepEqual(await lines(page2), ['2:FIETSVG:18', '4:FIETSVG:18']);
  await slow.close();
});

test('Allow cannot be clicked the instant the question appears', async () => {
  const context = await newContext();
  const { popup } = await clickBookmark(context);
  await popup.waitForSelector('#handoff-ask:not([hidden])');
  assert.equal(await popup.isDisabled('#handoff-allow'), true);
  await popup.waitForSelector('#handoff-allow:not([disabled])', { timeout: 3000 });
  await context.close();
});

test('the popup\'s font request does not tell Google the ERPx address', async () => {
  const context = await newContext();
  const { page } = await clickBookmark(context);
  await page.waitForSelector('#pedal-pay-panel');
  assert.equal(await page.getAttribute('link[href*="family=Fredoka"]', 'referrerpolicy'), 'no-referrer');
  await context.close();
});

test('when ERPx fills in today\'s date after the category, the right date is put back', async () => {
  const context = await newContext(ride(['2026-11-04', '2026-11-05', '2026-11-06']));
  const page = await clickAndAllow(context, () => { window.fake.records.length = 0; window.fake.defaultsOnType = true; });
  await doneWith(page, '3 added');
  assert.deepEqual(await lines(page), ['4:FIETSVG:18', '5:FIETSVG:18', '6:FIETSVG:18']);
  await context.close();
});

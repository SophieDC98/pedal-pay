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
  await page.fill('#setup-km', '18');
  await page.fill('#setup-rate', '0,36');
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
  await page.fill('#setup-rate', '0,36');
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

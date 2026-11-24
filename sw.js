// Keeps Pedal Pay working offline and handles the morning notification's buttons.
const CACHE = 'pedal-pay-v3';
const FILES = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './handoff.html', './src/app.js', './src/dates.js', './src/store.js', './src/stats.js',
  './src/handoff.js', './src/fill-logic.js', './src/bookmark.js', './src/version.js', './fill/panel.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', event => {
  // 'reload' skips the browser's HTTP cache, so the saved copy is one version.
  event.waitUntil(caches.open(CACHE)
    .then(cache => cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

// Network first, so a new version reaches people as soon as they are online;
// the cache keeps the app opening when they are not.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    try {
      // 'no-cache' asks the server every time, so the page and its scripts are
      // never a mix of an old and a new version (GitHub Pages lets browsers
      // keep files for ten minutes).
      const request = event.request.mode === 'navigate'
        ? new Request(event.request.url, { cache: 'no-cache', credentials: 'same-origin' })
        : new Request(event.request, { cache: 'no-cache' });
      const response = await fetch(request);
      if (response.ok && new URL(event.request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return (await caches.match(event.request)) || Response.error();
    }
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows[0] || await self.clients.openWindow('./');
    if (!client) return;
    if (event.action === 'yes' || event.action === 'no') {
      client.postMessage({ type: 'answer', ride: event.action === 'yes' });
    }
    if ('focus' in client) await client.focus();
  })());
});

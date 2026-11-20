// Service worker: keeps a copy of the app's files on the phone so it opens without internet.
// Strategy: show the saved copy instantly, and quietly fetch a fresh one for next time.
// (Your financial data is not here: it lives in localStorage and never touches this file.)
const CACHE = 'finance-tracker';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const saved = await cache.match(event.request, { ignoreSearch: true }); // "?action=add" uses the same page
    const fresh = fetch(event.request).then((response) => {
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    });
    if (saved) {
      event.waitUntil(fresh.catch(() => {})); // offline: keep the saved copy
      return saved;
    }
    return fresh;
  }));
});

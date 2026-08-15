// Minimal service worker: just enough for the "add to home screen" PWA
// install prompt. Network-first (not cache-first) so every deploy is
// picked up immediately when online — the cache is only a fallback for
// the rare offline case, never the source of truth for fresh content.
const CACHE_NAME = 'villa-ops-v3';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/auth.js',
  './js/access.js',
  './js/store.js',
  './js/data.js',
  './js/utils.js',
  './js/entry-card.js',
  './js/entry-form.js',
  './js/entry-detail.js',
  './js/journal.js',
  './js/calendar.js',
  './js/tasks.js',
  './js/reservations.js',
  './js/villas.js',
  './js/realtime.js',
  './js/nav-history.js',
  './js/push.js',
  './js/supabase-client.js',
  './js/vendor/supabase.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only same-origin static assets go through this: Supabase, fonts and
  // the Supabase JS CDN go straight to the network untouched.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Daily task-notification payload: { title, body, url }
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    /* ignore malformed payloads */
  }
  const title = data.title || 'Villa Ops';
  const options = {
    body: data.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url: data.url || './index.html' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

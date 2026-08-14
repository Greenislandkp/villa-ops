// Service worker minimal : juste ce qu'il faut pour l'installation PWA sur
// l'écran d'accueil + un chargement rapide de la coquille de l'app.
// Pas de synchronisation offline des données (elles viennent de Supabase en ligne).
const CACHE_NAME = 'villa-ops-v1';
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
  './js/villas.js',
  './js/realtime.js',
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
  // On ne touche qu'aux assets statiques du même origine : Supabase, les
  // polices et le CDN Supabase JS passent directement au réseau.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});

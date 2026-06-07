const CACHE = 'theyard-v2';
const BASE = '/The-Yard';
const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/css/main.css',
  BASE + '/js/storage.js',
  BASE + '/js/utils.js',
  BASE + '/js/modal.js',
  BASE + '/js/weather.js',
  BASE + '/js/today.js',
  BASE + '/js/jobs.js',
  BASE + '/js/projects.js',
  BASE + '/js/money.js',
  BASE + '/js/maintenance.js',
  BASE + '/js/fitness.js',
  BASE + '/js/settings.js',
  BASE + '/js/app.js',
  BASE + '/manifest.json',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Network-first for Google Fonts
  if (e.request.url.includes('fonts.googleapis.com') || e.request.url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        fetch(e.request)
          .then(res => { cache.put(e.request, res.clone()); return res; })
          .catch(() => caches.match(e.request))
      )
    );
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

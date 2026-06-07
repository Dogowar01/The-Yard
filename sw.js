const CACHE = 'theyard-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/storage.js',
  '/js/utils.js',
  '/js/modal.js',
  '/js/today.js',
  '/js/jobs.js',
  '/js/projects.js',
  '/js/money.js',
  '/js/maintenance.js',
  '/js/fitness.js',
  '/js/app.js',
  '/manifest.json',
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
  // Cache-first for local assets, network-first for fonts
  if (e.request.url.includes('fonts.googleapis.com') || e.request.url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        fetch(e.request).then(res => { cache.put(e.request, res.clone()); return res; })
          .catch(() => caches.match(e.request))
      )
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

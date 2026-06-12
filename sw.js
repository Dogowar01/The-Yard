const CACHE = 'theyard-v4';
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
  BASE + '/js/vault.js',
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
  const url = new URL(e.request.url);

  // Always go to network for Google Fonts
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // For versioned JS/CSS requests (?v=XX), strip query and match cache
  if (url.searchParams.has('v')) {
    const bareRequest = new Request(url.origin + url.pathname);
    e.respondWith(
      caches.match(bareRequest).then(cached => cached || fetch(e.request))
    );
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

var CACHE_NAME = 'notes-cache-v5'; // v5: strict network-first
var urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './app.js',
  './icon.png'
];

// Install event: cache initial assets
self.addEventListener('install', function(event) {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event: cleanup old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
        return self.clients.claim(); // Take control of all open clients immediately
    })
  );
});

// Fetch event: Network-First strategy with dynamic cache update
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    // Bypassa la cache HTTP del browser per forzare l'URL aggiornato dal server
    fetch(event.request, { cache: 'no-store' })
      .then(function(response) {
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(function() {
        return caches.match(event.request);
      })
  );
});

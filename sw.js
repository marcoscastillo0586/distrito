const CACHE_NAME = 'valuation-ledger-v1';
const ASSETS = [
  'index.html',
  'style.css',
  'app.js',
  'manifest.json'
];

// Cache all assets during install
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Clear old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Offline first strategy for static assets, network bypass for API
self.addEventListener('fetch', (e) => {
  // Only handle local app assets (GET requests)
  // Bypass API, exchange rate calls and Netlify Functions
  if (e.request.method !== 'GET' || e.request.url.includes('dolarapi.com') || e.request.url.includes('api.php') || e.request.url.includes('/.netlify/')) {
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});

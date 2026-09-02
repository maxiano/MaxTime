const CACHE_NAME = 'dayflow-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json'
];

// Installazione Service Worker e salvataggio in cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Attivazione e pulizia vecchie cache
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
    })
  );
});

// Intercettazione richieste di rete
self.addEventListener('fetch', (e) => {
  // Lasciamo passare le richieste a Firebase (Firestore) senza cache aggressiva
  if (e.request.url.includes('firestore.googleapis.com')) {
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});

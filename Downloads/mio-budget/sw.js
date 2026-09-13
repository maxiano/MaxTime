const CACHE_NAME = 'budget-app-v8';

// Risorse locali dell'applicazione
const LOCAL_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

// Librerie esterne CDN
const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js'
];

// Installazione: Caching tollerante agli errori (non blocca il SW se un asset fallisce)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Caching file locali
      for (const asset of LOCAL_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('Impossibile salvare in cache la risorsa locale:', asset);
        }
      }

      // 2. Caching CDN esterne in modalità no-cors
      for (const cdnUrl of CDN_ASSETS) {
        try {
          const req = new Request(cdnUrl, { mode: 'no-cors' });
          const res = await fetch(req);
          await cache.put(req, res);
        } catch (err) {
          console.warn('Impossibile salvare in cache la CDN:', cdnUrl);
        }
      }
    })
  );
});

// Attivazione: Rimozione vecchie cache e presa in carico dei client
self.addEventListener('activate', (event) => {
  event.waitUntil(
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

// Intercettazione Richieste di Rete
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignora protocolli non-HTTP (es. chrome-extension://)
  if (!url.protocol.startsWith('http')) return;

  // Ignora chiamate verso i server Firebase/Google
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('identitytoolkit')
  ) {
    return;
  }

  if (event.request.method !== 'GET') return;

  // Strategia Network-First con Fallback su Cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

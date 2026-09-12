const CACHE_NAME = 'turni-valerio-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './js/app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

// 1. FASE DI INSTALLAZIONE: Salva gli asset fondamentali in cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Promise.allSettled previene il blocco in caso di un file singolo non trovato
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => cache.add(url))
      );
    })
  );
  self.skipWaiting();
});

// 2. FASE DI ATTIVAZIONE: Elimina le vecchie versioni della cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. FASE DI INTERCETTAZIONE RICHIESTE (FETCH)
self.addEventListener('fetch', (event) => {
  // Ignora le chiamate non-GET (es. salvataggi Firestore / Firebase POST)
  if (event.request.method !== 'GET') {
    return;
  }

  // Ignora risorse di terze parti non autorizzate (tranne il CDN per SheetJS Excel)
  const isSelfOrigin = event.request.url.startsWith(self.location.origin);
  const isExcelCDN = event.request.url.includes('cdn.jsdelivr.net');
  if (!isSelfOrigin && !isExcelCDN) {
    return;
  }

  // Strategia Stale-While-Revalidate per i file locali (caricamento istantaneo + aggiornamento in background)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Se la risposta di rete è valida, aggiorna la cache in background
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        // Fallback offline per la navigazione di pagina
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });

      // Ritorna subito il file in cache se disponibile, altrimenti attende la rete
      return cachedResponse || fetchPromise;
    })
  );
});

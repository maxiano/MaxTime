self.addEventListener('install', (e) => {
    console.log('[Service Worker] Installato');
});

self.addEventListener('fetch', (e) => {
    // Gestione fetch di base
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

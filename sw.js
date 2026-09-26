// Service Worker básico para cumplir con los requisitos de PWA
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
    // Permite que la app funcione normalmente conectada a internet
    e.respondWith(fetch(e.request).catch(() => new Response("Offline")));
});
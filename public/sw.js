// Service Worker PWA ativo para instalacao em Desktop, Android e iOS sem conflito com sw-notifications.js
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response('Sem conexão com a internet.', { status: 503, statusText: 'Offline' })
    )
  );
});

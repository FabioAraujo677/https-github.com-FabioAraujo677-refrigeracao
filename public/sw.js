// Service Worker passivo para requisito de instalacao PWA sem recarregamentos ou conflito com sw-notifications.js
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;
  event.respondWith(fetch(event.request));
});

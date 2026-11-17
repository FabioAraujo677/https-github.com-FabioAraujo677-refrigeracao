// Service Worker PWA ativo para instalacao em Desktop, Android e iOS
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // NetworkOnly for Supabase database requests to prevent stale cache on mobile
  if (event.request.url.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request).catch(
      () => new Response('Sem conexão com a internet.', { status: 503, statusText: 'Offline' })
    )
  );
});

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

  // NetworkOnly for SuperDB / PostgreSQL REST requests to prevent stale cache on mobile
  if (
    event.request.url.includes('superdb') ||
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('/rest/v1/') ||
    event.request.url.includes('/storage/v1/')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request).catch(
      () => new Response('Sem conexão com a internet.', { status: 503, statusText: 'Offline' })
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NEOFIX_NOTIFICATION_CLICK',
            tag: event.notification.tag || '',
            data: event.notification.data || {},
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {
    title: 'NEO FIX - Novo Alerta',
    body: 'Você recebeu uma atualização no sistema.',
    tag: 'neofix-push',
  };

  try {
    const parsed = event.data.json();
    payload = { ...payload, ...parsed };
  } catch {
    payload.body = event.data.text() || payload.body;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon.svg',
      tag: payload.tag || 'neofix-push',
      renotify: true,
      requireInteraction: true,
      vibrate: [250, 120, 250, 120, 400],
      data: { url: '/', ...(payload.data || {}) },
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_TECH_NOTIFICATION') {
    const { title, options } = event.data;
    event.waitUntil(self.registration.showNotification(title, options || {}));
  }
});

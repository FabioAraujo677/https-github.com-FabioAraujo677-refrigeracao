// Service Worker handler for PWA Mobile & Desktop Notifications (NEO FIX)
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
    title: 'NEO FIX - Novo Agendamento',
    body: 'Você recebeu uma nova Ordem de Serviço.',
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
      icon: '/Logo%203D%20NEXVOLTORAEM%20em%20Azul%20G%C3%A9lido.png',
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

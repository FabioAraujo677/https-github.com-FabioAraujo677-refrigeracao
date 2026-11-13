/**
 * Browser Push & PWA Service Worker Notifications Utility (NEO FIX)
 */

const APP_NOTIFICATION_ICON = '/Logo%203D%20NEXVOLTORAEM%20em%20Azul%20G%C3%A9lido.png';
const APP_NOTIFICATION_BADGE = '/icon.svg';

export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function ensureServiceWorkerRegistered(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    let reg = await navigator.serviceWorker.getRegistration();

    if (!reg) {
      try {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch {
        try {
          reg = await navigator.serviceWorker.register('/dev-sw.js?dev-sw', { type: 'module', scope: '/' });
        } catch {
          try {
            reg = await navigator.serviceWorker.register('/sw-notifications.js', { scope: '/' });
          } catch (innerErr) {
            console.warn('[NOTIFICATIONS] Fallback Service Worker registration failed:', innerErr);
          }
        }
      }
    }

    if (reg) {
      return reg;
    }

    const readyWithTimeout = await Promise.race<ServiceWorkerRegistration | null>([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);

    return readyWithTimeout;
  } catch (err) {
    console.warn('[NOTIFICATIONS] Service Worker error:', err);
    return null;
  }
}

export async function enablePwaNotifications(): Promise<{
  granted: boolean;
  permission: NotificationPermission | 'unsupported';
  swRegistered: boolean;
}> {
  const swReg = await ensureServiceWorkerRegistered();

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { granted: false, permission: 'unsupported', swRegistered: Boolean(swReg) };
  }

  try {
    if (Notification.permission === 'granted') {
      return { granted: true, permission: 'granted', swRegistered: Boolean(swReg) };
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return {
        granted: permission === 'granted',
        permission,
        swRegistered: Boolean(swReg),
      };
    }

    return {
      granted: false,
      permission: Notification.permission,
      swRegistered: Boolean(swReg),
    };
  } catch (err) {
    console.warn('[NOTIFICATIONS] Error requesting permission:', err);
    return {
      granted: false,
      permission: getNotificationPermissionStatus(),
      swRegistered: Boolean(swReg),
    };
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const result = await enablePwaNotifications();
  return result.granted;
}

export async function sendBrowserNotification(
  title: string,
  body: string,
  tag?: string,
  extraData?: Record<string, any>
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const notificationTag = tag || 'neofix-notification';
  const options: NotificationOptions & Record<string, any> = {
    body,
    icon: APP_NOTIFICATION_ICON,
    badge: APP_NOTIFICATION_BADGE,
    tag: notificationTag,
    renotify: true,
    requireInteraction: true,
    vibrate: [250, 120, 250, 120, 400],
    silent: false,
    data: {
      url: '/',
      ...(extraData || {}),
    },
  };

  try {
    const reg = await ensureServiceWorkerRegistered();
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(title, options);
      return true;
    }

    new Notification(title, options);
    return true;
  } catch (err) {
    console.warn('[NOTIFICATIONS] Service Worker showNotification fallback:', err);
    try {
      new Notification(title, options);
      return true;
    } catch (fallbackErr) {
      console.warn('[NOTIFICATIONS] Error showing fallback notification:', fallbackErr);
      return false;
    }
  }
}

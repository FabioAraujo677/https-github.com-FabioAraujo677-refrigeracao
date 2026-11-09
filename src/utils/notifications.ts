/**
 * Browser Push Notifications Utility for Attendants & Admins
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  } catch (err) {
    console.warn('[NOTIFICATIONS] Error requesting permission:', err);
  }
  return false;
}

export function sendBrowserNotification(title: string, body: string, tag?: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    try {
      const options: NotificationOptions = {
        body,
        icon: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=192&h=192&fit=crop',
        tag: tag || 'neofix-notification',
      };

      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, options);
        }).catch(() => {
          new Notification(title, options);
        });
      } else {
        new Notification(title, options);
      }
    } catch (err) {
      console.warn('[NOTIFICATIONS] Error showing notification:', err);
    }
  }
}

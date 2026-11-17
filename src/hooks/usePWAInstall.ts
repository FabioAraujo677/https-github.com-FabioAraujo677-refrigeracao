import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __deferredInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && window.__deferredInstallPrompt) {
      return window.__deferredInstallPrompt;
    }
    return null;
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkStandalone = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    setIsInstalled(checkStandalone());

    // Detect iPhone / iPad (including iPadOS Safari reporting Macintosh with touch points)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      (/iphone|ipad|ipod/.test(userAgent) ||
        (/macintosh/.test(userAgent) && (window.navigator.maxTouchPoints || 0) > 1)) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);

    // Sync any prompt captured before React mounted
    if (window.__deferredInstallPrompt) {
      setDeferredPrompt(window.__deferredInstallPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__deferredInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleInstallAvailable = () => {
      if (window.__deferredInstallPrompt) {
        setDeferredPrompt(window.__deferredInstallPrompt);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.__deferredInstallPrompt = null;
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = () => setIsInstalled(checkStandalone());

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery.addEventListener?.('change', handleDisplayChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener?.('change', handleDisplayChange);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? window.__deferredInstallPrompt : null);
    if (!promptEvent) return false;
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      window.__deferredInstallPrompt = null;
      setDeferredPrompt(null);
      if (outcome === 'accepted') {
        setIsInstalled(true);
        return true;
      }
    } catch (err) {
      console.warn('[PWA] Error launching install prompt:', err);
    }
    return false;
  };

  return {
    isInstallable: !!(deferredPrompt || (typeof window !== 'undefined' && window.__deferredInstallPrompt)),
    isInstalled,
    isIOS,
    install,
    deferredPrompt,
  };
}

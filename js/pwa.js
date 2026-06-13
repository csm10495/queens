// PWA glue: registers the service worker (for offline) and manages the
// "Install app" flow. All browser-only; kept out of the pure logic modules.

let deferredPrompt = null;
const listeners = new Set();

function notify() {
  for (const fn of listeners) {
    try {
      fn(getInstallState());
    } catch {
      /* ignore listener errors */
    }
  }
}

/** True when running as an installed/standalone app. */
export function isStandalone() {
  return (
    (typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    (typeof navigator !== 'undefined' && navigator.standalone === true)
  );
}

/** True on iOS/iPadOS Safari, which has no programmatic install prompt. */
export function isIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac but is touch-capable.
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

/**
 * Current install state for the UI.
 * @returns {{ canPrompt: boolean, installed: boolean, ios: boolean }}
 */
export function getInstallState() {
  return { canPrompt: !!deferredPrompt, installed: isStandalone(), ios: isIos() };
}

/** Subscribe to install-state changes; returns an unsubscribe function. */
export function onInstallStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Show the native install prompt if available.
 * @returns {Promise<'accepted'|'dismissed'|'unavailable'>}
 */
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  const evt = deferredPrompt;
  deferredPrompt = null;
  evt.prompt();
  let outcome = 'dismissed';
  try {
    ({ outcome } = await evt.userChoice);
  } catch {
    /* ignore */
  }
  notify();
  return outcome;
}

/** Register the service worker and wire install events. Call once on load. */
export function initPwa() {
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        /* offline support simply unavailable */
      });
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

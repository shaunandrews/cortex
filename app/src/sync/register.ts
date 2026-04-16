/**
 * Service Worker registration utility.
 * Only registers in production — dev uses "direct mode" (engine in main thread).
 */

export async function registerSyncWorker(): Promise<ServiceWorkerRegistration | null> {
  if (import.meta.env.DEV) return null;
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      type: 'module',
    });

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available — it will activate on next page load
          console.log('[SyncWorker] New version available');
        }
      });
    });

    return registration;
  } catch (err) {
    console.error('[SyncWorker] Registration failed:', err);
    return null;
  }
}

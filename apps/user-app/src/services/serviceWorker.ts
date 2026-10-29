const SW_PATH = '/firebase-messaging-sw.js';
const SW_SCOPE = '/';

let swRegistrationPromise: Promise<ServiceWorkerRegistration> | null = null;

/**
 * Register or retrieve the active Firebase messaging service worker registration.
 * Ensures the worker is ready and active before resolving.
 */
export async function getOrRegisterServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser.');
  }

  if (swRegistrationPromise) {
    return swRegistrationPromise;
  }

  swRegistrationPromise = (async () => {
    try {
      // Check existing registrations first
      const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE);
      if (existing && existing.active) {
        return existing;
      }

      const registration = await navigator.serviceWorker.register(SW_PATH, {
        scope: SW_SCOPE,
      });

      // Wait until the service worker is activated and ready
      await waitForServiceWorkerActive(registration);
      return registration;
    } catch (err) {
      swRegistrationPromise = null; // allow retry
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Service worker registration failed: ${message}`);
    }
  })();

  return swRegistrationPromise;
}

function waitForServiceWorkerActive(registration: ServiceWorkerRegistration): Promise<void> {
  return new Promise((resolve, reject) => {
    if (registration.active) {
      resolve();
      return;
    }

    const sw = registration.installing || registration.waiting;
    if (!sw) {
      // Check navigator.serviceWorker.ready
      navigator.serviceWorker.ready.then(() => resolve()).catch(reject);
      return;
    }

    const timeout = setTimeout(() => {
      resolve(); // Proceed even if taking long; browser will activate
    }, 5000);

    sw.addEventListener('statechange', () => {
      if (sw.state === 'activated') {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
}

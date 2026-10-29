import { getToken as getFcmToken, onMessage, type MessagePayload } from 'firebase/messaging';
import { getFirebaseMessaging } from './firebase.ts';
import { getOrRegisterServiceWorker } from './serviceWorker.ts';
import { appConfig } from '../config/env.ts';
import type { InboxMessage } from '../types/index.ts';

/**
 * Request real FCM registration token.
 * Passes the explicit ServiceWorkerRegistration and the public VAPID key.
 */
export async function requestFcmToken(): Promise<string> {
  if (!appConfig.isFirebaseConfigComplete) {
    throw new Error(
      `Missing required Firebase configuration: ${appConfig.missingFirebaseKeys.join(', ')}`
    );
  }

  if (!appConfig.vapidKey) {
    throw new Error('VAPID key is missing from environment configuration (VITE_FIREBASE_VAPID_KEY).');
  }

  // 1. Ensure service worker is registered first
  const swRegistration = await getOrRegisterServiceWorker();

  // 2. Get messaging instance
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    throw new Error('Firebase Cloud Messaging is not supported or could not be initialized in this browser.');
  }

  // 3. Obtain FCM token
  try {
    const token = await getFcmToken(messaging, {
      vapidKey: appConfig.vapidKey,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      throw new Error('Firebase returned an empty token. Check project configuration and network access.');
    }

    return token;
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    const code = errObj.code || '';
    const message = errObj.message || String(err);

    if (code.includes('permission-blocked') || message.includes('denied')) {
      throw new Error('Notification permission was blocked in browser settings. Please allow notifications and retry.');
    }
    if (code.includes('permission-default') || message.includes('dismissed')) {
      throw new Error('Notification permission prompt was dismissed. Click "Enable notifications" to retry.');
    }
    if (code.includes('failed-service-worker-registration')) {
      throw new Error(`Service worker registration failed: ${message}`);
    }
    if (code.includes('token-subscribe-failed')) {
      throw new Error(`Failed to subscribe to FCM network: ${message}`);
    }

    throw new Error(`FCM token request failed: ${message}`);
  }
}

/**
 * Subscribe to foreground push messages.
 * Returns an unsubscribe callback.
 */
export function subscribeToForegroundMessages(
  onMessageReceived: (message: InboxMessage) => void
): () => void {
  let unsubscribe: (() => void) | null = null;
  let active = true;

  getFirebaseMessaging().then((messaging) => {
    if (!messaging || !active) return;

    try {
      unsubscribe = onMessage(messaging, (payload: MessagePayload) => {
        const id =
          payload.messageId ||
          (typeof payload.data?.messageId === 'string' ? payload.data.messageId : '') ||
          `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const title =
          payload.notification?.title ||
          (typeof payload.data?.title === 'string' ? payload.data.title : '') ||
          'Push Notification (Foreground)';

        const body =
          payload.notification?.body ||
          (typeof payload.data?.body === 'string' ? payload.data.body : '') ||
          '(No message body)';

        const receivedAt = new Date().toLocaleTimeString();

        onMessageReceived({
          id,
          title,
          body,
          receivedAt,
          rawPayload: payload as unknown as Record<string, unknown>,
        });
      });
    } catch (err) {
      console.warn('[firebase] onMessage listener failed to register:', err);
    }
  });

  return () => {
    active = false;
    if (unsubscribe) {
      unsubscribe();
    }
  };
}

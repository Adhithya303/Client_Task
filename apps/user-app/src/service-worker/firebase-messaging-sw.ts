/// <reference lib="webworker" />

import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

declare const self: ServiceWorkerGlobalScope;

// Configuration values injected by build/server definition
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.VITE_FIREBASE_APP_ID || '',
};

// Initialize Firebase in service worker
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    const app = initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    /**
     * onBackgroundMessage handler:
     * Note: In Firebase Cloud Messaging, if a message has a `notification` property
     * (such as test messages composed from the Firebase Console), FCM automatically
     * displays the system notification when the tab is in the background.
     * Calling `self.registration.showNotification` for those would produce DUPLICATE notifications.
     *
     * Therefore, we only call showNotification explicitly for DATA-ONLY payloads,
     * or when no automatic notification was provided.
     */
    onBackgroundMessage(messaging, (payload) => {
      // If the message has a notification payload, FCM handles background display automatically.
      if (payload.notification) {
        return;
      }

      // For data-only payloads, provide a fallback notification so the user is informed
      const title = payload.data?.title || 'New Notification';
      const body = payload.data?.body || 'You have received a new background message.';
      const icon = payload.data?.icon || '/favicon.svg';

      return self.registration.showNotification(title, {
        body,
        icon,
        data: {
          url: payload.data?.url || '/',
        },
      });
    });
  } catch (err) {
    console.error('[firebase-messaging-sw] Failed to initialize Firebase:', err);
  }
}

// Handle notification click events safely (only same-origin navigation)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetPath = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Find an existing open window under our same origin
      for (const client of windowClients) {
        const clientUrl = new URL(client.url, self.location.origin);
        if (clientUrl.origin === self.location.origin && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window on our origin
      if (self.clients.openWindow) {
        const safeUrl = new URL(targetPath, self.location.origin).href;
        return self.clients.openWindow(safeUrl);
      }
    })
  );
});

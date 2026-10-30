import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  type Token,
  type RegistrationError,
  type PushNotificationSchema,
  type ActionPerformed,
} from '@capacitor/push-notifications';
import type { InboxMessage } from '../types/index.ts';

/**
 * Returns true if the application is running inside a native mobile container (e.g., Capacitor Android).
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export interface NativePushCallbacks {
  onToken: (token: string) => void;
  onError: (errorMessage: string) => void;
  onMessageReceived: (message: InboxMessage) => void;
  onActionPerformed?: (action: ActionPerformed) => void;
}

/**
 * Ensures the Android default notification channel is created for Android 8.0+ (API level 26+).
 */
export async function setupAndroidNotificationChannel(): Promise<void> {
  if (!isNativeAndroid()) return;

  try {
    await PushNotifications.createChannel({
      id: 'default',
      name: 'General Notifications',
      description: 'Default notification channel for push messages',
      importance: 4, // High importance
      visibility: 1, // Public visibility on lockscreen
      sound: 'default',
      vibration: true,
      lights: true,
    });
  } catch (err) {
    console.warn('[nativePush] Error setting up Android notification channel:', err);
  }
}

/**
 * Set up listeners for native push notifications on Android.
 * Returns an unbind cleanup function to remove listeners safely and prevent duplicates.
 */
export async function initializeNativePush(
  callbacks: NativePushCallbacks
): Promise<() => void> {
  if (!isNativePlatform()) {
    return () => {};
  }

  // Ensure default channel exists
  await setupAndroidNotificationChannel();

  // Remove existing listeners before binding to prevent duplicate events
  await PushNotifications.removeAllListeners();

  const regListener = await PushNotifications.addListener(
    'registration',
    (token: Token) => {
      if (token && token.value) {
        callbacks.onToken(token.value);
      }
    }
  );

  const errorListener = await PushNotifications.addListener(
    'registrationError',
    (error: RegistrationError) => {
      const msg = error?.error || 'Native push registration failed.';
      callbacks.onError(msg);
    }
  );

  const receivedListener = await PushNotifications.addListener(
    'pushNotificationReceived',
    (notification: PushNotificationSchema) => {
      const id =
        notification.id ||
        (typeof notification.data?.messageId === 'string'
          ? notification.data.messageId
          : `android_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

      const title = notification.title || notification.data?.title || 'Push Notification';
      const body = notification.body || notification.data?.body || '(No message body)';
      const receivedAt = new Date().toLocaleTimeString();

      callbacks.onMessageReceived({
        id,
        title,
        body,
        receivedAt,
        rawPayload: {
          id: notification.id,
          title: notification.title,
          body: notification.body,
          data: notification.data,
        },
      });
    }
  );

  const actionListener = await PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action: ActionPerformed) => {
      const notification = action.notification;
      const title = notification.title || 'Notification Tapped';
      const body = notification.body || '';

      // Safe notification tap handling: validate data target without executing arbitrary external URLs
      const targetScreen =
        typeof notification.data?.targetScreen === 'string'
          ? notification.data.targetScreen.replace(/[^a-zA-Z0-9_\-/]/g, '')
          : null;

      console.info(
        `[nativePush] User tapped notification action: ${action.actionId}, screen: ${targetScreen}`
      );

      // Also deliver tapped notification to inbox if not present
      callbacks.onMessageReceived({
        id: `tap_${notification.id || Date.now()}`,
        title: `[Tapped] ${title}`,
        body,
        receivedAt: new Date().toLocaleTimeString(),
        rawPayload: notification.data || {},
      });

      if (callbacks.onActionPerformed) {
        callbacks.onActionPerformed(action);
      }
    }
  );

  return () => {
    regListener.remove();
    errorListener.remove();
    receivedListener.remove();
    actionListener.remove();
  };
}

/**
 * Requests native push notification permission and calls register().
 * Supports Android 13+ runtime permissions.
 */
export async function requestNativePushPermissionAndRegister(): Promise<void> {
  if (!isNativePlatform()) {
    throw new Error('Native push registration is only supported on native mobile devices.');
  }

  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== 'granted') {
    throw new Error(
      'Notification permission was denied on this Android device. Please enable notifications in Android Settings.'
    );
  }

  // Register device with APNs / FCM via native plugin
  await PushNotifications.register();
}

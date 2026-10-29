import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging';
import { appConfig } from '../config/env.ts';

let firebaseAppInstance: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;
let isMessagingSupportedCached: boolean | null = null;

/**
 * Check whether Firebase Cloud Messaging is supported in this browser environment.
 * Uses the official SDK isSupported() method.
 */
export async function checkIsMessagingSupported(): Promise<boolean> {
  if (isMessagingSupportedCached !== null) {
    return isMessagingSupportedCached;
  }
  try {
    isMessagingSupportedCached = await isSupported();
  } catch (err) {
    console.warn('[firebase] isSupported check failed:', err);
    isMessagingSupportedCached = false;
  }
  return isMessagingSupportedCached;
}

/**
 * Get or initialize the Firebase App client.
 * Reuses an existing initialized app if already created.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (firebaseAppInstance) {
    return firebaseAppInstance;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseAppInstance = existingApps[0];
    return firebaseAppInstance;
  }

  if (!appConfig.isFirebaseConfigComplete) {
    return null;
  }

  try {
    firebaseAppInstance = initializeApp(appConfig.firebase);
    return firebaseAppInstance;
  } catch (err) {
    console.error('[firebase] Failed to initialize Firebase App:', err);
    return null;
  }
}

/**
 * Get or initialize the Firebase Messaging client instance.
 * Returns null if messaging is unsupported or config is incomplete.
 */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (messagingInstance) {
    return messagingInstance;
  }

  const supported = await checkIsMessagingSupported();
  if (!supported) {
    return null;
  }

  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  try {
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.error('[firebase] Failed to initialize Firebase Messaging:', err);
    return null;
  }
}

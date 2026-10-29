/**
 * Typed access to the frontend environment variables.
 *
 * Vite exposes variables prefixed with VITE_ on `import.meta.env` at build time.
 * Values come from `.env.local` (git-ignored). `.env.example` is only a template.
 *
 * This module never throws: missing values are reported so the UI can explain
 * what is incomplete instead of crashing.
 */

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface AppConfig {
  firebase: FirebaseWebConfig;
  vapidKey: string;
  apiBaseUrl: string;
  /** Names of required Firebase & VAPID variables that are empty or undefined. */
  missingFirebaseKeys: string[];
  /** True when all Firebase web config keys and VAPID key have values. */
  isFirebaseConfigComplete: boolean;
  /** All missing required keys including API base URL. */
  missing: string[];
  /** True when all environment variables have values. */
  isComplete: boolean;
}

function read(value: string | undefined): string {
  return (value ?? '').trim();
}

const env = import.meta.env;

const requiredFirebase = {
  VITE_FIREBASE_API_KEY: read(env.VITE_FIREBASE_API_KEY),
  VITE_FIREBASE_AUTH_DOMAIN: read(env.VITE_FIREBASE_AUTH_DOMAIN),
  VITE_FIREBASE_PROJECT_ID: read(env.VITE_FIREBASE_PROJECT_ID),
  VITE_FIREBASE_STORAGE_BUCKET: read(env.VITE_FIREBASE_STORAGE_BUCKET),
  VITE_FIREBASE_MESSAGING_SENDER_ID: read(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  VITE_FIREBASE_APP_ID: read(env.VITE_FIREBASE_APP_ID),
  VITE_FIREBASE_VAPID_KEY: read(env.VITE_FIREBASE_VAPID_KEY),
};

const requiredAll = {
  ...requiredFirebase,
  VITE_API_BASE_URL: read(env.VITE_API_BASE_URL),
};

const missingFirebaseKeys = Object.entries(requiredFirebase)
  .filter(([, value]) => value === '')
  .map(([name]) => name);

const missing = Object.entries(requiredAll)
  .filter(([, value]) => value === '')
  .map(([name]) => name);

export const appConfig: AppConfig = {
  firebase: {
    apiKey: requiredFirebase.VITE_FIREBASE_API_KEY,
    authDomain: requiredFirebase.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: requiredFirebase.VITE_FIREBASE_PROJECT_ID,
    storageBucket: requiredFirebase.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: requiredFirebase.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: requiredFirebase.VITE_FIREBASE_APP_ID,
  },
  vapidKey: requiredFirebase.VITE_FIREBASE_VAPID_KEY,
  apiBaseUrl: requiredAll.VITE_API_BASE_URL,
  missingFirebaseKeys,
  isFirebaseConfigComplete: missingFirebaseKeys.length === 0,
  missing,
  isComplete: missing.length === 0,
};

# Project Context: Push Notification System (FARM Stack + FCM)

_Last updated: 2026-10-29 (after User App Part 2)._

## 1. Objective & Stack

Two React apps sharing one backend:

- **User app** (`apps/user-app`): requests notification permission, obtains a real FCM token,
  registers it with the backend, and receives push notifications.
- **Admin app** (`apps/admin-app`, later): form to send notifications through the backend.
  The admin/user split is a working assumption and may change.
- **Backend** (`backend/`, later): FastAPI + MongoDB + Firebase Admin SDK.
- **Android** (later): Capacitor with a native push integration, separate from web push.

Stack: React + TypeScript + Vite · Python FastAPI · MongoDB · Firebase Cloud Messaging.
FARM = FastAPI, React, MongoDB. Everything runs locally; Firebase is the only cloud service.

Team: two developers share one repository, one Firebase project (`fcm-snippet`), one
registered web app, and one public VAPID key.

---

## 2. Folder Structure (actual)

```text
Client_Task/
├── .gitignore                    # node_modules, dist, .env*, service-account JSON, keys
├── docs/
│   └── PROJECT_CONTEXT.md
└── apps/
    └── user-app/
        ├── .env.example          # blank template (tracked)
        ├── .env.local            # real public values (git-ignored)
        ├── .gitignore
        ├── .oxlintrc.json
        ├── README.md
        ├── index.html
        ├── package.json / package-lock.json
        ├── tsconfig*.json        # tsconfig.app.json, tsconfig.sw.json, tsconfig.node.json
        ├── vite.config.ts        # port 5173, strictPort, firebaseSwPlugin
        ├── public/favicon.svg
        └── src/
            ├── App.tsx           # user app dashboard + FCM state wiring
            ├── main.tsx
            ├── index.css
            ├── vite-env.d.ts     # types for VITE_ variables
            ├── components/
            │   ├── Header.tsx
            │   ├── SetupProgress.tsx
            │   ├── BrowserSupportCard.tsx
            │   ├── PermissionCard.tsx
            │   ├── FirebaseStatusCard.tsx
            │   ├── DeviceRegistrationCard.tsx
            │   ├── NotificationActionCard.tsx
            │   └── NotificationInbox.tsx
            ├── config/
            │   └── env.ts        # reads and validates VITE_ variables
            ├── hooks/
            │   └── useNotificationSupport.ts
            ├── plugins/
            │   └── firebaseSwPlugin.ts   # dev middleware + build bundler for SW
            ├── service-worker/
            │   └── firebase-messaging-sw.ts # background handler + FCM modular SW
            ├── services/
            │   ├── firebase.ts   # SDK init, isSupported check, app reuse
            │   ├── serviceWorker.ts # SW registration and activation wait
            │   └── messaging.ts  # getToken + foreground onMessage listener
            ├── styles/
            │   └── dashboard.css
            └── types/
                └── index.ts
```

---

## 3. Phases

| Phase | Description | Status |
|---|---|---|
| Context setup | Architecture baseline and this document | ✅ Done |
| User App Part 1 | Scaffold, dashboard UI, prerequisite + permission detection, env config | ✅ Done |
| User App Part 2 | Firebase SDK, messaging service worker, permission request on click, real FCM token, foreground/background messages | ✅ Done (verified) |
| User App Part 3 | FastAPI + MongoDB, device registration API, user app wiring | ⏳ Pending |
| Admin app + sending | Firebase Admin SDK send endpoint, auth/protection, admin UI | ⏳ Pending |
| Android | Capacitor, native push plugin, Android Firebase app, native token registration | ⏳ Pending |

---

## 4. Part 2 — What Was Built

- **Firebase SDK Integration:** Installed `firebase` (v13.1.0). Initialized modular client SDK with `isSupported()` check, app instance caching, and app reuse.
- **Service Worker Build Strategy:** Created `src/service-worker/firebase-messaging-sw.ts` bundled via `firebaseSwPlugin.ts`. In dev mode (`npm run dev`), the worker is bundled on-the-fly via server middleware with `Content-Type: application/javascript`. In production mode (`npm run build`), it bundles into `dist/firebase-messaging-sw.js`.
- **Duplicate Notification Prevention:** The background worker checks for `payload.notification`; if present, FCM handles background display automatically. The worker only triggers `showNotification()` for data-only payloads.
- **User-Gesture Permission Flow:** Clicking “Enable notifications” requests browser notification permission during the user gesture if in default state, registers the worker, and calls `getToken()` with the public VAPID key.
- **Token State & Security:** The FCM token is stored in memory and masked by default with "Show token" and "Copy token" actions with clipboard fallback.
- **Foreground Message Inbox:** Subscribed via `onMessage()` with React Strict Mode cleanup and deduplication by `messageId`.
- **Status Separation:** Permission granted, FCM token active, and Backend registration pending remain strictly decoupled.

---

## 5. Configuration

### User app (`apps/user-app/.env.local`, template in `.env.example`)

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase web config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase web config |
| `VITE_FIREBASE_PROJECT_ID` | Firebase web config |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase web config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase web config |
| `VITE_FIREBASE_APP_ID` | Firebase web config |
| `VITE_FIREBASE_VAPID_KEY` | Public web push key |
| `VITE_API_BASE_URL` | Backend URL (default `http://localhost:8000`) |

---

## 6. Verification Results (Part 2)

| Check | Result |
|---|---|
| `npm run build` (`tsc -b` + `vite build`) | ✅ Passed (app + SW) |
| `npm run lint` (oxlint) | ✅ 0 warnings, 0 errors |
| Service worker served in dev mode | ✅ Verified 200 OK, `application/javascript; charset=utf-8` (52.2 KB) |
| Production build preview (`vite preview`) | ✅ Verified 200 OK, `text/javascript` (52.2 KB) |
| Browser UI check (1280x800) | ✅ Setup Progress Part 2 In Progress, button enabled, 0 console errors |
| Missing config fallback | ✅ Non-blocking, reports missing variable names |

### Limitations / Untested in Headless CI:
- Actual notification permission popup (`Notification.requestPermission()`) and Google FCM token generation require manual user click in a live browser window with outbound internet access.
- End-to-end push delivery requires manual send from Firebase Console using the generated token.

---

## 7. Next Concrete Step

**User App Part 3:** Build the FastAPI backend, connect MongoDB, implement idempotent device registration endpoint (`POST /api/devices/register`), and wire the user app to sync its FCM token.

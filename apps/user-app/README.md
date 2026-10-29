# User App — Push Notification Demo

React + TypeScript + Vite app that requests notification permission, obtains a
real Firebase Cloud Messaging (FCM) token, receives real-time foreground & background
push notifications, and (in Part 3) synchronizes device tokens with a shared FastAPI backend.

**Current status: Part 2 of 3 (Firebase Browser Integration complete).**

---

## Prerequisites

- Node.js `20.19+` or `22.12+` (required by Vite 8). Check with `node -v`.
- npm (bundled with Node.js).
- Modern Chromium browser (Chrome, Edge, Brave) or Firefox.
- Internet access to connect to Google Firebase endpoints and retrieve the FCM token.

---

## 1. Setup & Configuration

Run all commands from `apps/user-app`:

```powershell
npm install
```

### Local Environment (`.env.local`)

Each teammate creates their own `.env.local` (git-ignored, never committed).
Vite does **not** read `.env.example`; that file is only a blank template.

```powershell
# Windows PowerShell
Copy-Item .env.example .env.local
```

Fill in the values in `apps/user-app/.env.local`:

| Variable | Where it comes from |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project settings → General → Web App (`apiKey`) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Web App (`authDomain`) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Web App (`projectId`) |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Web App (`storageBucket`) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Web App (`messagingSenderId`) |
| `VITE_FIREBASE_APP_ID` | Firebase Web App (`appId`) |
| `VITE_FIREBASE_VAPID_KEY` | Firebase Console → Project settings → Cloud Messaging → Web Push certificates |
| `VITE_API_BASE_URL` | `http://localhost:8000` (FastAPI backend in Part 3) |

> **Note:** Both teammates use the **same** Firebase project and web app configuration.
> Restart Vite (`npm run dev`) after creating or editing `.env.local`.

---

## 2. Running the Application

```powershell
npm run dev
```

Open `http://localhost:5173`. Always test on `localhost` (browsers only permit Service Workers and Notification permissions on HTTPS or `localhost`).

Other commands:
```powershell
npm run build     # Type check (app + SW) + production build
npm run lint      # oxlint
npm run preview   # preview production build on http://localhost:4173
```

---

## 3. Service Worker Strategy

Firebase Cloud Messaging requires a service worker named `firebase-messaging-sw.js` at root scope (`/`).

### How It Works:
1. **Source of Truth:** The service worker source is written in TypeScript at `src/service-worker/firebase-messaging-sw.ts`.
2. **Environment Variable Injection:** Service workers cannot directly access `import.meta.env`. Our custom Vite plugin (`src/plugins/firebaseSwPlugin.ts`) reads the active Vite environment configuration and defines `process.env.VITE_FIREBASE_*` constants into the bundle.
3. **Dual Execution Mode:**
   - **Development (`npm run dev`):** The plugin intercepts requests for `/firebase-messaging-sw.js` via Vite dev server middleware and serves the bundled, modular worker directly in memory.
   - **Production (`npm run build`):** The plugin bundles the worker during `closeBundle` into `dist/firebase-messaging-sw.js` with `iife` format.
4. **Duplicate Notification Prevention:**
   - For messages containing a `notification` payload (such as test messages composed in Firebase Console), the Firebase SDK automatically displays the system notification when the tab is in the background.
   - The service worker only invokes `self.registration.showNotification()` for **data-only** messages to avoid duplicate notifications.
5. **Secure Click Handling:** Notification clicks safely focus an existing tab on the same origin or open a same-origin window.

---

## 4. Manual Testing with Firebase Console (Step-by-Step)

Follow these steps to verify real push notification delivery:

### Step 1: Generate your FCM Registration Token
1. Run `npm run dev` and navigate to `http://localhost:5173`.
2. Click **“Enable notifications”**.
3. When the browser prompts "Do you want to allow notifications?", click **Allow**.
4. The dashboard will update:
   - Permission status updates to **Granted**.
   - Firebase status updates to **Connected — token active**.
   - Device registration card shows **Generated (local only)**.
5. Click **“Copy token”** (or "Show token" to inspect it).

### Step 2: Open Firebase Console Notification Composer
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project (`fcm-snippet`).
3. In the left navigation, go to **Build** → **Cloud Messaging** (or **Engage** → **Messaging**).
4. Click **New campaign** → **Notifications**.

### Step 3: Compose and Send a Test Notification
1. Enter a **Notification title** (e.g. `Test Push Message`).
2. Enter a **Notification text** (e.g. `Hello from Firebase Console!`).
3. Click the **“Send test message”** button on the right side.
4. In the dialog, paste the **FCM registration token** you copied from the app.
5. Click the **`+`** icon to add the token, then click **Test**.

### Step 4: Verify Foreground Delivery
- Keep the `http://localhost:5173` tab open and focused.
- Within 1–3 seconds, the message will appear inside the **Notification Inbox** card on the dashboard showing the title, body, timestamp, and message ID.
- No duplicate OS popup is created while focused.

### Step 5: Verify Background Delivery
- Send another test message from the Firebase Console.
- Before clicking "Test", switch to another browser tab or minimize the browser window.
- A native browser/OS notification popup will appear with the title and text.
- Clicking the notification focuses the app tab.

---

## 5. What Remains for Part 3

- **FastAPI backend:** Python REST API with token registration endpoints (`POST /api/devices/register`).
- **MongoDB persistence:** Idempotent token storage with metadata and timestamps.
- **Frontend sync:** Connecting `user-app` to persist the FCM token to the backend with clear loading, success, and error states.

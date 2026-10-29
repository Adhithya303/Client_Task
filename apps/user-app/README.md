# User App — Push Notification Demo

React + TypeScript + Vite app that requests notification permission, obtains a
real Firebase Cloud Messaging (FCM) token, receives push notifications in the foreground and
background, and automatically persists the device token to a local FastAPI + MongoDB backend.

**Current status: Part 3 Complete (Scaffold, Firebase Integration, and Backend Token Registration).**

---

## Prerequisites

- **Node.js**: `20.19+` or `22.12+` (required by Vite 8). Check with `node -v`.
- **npm**: Bundled with Node.js.
- **Modern Browser**: Chrome, Edge, Brave, or Firefox.
- **FastAPI Backend**: Running locally on `http://localhost:8000` (see `backend/README.md`).
- **MongoDB**: Running locally on port `27017`.

---

## 1. Setup & Configuration

Run from `apps/user-app`:

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
| `VITE_API_BASE_URL` | `http://localhost:8000` (FastAPI backend) |

> **Note:** Both teammates use the **same** Firebase project and web app configuration.
> Restart Vite (`npm run dev`) after creating or editing `.env.local`.

---

## 2. Running the Application (Windows PowerShell)

Open two terminals:

### Terminal 1: Start the Backend (FastAPI + MongoDB)
```powershell
cd c:\Users\adhit\Downloads\Client_Task\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 2: Start the User App (React + Vite)
```powershell
cd c:\Users\adhit\Downloads\Client_Task\apps\user-app
npm run dev
```

Open `http://localhost:5173`. Always test on `localhost` (browsers only permit Service Workers and Notification permissions on HTTPS or `localhost`).

Other commands (run from `apps/user-app`):
```powershell
npm run build     # Type check (app + SW) + production build
npm run lint      # oxlint
npm run preview   # preview production build on http://localhost:4173
```

---

## 3. End-to-End Verification with MongoDB Compass

Follow these steps to confirm token generation and idempotent MongoDB persistence:

1. **Verify Backend is Ready:**
   - In your browser, open `http://127.0.0.1:8000/docs` to inspect the FastAPI OpenAPI UI.
   - You can also test `http://127.0.0.1:8000/ready` to verify `{"status": "ready", "database": "connected"}`.

2. **Generate Token & Save to MongoDB:**
   - In the user app at `http://localhost:5173`, click **“Enable notifications”** (or **“Refresh FCM Token”**).
   - If prompted, click **Allow** in the browser permission dialog.
   - The app will retrieve an FCM token and automatically send it to `http://localhost:8000/api/devices/register`.
   - The **Device Registration** card updates to:
     - Badge: **Saved to MongoDB**
     - MongoDB Persistence: **✓ Persisted in notify collection**
     - Registration ID: Displays the real MongoDB document string ID (e.g. `672152864c3c3a4f...`)

3. **Inspect in MongoDB Compass:**
   - Open **MongoDB Compass**.
   - Connect to `mongodb://localhost:27017`.
   - Click database **`fcm_notification_demo`**.
   - Click collection **`notify`**.
   - Confirm that a document exists with fields:
     - `_id`: Document ObjectID matching the Registration ID displayed in the app.
     - `token`: Your real FCM device token.
     - `platform`: `"web"`.
     - `created_at`: Server UTC timestamp.
     - `updated_at`: Server UTC timestamp.
     - `last_seen_at`: Server UTC timestamp.

4. **Verify Idempotency (No Duplicates):**
   - Click **“Refresh FCM Token”** again in the React app.
   - Return to MongoDB Compass and click **Refresh**.
   - Verify that the total document count in `notify` has **not changed** (still 1 document for this token).
   - Verify that `created_at` was preserved while `updated_at` and `last_seen_at` were refreshed.

5. **Verify Error & Retry Handling:**
   - Stop the backend terminal (`Ctrl + C`).
   - Click **“Refresh FCM Token”**.
   - The Device Registration card will update to **Registration failed** with notice: *"Token ready — database registration failed: Could not connect to backend..."*.
   - The FCM token and notification inbox remain completely functional!
   - Restart the backend terminal, then click **“Retry registration”** in the React app.
   - The status immediately resolves to **Saved to MongoDB**.

---

## 4. What Remains for Later Milestones

- **Admin App (`apps/admin-app`)**: Interface for composing notification titles and messages and sending them to registered devices.
- **Backend Notification Sending**: Firebase Admin SDK server integration to dispatch FCM messages using service-account credentials.
- **Android Packaging**: Capacitor integration and native Android push notification handling.

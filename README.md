# Browser Push Notification System (FARM Stack + FCM)

A complete, production-pattern local demonstration of Web Push notifications built with the **FARM** stack (FastAPI, React, MongoDB) and **Firebase Cloud Messaging (FCM)**.

The system demonstrates the complete push notification lifecycle:
**Admin App** (`5174`) ➔ **FastAPI Backend** (`8000`) ➔ **Firebase Cloud Messaging** ➔ **User App** (`5173`) & OS Notification Center.

---

## Architecture Overview

```text
┌─────────────────────────┐          HTTP POST /api/admin/notifications/send
│   Admin Dashboard       │ ───────────────────────────────────────────────┐
│  (React / Vite @ 5174)  │   (Protected with X-Admin-Key header)         │
└─────────────────────────┘                                               │
                                                                          ▼
┌─────────────────────────┐      Token Registration               ┌───────────────┐
│   User Client App       │ ────────────────────────────────────► │ FastAPI App   │
│  (React / Vite @ 5173)  │   POST /api/devices/register          │ (Python 3.11+ │
└───────────┬─────────────┘                                       │    @ 8000)    │
            │                                                     └───────┬───────┘
            │                                                             │
            │ 1. Token acquisition (VAPID)                                │ Atomic Upsert
            │ 2. Background push delivery                                 │ & Token Store
            │                                                             ▼
            │                                                     ┌───────────────┐
            │                 Firebase Cloud Messaging            │ MongoDB       │
            └───────────────◄──────────────────────────────────── │ (Port 27017   │
                 Delivery               FCM HTTP v1 API           │  notify col.) │
                               (via Google Application Default    └───────────────┘
                                         Credentials)
```

### Components & Roles

1. **User Client App (`apps/user-app`)**:
   - Runs on `http://localhost:5173`.
   - Checks browser Notification & Service Worker support.
   - Requests user notification permissions.
   - Registers service worker (`firebase-messaging-sw.ts`) and retrieves a valid FCM registration token.
   - Automatically registers the token with the FastAPI backend.
   - Handles **foreground** messages via Firebase SDK `onMessage` (rendered into in-app Notification Inbox).
   - Handles **background** messages via the service worker (rendered as native OS push banners).

2. **Admin App (`apps/admin-app`)**:
   - Runs on `http://localhost:5174` (strictPort enabled).
   - In-memory admin authentication (`X-Admin-Key` header); never stores credentials in localStorage or cookies.
   - Monitors live backend, MongoDB, and Firebase Admin health.
   - Lists active registered devices (safe masked token suffixes, e.g., `...a1b2c3`).
   - Composes notification payloads with real-time live preview and character limits.
   - Dispatches notifications targeting individual registered devices.

3. **FastAPI Backend (`backend/`)**:
   - Runs on `http://localhost:8000`.
   - Manages device token persistence with atomic upsert in MongoDB (`notify` collection).
   - Protects admin routes with constant-time API key verification (`hmac.compare_digest`).
   - Initializes Firebase Admin SDK with Google Application Default Credentials (ADC).
   - Dispatches dual-payload messages (`notification` + `data`) via Firebase Admin SDK.
   - Maps FCM error responses (e.g., marks invalid/unregistered tokens inactive on HTTP 410).

4. **MongoDB (`fcm_notification_demo`)**:
   - Local document database on port `27017`.
   - Stores device registrations with a unique index on `token`.

---

## Prerequisites

Before starting the demo, ensure the following software is installed on your workstation:

- **Operating System:** Windows 10/11 (or macOS / Linux)
- **Python:** Python 3.11 or 3.12 (`python --version`)
- **Node.js:** Node.js 18+ (tested on Node.js 22 LTS, `node --version`)
- **MongoDB:** MongoDB Community Server 6.0+ listening on `127.0.0.1:27017`
- **Firebase Project:** A Firebase project (e.g. `fcm-snippet`) with:
  - Web App registered with Web Push VAPID key.
  - Service Account Private Key JSON downloaded for backend FCM sending.

---

## Configuration File Locations

The project uses three separate, Git-ignored environment files. Blank templates are tracked in Git as `.env.example`.

| Component | Real Config Path (Git-ignored) | Example Template (Tracked) | Required Variables |
|---|---|---|---|
| **Backend** | `backend/.env` | `backend/.env.example` | `MONGODB_URI`, `MONGODB_DATABASE`, `MONGODB_COLLECTION`, `CORS_ORIGINS`, `ADMIN_API_KEY`, `FIREBASE_PROJECT_ID` |
| **User App** | `apps/user-app/.env.local` | `apps/user-app/.env.example` | `VITE_FIREBASE_*` (API Key, Project ID, VAPID Key, etc.), `VITE_API_BASE_URL` |
| **Admin App** | `apps/admin-app/.env.local` | `apps/admin-app/.env.example` | `VITE_API_BASE_URL` |

> **Security Rule:**
> Private credentials (such as `ADMIN_API_KEY`, Firebase Service Account JSON, and private API keys) must **never** be committed to Git. Verify with `git check-ignore -v backend/.env apps/user-app/.env.local apps/admin-app/.env.local`.

---

## Credential Setup

### 1. Backend Service Account Setup
Download your Firebase Service Account JSON file from Firebase Console (Project Settings ➔ Service Accounts ➔ Generate new private key). Store it in a secure local path outside the repository or inside `backend/` (which ignores `*service-account*.json`).

Set the path in the terminal session before starting FastAPI:
- **PowerShell:**
  ```powershell
  $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account.json"
  ```
- **Command Prompt:**
  ```cmd
  set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
  ```

### 2. Backend Environment (`backend/.env`)
Ensure `backend/.env` exists with:
```ini
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=fcm_notification_demo
MONGODB_COLLECTION=notify
CORS_ORIGINS=["http://localhost:5173", "http://localhost:5174"]
MONGODB_SERVER_SELECTION_TIMEOUT_MS=3000
ADMIN_API_KEY=your-secure-admin-secret-key-here
FIREBASE_PROJECT_ID=fcm-snippet
FCM_REQUEST_TIMEOUT_SECONDS=10
```

### 3. User App Environment (`apps/user-app/.env.local`)
```ini
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=fcm-snippet
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_VAPID_KEY=your_public_vapid_key
VITE_API_BASE_URL=http://localhost:8000
```

### 4. Admin App Environment (`apps/admin-app/.env.local`)
```ini
VITE_API_BASE_URL=http://localhost:8000
```

---

## Windows PowerShell Startup Commands

To run the complete system, open **three separate Windows PowerShell terminals**:

### Terminal 1 — FastAPI Backend & MongoDB

Ensure MongoDB service is running first:
```powershell
# Verify MongoDB service status or start mongod
Get-Service -Name MongoDB -ErrorAction SilentlyContinue
# If running standalone mongod binary:
# mongod --dbpath C:\data\db
```

Then start the FastAPI backend:
```powershell
cd C:\D\Client_Task\backend

# Set the Firebase Admin credentials for this session
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\D\Client_Task\backend\service-account.json"

# Activate virtual environment and run Uvicorn
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000 --reload
```
*Expected log output: `Unique index on 'token' verified`, `Firebase Admin initialized`, listening on `http://127.0.0.1:8000`.*

### Terminal 2 — User Client App

```powershell
cd C:\D\Client_Task\apps\user-app
npm run dev
```
*Expected log output: Vite dev server running at `http://localhost:5173/`.*

### Terminal 3 — Admin Dashboard App

```powershell
cd C:\D\Client_Task\apps\admin-app
npm run dev
```
*Expected log output: Vite dev server running at `http://localhost:5174/` (strictPort).*

---

## End-to-End Demo Instructions

Follow these steps to demonstrate the end-to-end notification delivery:

### Step 1: Confirm System Readiness
1. Open a browser and verify backend health:
   - `http://localhost:8000/health` ➔ `{"status": "ok"}`
   - `http://localhost:8000/ready` ➔ `{"status": "ready", "database": "connected"}`

### Step 2: Register User Device
1. Open `http://localhost:5173` in Google Chrome or Microsoft Edge.
2. The User App dashboard loads and verifies browser push support.
3. Click the **"Enable notifications"** button.
4. When the browser prompts for permission, click **"Allow"**.
5. The app acquires the FCM token via service worker and registers it with FastAPI.
6. The UI updates to **"Saved to MongoDB"** with a 24-character registration ID.
7. Click the **"Inspect token details"** accordion to confirm token length and masked suffix.

### Step 3: Connect Admin App
1. Open `http://localhost:5174` in another tab or window.
2. Enter the `ADMIN_API_KEY` (configured in `backend/.env`) into the password input.
3. Click **"Connect to Backend"**.
4. The dashboard displays:
   - **System Status Card:** Backend `reachable`, MongoDB `reachable`, Firebase Admin `Initialized`.
   - **Registered Devices Card:** Table listing the newly registered web client with its masked token suffix (e.g., `...c4d5e6`) and active status.

### Step 4: Dispatch a Foreground Notification
1. In the Admin App, click the device row to select it as the target.
2. In the Composer card, enter:
   - **Title:** `Foreground Alert`
   - **Message Body:** `This notification arrives while the tab is active.`
3. Keep the **User App tab open and focused**.
4. In the Admin App, click **"Send Notification"**.
5. Observe:
   - Admin App receives `200 OK` ("Accepted by FCM") with an FCM message ID.
   - User App's **Notification Inbox** immediately displays the new notification card with timestamp and title/body.

### Step 5: Dispatch a Background Push Notification
1. In the Admin App Composer card, enter:
   - **Title:** `Background Alert`
   - **Message Body:** `This notification arrives while the tab is minimized.`
2. **Minimize or switch away** from the User App tab (`http://localhost:5173`).
3. In the Admin App, click **"Send Notification"**.
4. Observe:
   - Operating system displays a native desktop push notification banner.
   - Clicking the banner focuses the User App browser tab.
   - Exactly **one** notification is delivered; no duplicate banners appear.

---

## Two-Person Demo Setup

You can demonstrate this system with a colleague using either of two setups:

### Option A: Single Laptop Demonstration
- Both developers sit at one workstation.
- Developer 1 opens `http://localhost:5173` in Chrome (representing the client user).
- Developer 2 opens `http://localhost:5174` in Edge or Firefox (representing the administrator).
- All services run on `localhost`.

### Option B: Two Laptops Over Local Network (LAN)
Run FastAPI and MongoDB on **Laptop 1 (Backend Host)**, with each developer running frontends locally on their own laptop.

```text
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│     Laptop 1 (Backend Host)     │           │      Laptop 2 (Client Dev)      │
│  - MongoDB (localhost:27017)    │           │                                 │
│  - FastAPI (0.0.0.0:8000)       │ ◄───────┐ │  - User App (localhost:5173)   │
│  - Admin App (localhost:5174)   │         │ │    VITE_API_BASE_URL =          │
│    VITE_API_BASE_URL =          │         │ │    http://<LAPTOP_1_IP>:8000    │
│    http://<LAPTOP_1_IP>:8000    │         │ └─────────────────────────────────┘
└─────────────────────────────────┘         │
                                            │
                                            └─ Both apps register to Laptop 1
```

#### Step-by-Step Configuration for Option B:

1. **Obtain Backend Host LAN IP:**
   - On Laptop 1, run `ipconfig` in PowerShell.
   - Note the IPv4 Address on the local Wi-Fi / Ethernet adapter (e.g., `192.168.1.50`).

2. **Bind FastAPI to the LAN Interface:**
   - In Laptop 1's backend terminal, start Uvicorn with `--host 0.0.0.0`:
     ```powershell
     .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
     ```

3. **Allow Backend Port Through Windows Firewall:**
   - On Laptop 1, ensure Windows Firewall permits incoming TCP traffic on port `8000`:
     ```powershell
     New-NetFirewallRule -DisplayName "FastAPI Push Demo" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
     ```

4. **Keep MongoDB Local and Protected:**
   - MongoDB remains bound to `127.0.0.1:27017` on Laptop 1. **Do not** expose port 27017 over the LAN. FastAPI connects to MongoDB locally.

5. **Serve Browser Frontends via `localhost` on Each Laptop:**
   - Web Push and Service Workers require a **Secure Context** (`https://` or `http://localhost`).
   - Run Vite on `localhost:5173` and `localhost:5174` on both machines. Do **not** access the frontend via `http://192.168.1.50:5173`, or browsers will disable the Service Worker and Notification APIs.

6. **Configure Frontend API URLs:**
   - On Laptop 1 and Laptop 2, update `.env.local`:
     ```ini
     VITE_API_BASE_URL=http://192.168.1.50:8000
     ```
   - **Important:** Restart the Vite development servers after updating `.env.local` (`Ctrl+C` then `npm run dev`).

7. **Update Backend CORS Configuration:**
   - On Laptop 1, update `CORS_ORIGINS` in `backend/.env` to allow incoming origins:
     ```ini
     CORS_ORIGINS=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"]
     ```

8. **Execute Joint Demo:**
   - Both developers open `http://localhost:5173` on their laptops and click "Enable notifications".
   - Both devices register their respective FCM tokens into the single MongoDB database on Laptop 1.
   - The administrator on Laptop 1 refreshes the device list in `http://localhost:5174`, seeing both devices.
   - The administrator can send individual notifications to either developer's laptop!

> **Security Notice:**
> The shared admin key is intended solely for local and trusted LAN demonstrations. Production deployments require TLS/HTTPS, user authentication (OAuth2/OIDC/JWT), session cookies, and database encryption.

---

## Troubleshooting

### 1. Browser Notification Permission Denied or Not Prompting
- **Symptom:** Permission status shows "denied" or clicking "Enable notifications" does nothing.
- **Cause:** Notifications were previously blocked in browser site settings.
- **Fix:** Click the padlock/settings icon on the left side of the browser URL bar ➔ Reset site permissions for Notifications to "Ask" or "Allow" ➔ Refresh the page.

### 2. Service Worker Registration Fails
- **Symptom:** Console error: `Failed to register a ServiceWorker: The URL protocol of the current origin ('http://...') is not supported`.
- **Cause:** The site is being served over an unencrypted IP address (e.g. `http://192.168.1.50:5173`).
- **Fix:** Access the web app using `http://localhost:5173`. Modern browsers treat `localhost` as a secure context.

### 3. Backend Reports `CREDENTIALS_MISSING`
- **Symptom:** `GET /api/admin/status` reports `firebase_admin.state: "unavailable"` with reason `CREDENTIALS_MISSING`.
- **Cause:** `GOOGLE_APPLICATION_CREDENTIALS` was not set in the active PowerShell terminal session.
- **Fix:** Run `$env:GOOGLE_APPLICATION_CREDENTIALS="C:\full\path\to\service-account.json"` in the terminal running uvicorn, then restart FastAPI.

### 4. CORS Errors in Frontend Console
- **Symptom:** Browser blocks fetch with `No 'Access-Control-Allow-Origin' header is present on the requested resource`.
- **Cause:** Vite is running on an unexpected port (e.g., 5175 instead of 5174) or CORS origins list is missing the origin.
- **Fix:**
  - Verify `strictPort: true` is set in both `vite.config.ts` files.
  - Check `backend/.env` has `CORS_ORIGINS=["http://localhost:5173", "http://localhost:5174"]`.

### 5. MongoDB Connection Timeout (HTTP 503)
- **Symptom:** `GET /ready` returns `503 Service Unavailable`.
- **Cause:** Local MongoDB service is not running.
- **Fix:** Open PowerShell as Administrator and run `net start MongoDB` or run `mongod` manually.

---

## Automated Verification Suite

Run all verification suites locally to confirm system integrity:

```powershell
# 1. Backend test suite (34 unit & integration tests)
cd C:\D\Client_Task\backend
.\.venv\Scripts\python.exe -m pytest -v

# 2. User App TypeScript & Lint checks
cd C:\D\Client_Task\apps\user-app
npm run build
npm run lint

# 3. Admin App TypeScript & Lint checks
cd C:\D\Client_Task\apps\admin-app
npm run build
npm run lint

# 4. Git secret exclusion check
cd C:\D\Client_Task
git check-ignore -v backend/.env apps/user-app/.env.local apps/admin-app/.env.local
```

For the step-by-step manual test checklist, see [`docs/DEMO_CHECKLIST.md`](file:///c:/D/Client_Task/docs/DEMO_CHECKLIST.md).

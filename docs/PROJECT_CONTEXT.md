# Project Context: Push Notification System (FARM Stack + FCM)

_Last updated: 2026-10-29 (after Part 3: Backend & Database Registration)._

## 1. Objective & Stack

Two React apps sharing one backend:

- **User app** (`apps/user-app`): requests notification permission, obtains a real FCM token,
  registers it with the backend, and receives push notifications.
- **Admin app** (`apps/admin-app`, later milestone): form to send notifications through the backend.
  The admin/user split is a working assumption and may change.
- **Backend** (`backend/`): FastAPI + MongoDB + Firebase Admin SDK (sending added in later milestone).
- **Android** (later milestone): Capacitor with a native push integration, separate from web push.

Stack: React + TypeScript + Vite · Python 3.12 FastAPI · MongoDB · Firebase Cloud Messaging.
FARM = FastAPI, React, MongoDB. Everything runs locally; Firebase is the only cloud service.

Team: two developers share one repository, one Firebase project (`fcm-snippet`), one
registered web app, and one public VAPID key.

---

## 2. Folder Structure (actual)

```text
Client_Task/
├── .gitignore                    # node_modules, dist, .venv, .env*, service-account JSON, keys
├── docs/
│   └── PROJECT_CONTEXT.md
├── apps/
│   └── user-app/
│       ├── .env.example          # blank template (tracked)
│       ├── .env.local            # real public values (git-ignored)
│       ├── .gitignore
│       ├── .oxlintrc.json
│       ├── README.md
│       ├── index.html
│       ├── package.json / package-lock.json
│       ├── tsconfig*.json        # tsconfig.app.json, tsconfig.sw.json, tsconfig.node.json
│       ├── vite.config.ts        # port 5173, strictPort, firebaseSwPlugin
│       ├── public/favicon.svg
│       └── src/
│           ├── App.tsx           # user app dashboard + token sync state
│           ├── main.tsx
│           ├── index.css
│           ├── vite-env.d.ts     # types for VITE_ variables
│           ├── components/
│           │   ├── Header.tsx
│           │   ├── SetupProgress.tsx
│           │   ├── BrowserSupportCard.tsx
│           │   ├── PermissionCard.tsx
│           │   ├── FirebaseStatusCard.tsx
│           │   ├── DeviceRegistrationCard.tsx
│           │   ├── NotificationActionCard.tsx
│           │   └── NotificationInbox.tsx
│           ├── config/
│           │   └── env.ts        # reads and validates VITE_ variables
│           ├── hooks/
│           │   └── useNotificationSupport.ts
│           ├── plugins/
│           │   └── firebaseSwPlugin.ts   # dev middleware + build bundler for SW
│           ├── service-worker/
│           │   └── firebase-messaging-sw.ts # background handler + FCM modular SW
│           ├── services/
│           │   ├── api.ts        # FastAPI device registration client with timeout
│           │   ├── firebase.ts   # SDK init, isSupported check, app reuse
│           │   ├── serviceWorker.ts # SW registration and activation wait
│           │   └── messaging.ts  # getToken + foreground onMessage listener
│           ├── styles/
│           │   └── dashboard.css
│           └── types/
│               └── index.ts
└── backend/
    ├── .env.example              # template with default local MongoDB config
    ├── .env                      # local backend config (git-ignored)
    ├── .venv/                    # Python 3.12 virtual environment
    ├── README.md                 # backend setup, API contract, Compass testing
    ├── pytest.ini                # pythonpath = . configuration
    ├── requirements.txt          # fastapi, pydantic, pydantic-settings, uvicorn, pymongo, pytest, httpx
    ├── app/
    │   ├── __init__.py
    │   ├── main.py               # FastAPI lifespan, CORS, health & ready probes
    │   ├── config.py             # Pydantic Settings, predictable .env path
    │   ├── database.py           # MongoClient lifecycle, ping, unique index, atomic upsert
    │   ├── schemas.py            # DeviceRegisterRequest/Response schemas (forbid extra)
    │   └── routes/
    │       ├── __init__.py
    │       └── devices.py        # POST /api/devices/register route
    └── tests/
        ├── __init__.py
        ├── conftest.py           # test fixtures using fcm_notification_demo_test
        └── test_devices.py       # 10 automated unit & integration tests
```

---

## 3. Phases & Status

| Phase | Description | Status |
|---|---|---|
| Context setup | Architecture baseline and tracking document | ✅ Done |
| User App Part 1 | Scaffold, dashboard UI, prerequisite + permission detection, env config | ✅ Done |
| User App Part 2 | Firebase SDK, messaging service worker, permission request on click, real FCM token, foreground/background messages | ✅ Done |
| User App Part 3 | FastAPI backend & MongoDB connection, device token registration API, user app wiring | ✅ Done (verified) |
| Admin App & Sending | Notification sending backend API (Firebase Admin SDK), admin composer UI | ⏳ Pending |
| Android Packaging | Capacitor integration, native push plugin, Android Firebase app, native token registration | ⏳ Pending |

---

## 4. Part 3 — What Was Built

- **FastAPI Service:**
  - Built with Python 3.12, Uvicorn, and PyMongo.
  - Predictable `.env` loading using `Path(__file__).resolve().parent.parent / ".env"`.
  - Strict CORS middleware allowing only configured frontend origins (`http://localhost:5173`).
  - Lifespan context manager: validates MongoDB connectivity on startup, ensures unique index on `token`, and gracefully closes client on shutdown.
  - Sanitized error handling: returns HTTP 503 if database connectivity fails without leaking credentials or raw exceptions.
- **MongoDB Persistence:**
  - Target database: `fcm_notification_demo`
  - Collection: `notify`
  - Unique index on `token`.
  - Atomic upsert via `find_one_and_update` with `$setOnInsert: {"created_at": now}` and `$set: {"platform": "web", "updated_at": now, "last_seen_at": now}`.
  - Concurrent duplicate-key race condition handling.
- **Frontend Token Registration:**
  - `src/services/api.ts`: Typed client with request timeout (`AbortController`), contract validation, and network error sanitization.
  - Connected `apps/user-app/src/App.tsx`:
    - After obtaining real FCM token, automatically sends `POST /api/devices/register`.
    - Updates UI from "Saving token..." to "Saved to MongoDB" with real MongoDB `registration_id`.
    - Retains token and message listener even if database registration fails.
    - Provides a dedicated "Retry registration" button that retries only the API request without re-prompting for permissions or regenerating the token.
    - Handles token changes safely with in-flight request guards.

---

## 5. API Contracts

### `GET /health`
Liveness check.
- **Status**: `200 OK`
- **Response**: `{"status": "ok"}`

### `GET /ready`
Readiness check verifying MongoDB ping.
- **Status**: `200 OK` when ready (`{"status": "ready", "database": "connected"}`)
- **Status**: `503 Service Unavailable` if MongoDB is down.

### `POST /api/devices/register`
Idempotent device token registration.
- **Request Body**:
  ```json
  {
    "token": "<real FCM registration token>",
    "platform": "web"
  }
  ```
- **Validation**:
  - `token`: Required, 10–500 chars, no whitespace characters.
  - `platform`: Must be `"web"`.
  - Unexpected fields forbidden (`extra="forbid"`).
- **Response**:
  ```json
  {
    "status": "registered",
    "registration_id": "<MongoDB document ID string>"
  }
  ```
- **Status**: `200 OK` for both initial and repeated registrations.
- **Token Masking**: Never returns the token in the response body or logs.

---

## 6. Environment Variables

### User App (`apps/user-app/.env.local`, template in `.env.example`)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY`
- `VITE_API_BASE_URL=http://localhost:8000`

### Backend (`backend/.env`, template in `.env.example`)
- `MONGODB_URI=mongodb://localhost:27017`
- `MONGODB_DATABASE=fcm_notification_demo`
- `MONGODB_COLLECTION=notify`
- `CORS_ORIGINS=["http://localhost:5173"]`
- `MONGODB_SERVER_SELECTION_TIMEOUT_MS=3000`

---

## 7. Verification Results (Part 3)

| Check | Result |
|---|---|
| Backend Test Suite (`pytest -v`) | ✅ 10 tests passed in 0.17s (valid registration, idempotency, timestamps, validation, 503 simulation) |
| Test DB Isolation | ✅ Verified: tests use `fcm_notification_demo_test` and clean up only test records |
| Frontend Build (`tsc -b && vite build`) | ✅ Passed with 0 errors |
| Frontend Lint (`oxlint`) | ✅ 0 warnings, 0 errors across 21 files |
| Backend Live Execution (`uvicorn`) | ✅ Connected to local MongoDB port 27017, unique index verified |
| Backend `/health` & `/ready` Probes | ✅ Verified HTTP 200 responses |
| CORS Preflight (`OPTIONS /api/devices/register`) | ✅ Verified HTTP 200, `Access-Control-Allow-Origin: http://localhost:5173` |
| Browser Preview (User App) | ✅ Dashboard displays Phase 3 active, Device Registration card, 0 console errors |

---

## 8. Next Concrete Step

**Admin App & Notification Sending Flow:**
- Implement backend notification dispatch endpoint using Firebase Admin SDK with service-account credentials.
- Scaffold `apps/admin-app` with notification composer (title, message, target device selector) and backend dispatch.

# Project Context: Push Notification System (FARM Stack + FCM)

_Last updated: 2026-10-29 (after Part 4: Firebase Admin init + admin API key)._

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
│   └── admin-app/
│       ├── .env.example          # VITE_API_BASE_URL=http://localhost:8000
│       ├── .env.local            # git-ignored
│       ├── .gitignore
│       ├── .oxlintrc.json
│       ├── README.md             # admin-app docs & three-terminal guide
│       ├── index.html
│       ├── package.json
│       ├── tsconfig*.json
│       ├── vite.config.ts        # port 5174, strictPort: true
│       └── src/
│           ├── App.tsx           # in-memory admin key, dashboard coordinator
│           ├── main.tsx
│           ├── index.css
│           ├── vite-env.d.ts
│           ├── components/
│           │   ├── Header.tsx
│           │   ├── ConnectCard.tsx
│           │   ├── StatusCard.tsx
│           │   ├── DeviceListCard.tsx
│           │   ├── ComposerCard.tsx
│           │   └── SendHistoryCard.tsx
│           ├── services/
│           │   └── api.ts        # typed admin API client (in-memory key, timeout, error mapping)
│           ├── styles/
│           │   └── admin.css
│           └── types/
│               └── index.ts
└── backend/
    ├── .env.example              # template with default local MongoDB config
    ├── .env                      # local backend config (git-ignored)
    ├── .venv/                    # Python virtual environment
    ├── README.md                 # backend setup, API contract, Compass testing
    ├── pytest.ini                # pythonpath = . configuration
    ├── requirements.txt          # fastapi, pydantic, pydantic-settings, uvicorn, pymongo, pytest, httpx, firebase-admin
    ├── app/
    │   ├── __init__.py
    │   ├── main.py               # FastAPI lifespan, CORS, health & ready probes
    │   ├── config.py             # Pydantic Settings, predictable .env path
    │   ├── database.py           # MongoClient lifecycle, ping, unique index, atomic upsert
    │   ├── schemas.py            # DeviceRegisterRequest/Response schemas (forbid extra)
    │   └── routes/
    │       ├── __init__.py
    │       ├── devices.py        # POST /api/devices/register route
    │       └── admin.py          # GET /api/admin/status, /devices, POST /notifications/send
    │   ├── auth.py               # require_admin_key dependency (X-Admin-Key, constant-time)
    │   └── firebase.py           # Firebase Admin init (ADC, once), send_fcm_notification
    └── tests/
        ├── __init__.py
        ├── conftest.py           # test fixtures using fcm_notification_demo_test
        ├── test_devices.py       # 10 automated unit & integration tests
        ├── test_admin.py         # 11 tests: admin key, mocked Firebase status, registration intact
        └── test_notifications.py # 13 tests: device listing, sending, error mapping, reactivation
```

---

## 3. Phases & Status

| Phase | Description | Status |
|---|---|---|
| Context setup | Architecture baseline and tracking document | ✅ Done |
| User App Part 1 | Scaffold, dashboard UI, prerequisite + permission detection, env config | ✅ Done |
| User App Part 2 | Firebase SDK, messaging service worker, permission request on click, real FCM token, foreground/background messages | ✅ Done |
| User App Part 3 | FastAPI backend & MongoDB connection, device token registration API, user app wiring | ✅ Done (verified) |
| Backend Part 4 | Firebase Admin init (ADC), admin API key dependency, `GET /api/admin/status` | ✅ Done |
| Backend Part 5 | Device listing (`GET /api/admin/devices`), notification dispatch (`POST /api/admin/notifications/send`), inactive tracking | ✅ Done (34 tests pass) |
| Admin App (UI) | Admin composer UI on port 5174 (device selector, compose, send) | ✅ Done (built, verified build & lint) |
| Android Integration | Capacitor 8 packaging, native push notifications, Android payload config, unregister API | ✅ Done (verified) |
| Production Hardening | OAuth2/JWT auth, bcrypt password hashing, CLI provisioning, token unregistration | ✅ Done (43 tests pass) |
| Manual Demo Run | End-to-end multi-app live delivery demonstration | ⏳ Ready for manual operator run (see `docs/DEMO_CHECKLIST.md`) |

---

## 4. Part 3 — What Was Built

- **FastAPI Service:**
  - Built with Python 3.11+, Uvicorn, and PyMongo.
  - Predictable `.env` loading using `Path(__file__).resolve().parent.parent / ".env"`.
  - Strict CORS middleware allowing only configured frontend origins (`http://localhost:5173`, `http://localhost:5174`).
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

## 4b. Part 4 — Firebase Admin Init & Admin Access

- **Firebase Admin** (`app/firebase.py`, `firebase-admin` 7.x): Application Default Credentials via
  `GOOGLE_APPLICATION_CREDENTIALS` in the **server process environment** (never `.env`, never frontend).
  Initialized once at startup and reused; failure is non-fatal and recorded as a sanitized reason code.
  Expected project is `FIREBASE_PROJECT_ID` (`fcm-snippet`); credentials for another project are rejected.
  **"Initialized" does not prove permission to send FCM messages.**
- **Admin auth** (`app/auth.py`): `require_admin_key` dependency, `X-Admin-Key` header vs `ADMIN_API_KEY`,
  `hmac.compare_digest`; denies if missing/incorrect/unconfigured; key never logged. Local-demo only.
  `/api/devices/register` is unchanged and does not require the key.
- **`GET /api/admin/status`**: backend / MongoDB / Firebase Admin state; no secrets, paths, tokens, or raw errors.
- Tests at this stage: 21 pass (Firebase mocked). Sending and the admin app were added in later parts (see 4c).

---

## 4c. Admin App (`apps/admin-app`, port 5174)

- React + TypeScript + Vite, `strictPort: true` on **5174** (CORS allows 5173 and 5174 explicitly).
- Only config: `VITE_API_BASE_URL=http://localhost:8000` (`.env.example` tracked, `.env.local` git-ignored).
  No Firebase config, VAPID key, service worker, or notification permission.
- **Admin key:** entered on a "Connect to Backend" screen, verified via `GET /api/admin/status`, held only in
  React memory (no localStorage/sessionStorage/URL/console, no `VITE_ADMIN_API_KEY`). **Refreshing the page or
  closing the tab clears it; the key must be re-entered.** Disconnect clears the key, devices, selection and history.
  A 401 from any call also clears the session.
- **Dashboard:** backend/MongoDB/Firebase-initialization status (init is not verified sending), paginated device
  list (`GET /api/admin/devices`, page size 10, refresh, loading/empty/error states, masked suffix only, inactive
  devices not selectable), composer (title ≤100, body ≤1000 with counters and live preview), session send history
  (bounded to 15, in-memory).
- **Send:** one `POST /api/admin/notifications/send` at a time; shows "Accepted by FCM" + message ID only after a valid
  `accepted` response, never "delivered". Form content is kept on failure; no automatic retry; timeouts warn about
  duplicate risk.
- `src/services/api.ts`: typed client, 10 s timeout, response-shape validation, readable error mapping, no header logging.
- **Not included:** broadcast, scheduling, uploads, analytics.

### Running everything (three terminals)
1. **FastAPI (8000)** — in `backend/`: set `GOOGLE_APPLICATION_CREDENTIALS` (PowerShell `$env:...="path"`, cmd `set ...=path`),
   then `.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000 --reload`. MongoDB must be running.
2. **User app (5173)** — in `apps/user-app`: `npm run dev`; click "Enable notifications" to register a token.
3. **Admin app (5174)** — in `apps/admin-app`: `npm run dev`; connect with `ADMIN_API_KEY` from `backend/.env`.

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

### `GET /api/admin/status`
Requires header `X-Admin-Key` (401 if missing/incorrect/server key unset). Returns
`backend`, `mongodb`, and `firebase_admin` (`state` initialized|unavailable, sanitized `reason`) plus a notice that
initialization is not verified sending.

### `GET /api/admin/devices`
Requires header `X-Admin-Key`. Query params: `limit` (default 50, max 100), `offset` (default 0).
Returns paginated devices sorted by `last_seen_at` descending. Full tokens are never returned, only short masked suffixes (`...suffix`). Includes `is_active` status.

### `POST /api/admin/notifications/send`
Requires header `X-Admin-Key`.
Request body:
```json
{
  "registration_id": "<24-hex MongoDB ObjectId>",
  "title": "<1-100 chars>",
  "body": "<1-1000 chars>"
}
```
Looks up token on server from MongoDB. Validates document ID, limits, and active status.
Dispatches push notification via Firebase Admin SDK. Returns status `"accepted"` with `message_id` and `registration_id`.
If FCM reports the token permanently unregistered (`messaging.UnregisteredError`), returns `410 Gone`, marks the MongoDB record `is_active: false` with timestamp `unregistered_at`, and prevents further sends until re-registered.

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
- `CORS_ORIGINS=["http://localhost:5173", "http://localhost:5174"]`
- `MONGODB_SERVER_SELECTION_TIMEOUT_MS=3000`
- `ADMIN_API_KEY` (random secret, generated locally into git-ignored `.env`; never a `VITE_` variable)
- `FIREBASE_PROJECT_ID=fcm-snippet`
- `FCM_REQUEST_TIMEOUT_SECONDS=10`
- `GOOGLE_APPLICATION_CREDENTIALS` — **not in `.env`**; set in the backend terminal before starting uvicorn.

---

## 7. Verification Results

| Check | Result |
|---|---|
| Backend Test Suite (`pytest -v`) | ✅ 46 tests passed in 2.64s (device registration, web & android platforms, unregistration, admin auth, OAuth2/JWT verification, bcrypt hashing, login rate limiting, payload vs token InvalidArgument handling, safe device listing, notification sending, FCM error mapping, reactivation, timeout simulation) |
| Test DB Isolation | ✅ Verified: tests use `fcm_notification_demo_test` and clean up only test records |
| User App Build (`tsc -b && vite build`) | ✅ Passed with 0 errors |
| User App Lint (`oxlint`) | ✅ 0 warnings, 0 errors across 23 files |
| User App Android Sync (`cap:build`) | ✅ Verified: Capacitor 8 Android project synchronized in 0.125s |
| Admin App Build (`tsc -b && vite build`) | ✅ Passed with 0 errors |
| Admin App Lint (`oxlint`) | ✅ 0 warnings, 0 errors across 12 files |
| Admin App UI Authentication | ✅ Verified: pure OAuth2 Username/Password login; API-key login tab removed |
| Git Exclusions Verification | ✅ Verified: `git check-ignore -v` confirms `backend/.env`, keystores, and credentials are strictly ignored |
| API Authorization & JWT | ✅ Verified: strict OAuth2 Bearer JWT authorization; legacy `X-Admin-Key` fallback removed from production and tests |
| Login Rate Limiting | ✅ Verified: 5 failed attempts per 60s per IP+username enforced; 6th returns 429 Too Many Requests |
| FCM Invalid Argument Distinction | ✅ Verified: malformed message payloads preserve device tokens; invalid token syntax marks tokens inactive |
| Android Network Security | ✅ Verified: `network_security_config.xml` enforces HTTPS in release builds and restricts cleartext HTTP to local debug domains (`10.0.2.2`) |
| Missing Credential Handling | ✅ Verified: missing `GOOGLE_APPLICATION_CREDENTIALS` results in clean degraded status, never 500 crashes |

---

## 8. Android & Production Hardening Summary

1. **Capacitor Android Packaging:**
   - Package ID: `com.fcm.notificationdemo` (configured in `capacitor.config.ts` and `AndroidManifest.xml`).
   - Official plugin: `@capacitor/push-notifications` (v8.1.3).
   - Gradle Google Services plugin wired in `android/build.gradle` and `android/app/build.gradle`.
   - Android notification channel `default` created with high importance and lockscreen visibility.
   - Network security config (`network_security_config.xml`) enforcing HTTPS in release builds while permitting `10.0.2.2` and `localhost` in debug builds.
   - Default notification icon (`@mipmap/ic_launcher`) and notification accent color (`@color/colorPrimary`).

2. **Native Push Integration:**
   - Platform-aware `src/services/nativePush.ts` service:
     - On browser: executes modular web Firebase SDK and service worker.
     - On native Android: executes Capacitor native push plugin; suppresses browser service-worker initialization to avoid conflicts.
     - Android 13+ runtime notification permissions (`POST_NOTIFICATIONS`) requested during user gesture with recovery detection on window focus / app state change.
     - Automatic backend synchronization for native FCM tokens under `platform: "android"` with retry backoff for transient failures.
     - In-app notification inbox integration for foreground messages (`pushNotificationReceived`).
     - Safe notification tap handling (`pushNotificationActionPerformed`) validating navigation targets without arbitrary URL execution.

3. **Backend Registration & Payloads:**
   - Backend accepts `platform: "android"` and `platform: "web"`.
   - Added `POST /api/devices/unregister` to mark tokens inactive upon logout or notification disablement.
   - Enhanced `send_fcm_notification` with `AndroidConfig` (`channel_id="default"`, `priority="high"`, standard launcher intent) and optional string-valued custom data payloads.
   - `InvalidArgumentError` handling distinguishes between malformed message payloads (preserving active token status) and invalid token syntax (deactivating token).

4. **Production Authentication & Security:**
   - OAuth2 Password Grant endpoint: `POST /api/auth/token`.
   - Generates signed JWTs (HS256) verifying `exp` (60m), `iat`, `iss`, and `aud`.
   - Secure password hashing using `bcrypt` (12 rounds) with random salts.
   - Login rate limiter rejects brute-force attacks (>5 attempts/min) with HTTP 429.
   - CLI provisioning tool (`python -m app.cli create-admin`) ensures no public endpoint can create administrative accounts.
   - Legacy `X-Admin-Key` production fallback removed; all protected endpoints require valid Bearer JWT.
   - In-memory token storage in Admin React UI (cleared on logout or 401 session expiry).

5. **Milestone Completion & Test Status:**
   - Automated Unit & Integration Tests: ✅ All 46 tests passing.
   - Web Notification Delivery: ✅ Verified previously with real FCM web tokens.
   - Android APK Compilation: ⏸ Blocked in current environment because Android SDK (`ANDROID_HOME`) is not installed on this machine and Gradle wrapper download timed out. Requires Android Studio or local Android SDK command line tools.
   - Physical Device Delivery: ⏳ Pending actual manual test on physical Android hardware once debug APK is installed.



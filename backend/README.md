# Push Notification Backend (FastAPI + MongoDB)

FastAPI service that manages FCM device token registrations in a local MongoDB database
(part of the FARM stack: FastAPI, React, MongoDB).

**Current status: Part 4 (Firebase Admin initialization + admin API key; sending not yet implemented).**

---

## Prerequisites

- **Python**: 3.12 (`python --version` or `py -3.12 --version`)
- **MongoDB**: Community Server running locally on default port `27017`
  - Verify via MongoDB Compass at `mongodb://localhost:27017`
- **User App**: React client running on `http://localhost:5173`

---

## 1. Setup & Installation (Windows PowerShell)

Run all commands from `backend/`:

```powershell
# 1. Create a Python 3.12 virtual environment
py -3.12 -m venv .venv

# 2. Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# 3. Install dependencies
python -m pip install -r requirements.txt
```

---

## 2. Configuration (`.env`)

A `.env.example` file is provided with sensible development defaults.
Copy it to `.env` if not already created:

```powershell
Copy-Item .env.example .env
```

| Variable | Default Value | Description |
|---|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017` | Local MongoDB connection URI |
| `MONGODB_DATABASE` | `fcm_notification_demo` | Target database name |
| `MONGODB_COLLECTION` | `notify` | Collection name for device registrations |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | JSON array of allowed frontend origins |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | `3000` | Client connection timeout in milliseconds |
| `ADMIN_API_KEY` | _(empty)_ | Shared local-demo admin key, sent as `X-Admin-Key`. If empty, **all admin routes deny access**. |
| `FIREBASE_PROJECT_ID` | _(empty)_ | Expected Firebase project ID (e.g. `fcm-snippet`). Firebase Admin stays unavailable if empty or if credentials belong to another project. |

### Firebase server credentials (not in `.env`)

`GOOGLE_APPLICATION_CREDENTIALS` is read from the **server process environment** (Application
Default Credentials). Set it in the terminal that starts uvicorn, **before** starting the server:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\outside\repo\fcm-service-account.json"   # PowerShell
```
```bat
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\outside\repo\fcm-service-account.json         :: cmd.exe
```

Keep the JSON file outside the repository. The backend never prints, returns, or copies it,
and it must never go into any `VITE_` variable or frontend code.

> **Admin key:** `ADMIN_API_KEY` is a simple shared secret for this local learning demo. It is
> **not** production user authentication. Never expose it as a `VITE_` variable; the future admin
> app will have the operator type it in and hold it in memory only.

> **Security Note:**
> - Never commit `.env` to Git (it is excluded by `.gitignore`).
> - The MongoDB URI is strictly kept on the backend and never exposed to frontend apps.
> - CORS is restricted to explicit development frontend origins (`http://localhost:5173`).
> - CORS restricts browser access from other origins, but it is **not authentication**. This registration endpoint is designed for local development; rate limiting and authentication controls must be added before public internet exposure.

---

## 3. Running the Backend

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The server binds to `127.0.0.1:8000`:
- **API Base**: `http://127.0.0.1:8000`
- **Interactive OpenAPI Docs**: `http://127.0.0.1:8000/docs`
- **Alternative ReDoc**: `http://127.0.0.1:8000/redoc`

---

## 4. API Contract

### `GET /health`
Liveness check.
- **Status**: `200 OK`
- **Response**: `{"status": "ok"}`
- Does not expose credentials or connection strings.

### `GET /ready`
Readiness check. Pings MongoDB to confirm live database connectivity.
- **Status**: `200 OK` when ready (`{"status": "ready", "database": "connected"}`)
- **Status**: `503 Service Unavailable` if MongoDB is down or unreachable.

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
  - `token`: Required, 10–500 characters, no embedded whitespace.
  - `platform`: Must be `"web"`.
  - Extra unexpected fields are rejected (`extra="forbid"`).
  - FCM tokens are device identifiers, not user identities.
- **Response**:
  ```json
  {
    "status": "registered",
    "registration_id": "672152864c3c3a4f89d891b0"
  }
  ```
- **Status**: `200 OK` for both initial registration and repeated registrations.
- **Token Masking**: The full token is never echoed back in responses or printed to logs.
- Does **not** require the admin key.

### `GET /api/admin/status` (admin key required)
Header: `X-Admin-Key: <ADMIN_API_KEY>`. Missing/incorrect key, or no server key configured → `401`.
Comparison is constant-time (`hmac.compare_digest`); the key is never logged.
```json
{
  "backend": "reachable",
  "mongodb": "reachable",
  "firebase_admin": {"state": "initialized", "reason": null, "message": null},
  "notice": "'initialized' means server credentials loaded for the expected project. It does not verify permission to send, and no notification has been sent."
}
```

### `GET /api/admin/devices` (admin key required)
Header: `X-Admin-Key: <ADMIN_API_KEY>`.
Query Parameters:
- `limit`: Integer (1–100, default 50).
- `offset`: Integer (>= 0, default 0).

Returns a bounded, paginated list of registered devices sorted by recent activity (`last_seen_at` descending):
```json
{
  "devices": [
    {
      "registration_id": "672152864c3c3a4f89d891b0",
      "platform": "web",
      "token_suffix": "...123456",
      "created_at": "2026-10-29T16:50:00Z",
      "last_seen_at": "2026-10-29T17:15:00Z",
      "is_active": true
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```
- **Token Protection:** Full FCM tokens are strictly never exposed; only a short suffix is returned.
- `is_active`: Indicates if the token is active. Tokens reported permanently unregistered by FCM are marked `false`.

### `POST /api/admin/notifications/send` (admin key required)
Header: `X-Admin-Key: <ADMIN_API_KEY>`.
Request Body:
```json
{
  "registration_id": "672152864c3c3a4f89d891b0",
  "title": "New Update",
  "body": "A new notification from the admin app."
}
```
- **Validation & Limits:**
  - `registration_id`: Required valid 24-character hexadecimal MongoDB ObjectId string.
  - `title`: Required, 1–100 characters, whitespace-only rejected.
  - `body`: Required, 1–1000 characters, whitespace-only rejected.
  - Unexpected fields are forbidden (`extra="forbid"`).
  - Arbitrary client-supplied tokens are rejected; tokens are looked up from MongoDB on the server.
- **Response (`200 OK`):**
  ```json
  {
    "status": "accepted",
    "message_id": "projects/fcm-snippet/messages/0:1730222000000000%abc123",
    "registration_id": "672152864c3c3a4f89d891b0"
  }
  ```
- **Semantics:** Status is `"accepted"` once Firebase Cloud Messaging accepts the message for routing. Acceptance by FCM does not guarantee that the client device has received or displayed the message.
- **Error Handling:**
  - `400 Bad Request`: Malformed `registration_id`, target token is inactive/unregistered, or invalid payload.
  - `404 Not Found`: Target device document not found in MongoDB.
  - `410 Gone`: Target token reported permanently unregistered by FCM (device record marked inactive with timestamp).
  - `502 Bad Gateway`: Firebase authentication/authorization failure or unexpected provider error.
  - `503 Service Unavailable`: MongoDB or FCM provider unavailable.
  - `504 Gateway Timeout`: FCM provider request timed out. **Warning:** Do not automatically retry; the notification may have already been accepted and retrying may produce duplicate notifications.
- **Reactivation:** If an inactive device re-registers with `POST /api/devices/register`, it is automatically reactivated (`is_active: true`, `unregistered_at` cleared).

---

## 5. Manual Testing via FastAPI `/docs` (Swagger UI)

You can test listing devices and sending real notifications directly in your browser:

1. **Start MongoDB and Backend:**
   Ensure MongoDB is running on port 27017, set `GOOGLE_APPLICATION_CREDENTIALS`, and start the backend:
   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\HarshiniY\firebase-secrets\fcm-service-account.json"
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000 --reload
   ```
2. **Register a Device from User App:**
   Open `http://localhost:5173` in your browser. Click **"Enable notifications"** and verify that the token registers with the backend and shows "Saved to MongoDB".
3. **Open Swagger UI:**
   Navigate to `http://127.0.0.1:8000/docs`.
4. **Authorize with Admin Key:**
   Click the green **"Authorize"** button at the top right of `/docs`. Enter your `ADMIN_API_KEY` (saved in `backend/.env`) into the `X-Admin-Key` field and click **Authorize**.
5. **List Registered Devices:**
   Expand `GET /api/admin/devices`, click **"Try it out"**, then **"Execute"**. Copy the `registration_id` of your registered device.
6. **Send a Notification:**
   Expand `POST /api/admin/notifications/send`, click **"Try it out"**. Paste your `registration_id`, provide a `title` (e.g. `"Test Alert"`) and `body` (e.g. `"Hello from FastAPI /docs"`), and click **"Execute"**.
7. **Observe Delivery:**
   - **Foreground:** Keep the user app tab open and active; the message will appear in the on-screen Notification Inbox.
   - **Background:** Minimize the user app tab or switch to another tab; a native OS push notification banner will appear.
8. **Real Sending Note:**
   Real sending requires valid service-account credentials matching the `fcm-snippet` project. Automated tests mock this interaction to avoid accidental pushes or quota consumption.

---

## 6. MongoDB Document Schema

Stored in `fcm_notification_demo` database → `notify` collection:

| Field | Type | Description |
|---|---|---|
| `_id` | `ObjectId` | MongoDB primary key document identifier |
| `token` | `string` | Unique FCM device token (indexed unique) |
| `platform` | `string` | Client platform (`web`) |
| `created_at` | `Date` (UTC) | Initial registration timestamp (preserved on updates) |
| `updated_at` | `Date` (UTC) | Last update timestamp |
| `last_seen_at` | `Date` (UTC) | Last time this device re-registered or synchronized |

An atomic upsert (`find_one_and_update`) ensures:
- Registering the same token multiple times results in exactly **one document**.
- `created_at` is preserved from the first registration.
- Duplicate-key race conditions are caught and handled safely.

---

## 6. Running Tests

From `backend/`:

```powershell
.\.venv\Scripts\pytest.exe -v
```

Tests run against an isolated database `fcm_notification_demo_test` and never touch your active `notify` collection.

---

## 7. Two-Developer Collaboration Note

- Both teammates maintain their own local virtual environment (`backend/.venv`) and local `.env`.
- `localhost` / `127.0.0.1` refers to each developer's current machine.
- Each teammate's local MongoDB contains separate local data.
- For a shared demonstration where one developer's admin app sends push notifications to another's user app, both apps must point to the **same selected backend server** over the local Wi-Fi or LAN.

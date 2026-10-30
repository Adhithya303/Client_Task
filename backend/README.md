# Push Notification Backend (FastAPI + MongoDB)

FastAPI service that manages FCM device token registrations for Web and Android in a local MongoDB database, dispatches push notifications via Firebase Admin SDK, and provides secure OAuth2/JWT admin authentication.

**Current status: Feature Complete (Web + Android Registration & Sending, OAuth2/JWT Authentication, and CLI Admin Provisioning).**

---

## Prerequisites

- **Python**: 3.11 or 3.12 (`python --version` or `py -3.12 --version`)
- **MongoDB**: Community Server running locally on default port `27017`
  - Verify via MongoDB Compass at `mongodb://localhost:27017`
- **Firebase Project**: Service account credentials JSON with FCM send permissions.

---

## 1. Setup & Installation (Windows PowerShell)

Run all commands from `backend/`:

```powershell
# 1. Create a Python 3.12 virtual environment (if not already created)
py -3.12 -m venv .venv

# 2. Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# 3. Install dependencies
python -m pip install -r requirements.txt
```

---

## 2. Configuration (`.env`)

Copy `.env.example` to `.env` if not already created:

```powershell
Copy-Item .env.example .env
```

| Variable | Default Value | Description |
|---|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017` | Local MongoDB connection URI |
| `MONGODB_DATABASE` | `fcm_notification_demo` | Target database name |
| `MONGODB_COLLECTION` | `notify` | Collection name for device registrations |
| `ADMINS_COLLECTION` | `admins` | Collection name for provisioned admin accounts |
| `CORS_ORIGINS` | `["http://localhost:5173", "http://localhost:5174"]` | Allowed frontend origins (User & Admin apps) |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | `3000` | Client connection timeout in milliseconds |
| `ADMIN_API_KEY` | _(random secret)_ | Shared admin key (backward-compatible fallback for testing / bootstrap) |
| `FIREBASE_PROJECT_ID` | `fcm-snippet` | Target Firebase project ID |
| `FCM_REQUEST_TIMEOUT_SECONDS` | `10` | Bounded provider request timeout for FCM calls |
| `JWT_SECRET_KEY` | _(secure secret)_ | Secret key for signing and verifying OAuth2 JWT access tokens |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Lifespan of admin access tokens (short-lived) |

### Firebase server credentials (not in `.env`)

`GOOGLE_APPLICATION_CREDENTIALS` is read from the **server process environment** (Application Default Credentials). Set it in the terminal that starts uvicorn, **before** starting the server:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account.json"   # PowerShell
```
```bat
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json         :: cmd.exe
```

---

## 3. Provisioning Admin Users (CLI Tool)

To prevent security vulnerabilities, **no public HTTP endpoint allows creating admin accounts**. Admins are provisioned securely via the server CLI:

```powershell
# Prompt for password interactively (recommended):
python -m app.cli create-admin --username admin

# Or pass password directly:
python -m app.cli create-admin --username admin --password "MySuperSecretPassword123!"
```

- Passwords are encrypted using **bcrypt** with random salt rounds.
- Admin credentials are saved to the `admins` collection in MongoDB with a unique index on `username`.

---

## 4. Running the Backend

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The server binds to `127.0.0.1:8000`:
- **API Base**: `http://127.0.0.1:8000`
- **Interactive OpenAPI Docs**: `http://127.0.0.1:8000/docs`
- **Alternative ReDoc**: `http://127.0.0.1:8000/redoc`

---

## 5. API Contracts

### Public & Device Endpoints

#### `GET /health`
Liveness check (`200 OK`). Returns `{"status": "ok"}`.

#### `GET /ready`
Readiness check. Returns `200 OK` when MongoDB ping succeeds; returns `503 Service Unavailable` if unreachable.

#### `POST /api/devices/register`
Idempotently register or update an FCM device token in MongoDB.
- **Request Body**:
  ```json
  {
    "token": "dK_3b...fcm_token...",
    "platform": "web"
  }
  ```
  *(Accepts `"platform": "web"` or `"platform": "android"`)*
- **Response**: `200 OK`
  ```json
  {
    "status": "registered",
    "registration_id": "<24-character hex MongoDB ObjectId>"
  }
  ```

#### `POST /api/devices/unregister`
Marks a device token inactive when a device logs out or disables notifications.
- **Request Body**:
  ```json
  {
    "token": "dK_3b...fcm_token..."
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "status": "unregistered"
  }
  ```

---

### Authentication Endpoints

#### `POST /api/auth/token`
OAuth2 Password Grant / JWT access token endpoint.
- **Request Body**:
  ```json
  {
    "username": "admin",
    "password": "MySuperSecretPassword123!"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
    "token_type": "bearer",
    "expires_in": 3600,
    "username": "admin"
  }
  ```

#### `GET /api/auth/me`
Protected by `Authorization: Bearer <token>` or `X-Admin-Key`. Returns current user profile.

---

### Admin Endpoints (Protected by Bearer Token or X-Admin-Key)

#### `GET /api/admin/status`
Returns backend, MongoDB, and Firebase Admin initialization status without exposing credentials or internal paths.

#### `GET /api/admin/devices`
Query params: `limit` (default 50), `offset` (default 0).
Returns paginated list of registered devices. Full tokens are masked (`...suffix`), never leaked in responses.

#### `POST /api/admin/notifications/send`
Dispatches a push notification to the target device via Firebase Admin SDK.
- **Request Body**:
  ```json
  {
    "registration_id": "<24-hex ObjectId>",
    "title": "Welcome",
    "body": "Hello from FCM!",
    "data": {
      "targetScreen": "/home"
    }
  }
  ```
- Configures dual payload (Notification + Data) with high-priority Android channel `default` and Web push configuration.
- If FCM reports the token permanently unregistered (`UnregisteredError`), automatically marks the device inactive in MongoDB and returns HTTP 410 Gone.

---

## 6. Running Tests

From `backend/`:

```powershell
.\.venv\Scripts\pytest.exe -v
```

All 43 unit and integration tests run against an isolated database (`fcm_notification_demo_test`) and clean up test records automatically.

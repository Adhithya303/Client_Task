# Push Notification Backend (FastAPI + MongoDB)

FastAPI service that manages FCM device token registrations in a local MongoDB database
(part of the FARM stack: FastAPI, React, MongoDB).

**Current status: Part 3 (Device Token Registration API).**

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

---

## 5. MongoDB Document Schema

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

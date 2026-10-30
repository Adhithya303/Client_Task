# FCM Push Notification Admin Console (`admin-app`)

A lightweight React + TypeScript + Vite administrative dashboard that connects to the FastAPI backend, inspects registered devices, and dispatches push notifications via Firebase Cloud Messaging.

Runs strictly on **`http://localhost:5174`** to align with backend CORS origin policies.

---

## 1. Security & Admin Key Handling

- **In-Memory Storage Only:** The `ADMIN_API_KEY` entered on the connect screen is held **strictly in React component memory**.
- **No Persistence:** It is **never** written to `localStorage`, `sessionStorage`, browser cookies, or logged to the console.
- **Session Reset:** By design, **refreshing or closing the browser tab clears the session** and requires re-entering the admin key.
- **No Frontend Secret in Env:** `ADMIN_API_KEY` is never placed into `.env` or any `VITE_` variable in the admin app. It is configured exclusively in `backend/.env`.

---

## 2. Configuration (`.env.local`)

Copy `.env.example` to `.env.local` if needed:

```bash
cp .env.example .env.local
```

| Variable | Default Value | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | FastAPI backend URL |

*(The admin app does not require Firebase browser keys, VAPID keys, or service workers because all FCM interactions are dispatched server-side through FastAPI.)*

---

## 3. How to Run the Complete System (Three Terminals)

### Terminal 1: FastAPI Backend (Port 8000)
```powershell
cd C:\D\Client_Task\backend

# Set Firebase credentials for the backend process
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\HarshiniY\firebase-secrets\fcm-service-account.json"

# Start Uvicorn
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 2: User App (Port 5173)
```powershell
cd C:\D\Client_Task\apps\user-app
npm run dev
```
Open `http://localhost:5173` and click **"Enable notifications"** to obtain an FCM token and register the device with MongoDB.

### Terminal 3: Admin App (Port 5174)
```powershell
cd C:\D\Client_Task\apps\admin-app
npm run dev
```
Open `http://localhost:5174` in your browser.

---

## 4. Using the Admin Dashboard

1. **Connect:**
   - Paste the `ADMIN_API_KEY` from `backend/.env`.
   - Click **"Connect to Backend"**. The app verifies access via `GET /api/admin/status`.
2. **System Status:**
   - Displays reachability for FastAPI, MongoDB, and Firebase Admin SDK credentials.
3. **Select a Target Device:**
   - The device table lists all tokens registered in MongoDB (`GET /api/admin/devices`).
   - For privacy, full tokens are never displayed; only masked suffixes (e.g. `...123456`) are shown.
   - Click **"Select"** on an active device.
   - Inactive devices (e.g. reported unregistered by FCM) cannot be selected.
4. **Compose & Send:**
   - Enter **Title** (1–100 characters) and **Message Body** (1–1000 characters).
   - Check the **Live Push Notification Preview**.
   - Click **"Send Notification"** (`POST /api/admin/notifications/send`).
   - Observe the **"Accepted by FCM"** confirmation and returned `message_id`.
   - Check the User App on `http://localhost:5173` to see foreground delivery, or background the tab to see a native operating system banner.

---

## 5. Verification Commands

From `apps/admin-app`:

```powershell
# Type check and build bundle
npm run build

# Run Oxlint
npm run lint
```

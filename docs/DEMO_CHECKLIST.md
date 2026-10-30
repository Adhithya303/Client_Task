# Push Notification Demonstration Checklist

This document tracks manual verification of the complete FARM push notification system (FastAPI, React, MongoDB, Firebase Cloud Messaging).

> **Verification Rule:**
> Automated builds, test suites, or "accepted by FCM" responses do **not** imply end-to-end delivery. Every test below requires direct observation in browser and operating system UIs before being marked completed.

---

## 1. Test Environment Context

- **Date & Time:** Pending manual run
- **Operating System:** Windows 11 (or local developer OS)
- **Browsers Tested:**
  - User App: Chrome / Edge / Brave (Version: `Pending`)
  - Admin App: Chrome / Edge / Firefox (Version: `Pending`)
- **Backend Host:** Localhost (`http://localhost:8000`)
- **User App Host:** Localhost (`http://localhost:5173`)
- **Admin App Host:** Localhost (`http://localhost:5174`)
- **Database:** MongoDB Community (`mongodb://localhost:27017`), DB: `fcm_notification_demo`, Collection: `notify`

---

## 2. Service Startup & Pre-flight Probes

| Step | Action | Expected Result | Status | Observed Output / Notes |
|---|---|---|---|---|
| 2.1 | Start local MongoDB daemon on port `27017` | MongoDB listening on `127.0.0.1:27017` | ⏳ Pending | |
| 2.2 | In Terminal 1, set `GOOGLE_APPLICATION_CREDENTIALS` and start FastAPI: `python -m uvicorn app.main:app --port 8000 --reload` | FastAPI boots, connects to MongoDB, logs `Unique index on 'token' verified`, and `Firebase Admin initialized` | ⏳ Pending | |
| 2.3 | Query `GET http://localhost:8000/health` | HTTP 200 with `{"status": "ok"}` | ⏳ Pending | |
| 2.4 | Query `GET http://localhost:8000/ready` | HTTP 200 with `{"status": "ready", "database": "connected"}` | ⏳ Pending | |
| 2.5 | In Terminal 2, start User App: `npm run dev` in `apps/user-app` | Vite listening on `http://localhost:5173` | ⏳ Pending | |
| 2.6 | In Terminal 3, start Admin App: `npm run dev` in `apps/admin-app` | Vite listening on `http://localhost:5174` (strictPort) | ⏳ Pending | |

---

## 3. User App Device Registration & Persistence

| Step | Action | Expected Result | Status | Observed Output / Notes |
|---|---|---|---|---|
| 3.1 | Navigate to `http://localhost:5173` | Dashboard renders setup progress, support card, and permission card. No console errors. | ⏳ Pending | |
| 3.2 | Click **"Enable notifications"** in User App | Browser displays native notification permission prompt. | ⏳ Pending | |
| 3.3 | Click **"Allow"** on browser prompt | FCM token acquired via Service Worker; automatic `POST /api/devices/register` sent. Status changes to "Saved to MongoDB" with real ObjectId. | ⏳ Pending | |
| 3.4 | Inspect MongoDB `notify` collection via Compass or mongosh | Exactly 1 document exists with `platform: "web"`, matching `token`, `created_at`, `updated_at`, `last_seen_at`, and `is_active: true`. | ⏳ Pending | |
| 3.5 | Refresh User App (`http://localhost:5173`) or re-trigger registration | Status retains or re-syncs token; MongoDB still contains **exactly 1 document** for this token; `created_at` timestamp is preserved unchanged. | ⏳ Pending | |

---

## 4. Admin App Connection & Authentication

| Step | Action | Expected Result | Status | Observed Output / Notes |
|---|---|---|---|---|
| 4.1 | Navigate to `http://localhost:5174` | "Connect to Backend" screen displayed with masked password input. | ⏳ Pending | |
| 4.2 | Input invalid key (e.g. `wrong-api-key`) and click Connect | Red error banner displayed with "Admin access denied" (HTTP 401). Key is not retained in storage. | ⏳ Pending | |
| 4.3 | Input real `ADMIN_API_KEY` (from `backend/.env`) and click Connect | HTTP 200 on `GET /api/admin/status`. Connect screen unmounts and dashboard mounts. Key held only in React memory. | ⏳ Pending | |
| 4.4 | Verify System Status Card | Shows Backend: `reachable`, MongoDB: `reachable`, Firebase Admin: `Initialized`. | ⏳ Pending | |
| 4.5 | Verify Device List Card | Device registered in Section 3 appears in table with masked token suffix (e.g. `...123456`), platform `web`, and status `Active`. Full token is nowhere in DOM. | ⏳ Pending | |
| 4.6 | Test Disconnect button | Clicking Disconnect clears in-memory key, resets device list/history, and returns to Connect screen. | ⏳ Pending | |

---

## 5. End-to-End Notification Dispatch & Delivery

| Step | Action | Expected Result | Status | Observed Output / Notes |
|---|---|---|---|---|
| 5.1 | In Admin App (`http://localhost:5174`), select active registered device | Device card highlights selected row; Composer shows Target registration ID and masked suffix. | ⏳ Pending | |
| 5.2 | Try sending with empty title or whitespace-only body | Client validation prevents submission; displays readable inline validation error. | ⏳ Pending | |
| 5.3 | Type Title: `Foreground Test 1` and Body: `Hello while tab is focused` | Live notification preview updates in real time with exact text. | ⏳ Pending | |
| 5.4 | Keep User App (`http://localhost:5173`) tab active & focused in foreground. Click **"Send Notification"** in Admin App | Admin App receives `200 OK` with `"status": "accepted"` and FCM `message_id`. User App displays notification in on-screen **Notification Inbox** with matching title/body and timestamp. Exactly 1 item added. | ⏳ Pending | |
| 5.5 | Compose Title: `Background Test 2` and Body: `Hello while tab is hidden` | Live preview reflects text. | ⏳ Pending | |
| 5.6 | Minimize or switch away from User App tab (`http://localhost:5173`). Click **"Send Notification"** in Admin App | Operating system displays native desktop push notification banner. Clicking banner focuses User App tab. **No duplicate notification** is fired. | ⏳ Pending | |

---

## 6. Resilience & Recovery Testing

| Step | Action | Expected Result | Status | Observed Output / Notes |
|---|---|---|---|---|
| 6.1 | Stop FastAPI backend process (Ctrl+C in Terminal 1) | Backend terminates. | ⏳ Pending | |
| 6.2 | In Admin App, click "Refresh Devices" or "Send Notification" | App displays clean error: "Cannot connect to backend server. Ensure FastAPI is running on port 8000." No raw stack traces or crashes. | ⏳ Pending | |
| 6.3 | In User App, click "Retry registration" | App displays clean connection error. | ⏳ Pending | |
| 6.4 | Restart FastAPI backend in Terminal 1 | Backend reconnects to MongoDB and resumes listening on port 8000. | ⏳ Pending | |
| 6.5 | In User App, click "Retry registration" | Registration succeeds immediately without prompting user for notification permissions again. | ⏳ Pending | |
| 6.6 | In Admin App, refresh devices and send notification | Successfully dispatches and reaches User App. | ⏳ Pending | |

---

## 7. Sign-Off Log

| Role | Name | Date | Outcome | Comments |
|---|---|---|---|---|
| Operator / Tester | | | ⏳ Pending | |

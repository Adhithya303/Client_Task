# User App — Push Notification Demo & Android Receiver

React + TypeScript + Vite app that requests notification permission, obtains an FCM token (Web or Native Android), receives push notifications in the foreground and background, and automatically persists the device token to a local FastAPI + MongoDB backend.

**Current status: Feature Complete (Web Push, Capacitor Android Packaging, Native Push Notifications, and Idempotent Backend Registration).**

---

## Prerequisites

- **Node.js**: `20.19+` or `22.12+` (required by Vite 8). Check with `node -v`.
- **npm**: Bundled with Node.js.
- **Modern Browser**: Chrome, Edge, Brave, or Firefox.
- **FastAPI Backend**: Running locally on `http://localhost:8000` (see `backend/README.md`).
- **MongoDB**: Running locally on port `27017`.
- **For Android Development**:
  - Android Studio (Ladybug / Hedgehog or newer) with Android SDK (API 34/35).
  - Java Development Kit (JDK 17 or 21).
  - Physical Android device with Developer Mode / USB Debugging, or an Android Virtual Device (AVD) with **Google Play Services** (required for FCM).

---

## 1. Web Setup & Configuration

Run from `apps/user-app`:

```powershell
npm install
```

### Local Environment (`.env.local`)

Each developer creates their own `.env.local` (git-ignored, never committed).
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

> **Note:** For Android emulator testing, `http://localhost:8000` from within an emulator points to the emulator itself. Use `http://10.0.2.2:8000` or your workstation's LAN IP address when running inside the Android emulator.

---

## 2. Capacitor Android Packaging & Native Push

The application is packaged with **Capacitor 8** for Android.

### Android Application Configuration
- **Application / Package ID**: `com.fcm.notificationdemo`
- **Application Name**: `Push Notification Demo`
- **Web Build Directory**: `dist`
- **Native Push Plugin**: `@capacitor/push-notifications`
- **Default Notification Channel ID**: `default` (Channel Name: `General Notifications`, High Importance)

### Firebase Android App Registration
To enable native FCM push notifications on Android:
1. Open [Firebase Console](https://console.firebase.google.com/) and navigate to your project (e.g. `fcm-snippet`).
2. Click **Add App** and select **Android**.
3. Register the exact package name:
   ```text
   com.fcm.notificationdemo
   ```
4. Download the generated `google-services.json` file.
5. Place the file at:
   ```text
   apps/user-app/android/app/google-services.json
   ```
   *(A tracked template is available at `apps/user-app/android/app/google-services.json.example`. Real credential files are git-ignored).*

### Android Build and Sync Commands (PowerShell)

Run from `apps/user-app`:

```powershell
# 1. Build the React web application and synchronize native Android assets
npm run cap:build

# 2. Open the project in Android Studio
npm run cap:open

# 3. Build a Debug APK from the command line (requires JDK 17+ and Android SDK configured)
cd android
.\gradlew assembleDebug
```

- Output Debug APK:
  `apps/user-app/android/app/build/outputs/apk/debug/app-debug.apk`

### Installing Debug APK on Connected Device or Emulator
```powershell
cd android
.\gradlew installDebug
```
Or click the green **Run (▶)** button in Android Studio.

### Preparing a Release Build & Signing Requirements
Release builds for Android must be digitally signed:
1. Generate a release keystore using Java's `keytool` (store securely; **never commit `.keystore` or `.jks` files**):
   ```powershell
   keytool -genkey -v -keystore release-key.keystore -alias fcm-demo -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Build unsigned release APK or AAB:
   ```powershell
   .\gradlew assembleRelease
   # Or for Google Play Bundle:
   .\gradlew bundleRelease
   ```
3. Sign using `apksigner` or configure signing credentials via environment variables in Gradle.

---

## 3. Platform-Aware Notification Architecture

The user application automatically detects its runtime environment:
- **In Browser (`http://localhost:5173`)**:
  - Uses modular Firebase Web SDK (`firebase/messaging`).
  - Registers the Web Service Worker (`firebase-messaging-sw.ts`).
  - Obtains a Web VAPID FCM token.
  - Automatically registers the token with the backend as `platform: "web"`.
  - Foreground notifications display in the in-app notification inbox.
  - Background notifications display in native OS browser banners.
- **On Native Android**:
  - Uses the official `@capacitor/push-notifications` plugin.
  - Skips browser service-worker registration to prevent native conflicts.
  - Configures the Android notification channel (`default`, high importance).
  - Handles Android 13+ runtime notification permissions (`POST_NOTIFICATIONS`).
  - Automatically registers the native token with the backend as `platform: "android"`.
  - Foreground pushes trigger `pushNotificationReceived` and update the in-app inbox.
  - Background pushes display in the Android notification shade with sound/vibration.
  - Tapping a notification triggers `pushNotificationActionPerformed` and safely opens the app.

---

## 4. Running the Complete System (Web Workflow)

Open three PowerShell terminals:

### Terminal 1: Start FastAPI Backend
```powershell
cd c:\Users\adhit\Downloads\Client_Task\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --port 8000 --reload
```

### Terminal 2: Start User App
```powershell
cd c:\Users\adhit\Downloads\Client_Task\apps\user-app
npm run dev
```
Open `http://localhost:5173` and click **“Enable notifications”**.

### Terminal 3: Start Admin App
```powershell
cd c:\Users\adhit\Downloads\Client_Task\apps\admin-app
npm run dev
```
Open `http://localhost:5174`, log in with your admin credentials or API key, and compose a push notification to send to your registered device.

---

## 5. Development Verification Commands

```powershell
# In apps/user-app:
npm run build      # TypeScript check and Vite build
npm run lint       # oxlint check (0 warnings, 0 errors)
npm run cap:build  # Web build + Capacitor Android asset sync
```

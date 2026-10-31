# Production Hardening & Deployment Guide

This directory provides concrete production configuration for deploying the FARM Push Notification stack behind an HTTPS reverse proxy with TLS termination, rate limiting, and hardened Android security.

---

## 1. Architecture Overview

In production, the architecture terminates TLS at the edge reverse proxy (Nginx or Cloudflare/Caddy), proxies API traffic to FastAPI over private networking, and serves the pre-compiled React single-page applications.

```
[Android Native App (HTTPS)]  ──────┐
[User Browser (HTTPS)]        ──────┼──> [Nginx Reverse Proxy:443] ──> [FastAPI Backend:8000] ──> [MongoDB:27017]
[Admin Browser (HTTPS)]       ──────┘          (TLS / Certbot)                   │
                                                                                 └──> [Firebase Cloud Messaging]
```

---

## 2. Local vs. Production Addresses & Cleartext Traffic

### Android Network Security:
- **Production APK:** Configured via `network_security_config.xml` with `cleartextTrafficPermitted="false"`. All outbound traffic from the Android application must use valid HTTPS.
- **Android Emulator (Local Dev):** The Android Emulator cannot reach the host via `127.0.0.1` (which loops back to the emulator itself). Use:
  ```
  http://10.0.2.2:8000
  ```
  `network_security_config.xml` explicitly permits cleartext only for `10.0.2.2` and `localhost` during development.
- **Physical Android Device (Local Dev):** A physical phone connected to local Wi-Fi must reach your workstation via its LAN IP:
  ```
  http://192.168.x.x:8000
  ```
  To accept connections from physical devices, the backend must be bound to `0.0.0.0` (all interfaces), not `127.0.0.1`:
  ```powershell
  uvicorn app.main:app --host 0.0.0.0 --port 8000
  ```

---

## 3. Production Deployment with Docker Compose & Nginx

### Prerequisites:
1. Valid domain name (e.g., `api.yourdomain.com`).
2. SSL/TLS Certificate & Private Key (via Let's Encrypt / Certbot).
3. Place `fullchain.pem` and `privkey.pem` inside `deploy/certs/`.

### Starting the Stack:
```bash
cd deploy

# Export production secrets
export JWT_SECRET_KEY="generate-a-strong-random-64-character-secret-in-production"
export FIREBASE_PROJECT_ID="your-firebase-project-id"
export FIREBASE_CREDENTIALS_FILE="/absolute/path/to/service-account.json"

docker-compose up -d --build
```

### Validating Deployment:
- Test liveness probe: `curl -k https://localhost/health`
- Test readiness probe: `curl -k https://localhost/ready`
- Test HTTPS redirection: `curl -I http://localhost` (Should return `HTTP/1.1 301 Moved Permanently`)

> [!IMPORTANT]
> **Deployment Status:** HTTPS configuration is fully prepared in `deploy/nginx.conf` and `network_security_config.xml`. It is **NOT** active on your local development machine until you provision SSL certificates and start the reverse proxy. Local development continues over HTTP on ports 8000, 5173, and 5174.

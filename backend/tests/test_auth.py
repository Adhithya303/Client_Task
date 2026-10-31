from datetime import datetime, timedelta, timezone
import jwt
import pytest

from app.auth import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.cli import cmd_create_admin
from app.config import settings
from app.database import create_admin_user, get_admin_user


def test_password_hashing_and_verification():
    plain = "SuperSecurePassword123!"
    hashed = hash_password(plain)
    assert hashed != plain
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$")
    assert verify_password(plain, hashed) is True
    assert verify_password("WrongPassword123!", hashed) is False


def test_jwt_generation_and_decoding():
    username = "admin_test_user"
    token = create_access_token(username)
    payload = decode_access_token(token)
    assert payload["sub"] == username
    assert payload["iss"] == settings.JWT_ISSUER
    assert payload["aud"] == settings.JWT_AUDIENCE
    assert "exp" in payload
    assert "iat" in payload


def test_expired_jwt_rejected():
    now = datetime.now(timezone.utc)
    expired_payload = {
        "sub": "expired_admin",
        "iat": int((now - timedelta(hours=2)).timestamp()),
        "exp": int((now - timedelta(hours=1)).timestamp()),
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
    }
    expired_token = jwt.encode(expired_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    with pytest.raises(Exception) as exc_info:
        decode_access_token(expired_token)
    assert "expired" in str(exc_info.value.detail).lower()


def test_tampered_jwt_rejected():
    token = create_access_token("valid_user")
    tampered = token[:-5] + "aaaaa"
    with pytest.raises(Exception) as exc_info:
        decode_access_token(tampered)
    assert "invalid" in str(exc_info.value.detail).lower()


def test_admin_login_endpoint(client, test_db):
    username = "jwt_login_test_admin"
    password = "CorrectAdminPassword99!"
    hashed = hash_password(password)
    create_admin_user(username, hashed)

    # 1. Successful login
    login_resp = client.post(
        "/api/auth/token",
        json={"username": username, "password": password},
    )
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["username"] == username

    # 2. Authenticated profile check
    token = data["access_token"]
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == username

    # 3. Access protected admin devices endpoint using Bearer token
    devices_resp = client.get("/api/admin/devices", headers={"Authorization": f"Bearer {token}"})
    assert devices_resp.status_code == 200

    # 4. Incorrect password rejected
    bad_resp = client.post(
        "/api/auth/token",
        json={"username": username, "password": "WrongPassword!"},
    )
    assert bad_resp.status_code == 401

    # Clean up test admin
    test_db["admins"].delete_one({"username": username})


def test_cli_admin_provisioning(test_db):
    username = "cli_provisioned_admin"
    password = "ValidCliPassword123!"

    # Ensure clean state
    test_db["admins"].delete_one({"username": username})

    cmd_create_admin(username=username, password=password)

    user = get_admin_user(username)
    assert user is not None
    assert user["username"] == username
    assert verify_password(password, user["password_hash"]) is True

    # Clean up
    test_db["admins"].delete_one({"username": username})


def test_login_rate_limiting(client):
    target_user = "rate_limited_test_user"

    # Send 5 failed login attempts
    for _ in range(5):
        resp = client.post(
            "/api/auth/token",
            json={"username": target_user, "password": "WrongPassword!"},
        )
        assert resp.status_code in [401, 429]

    # The 6th attempt within the 60s window must be rejected with 429 Too Many Requests
    blocked_resp = client.post(
        "/api/auth/token",
        json={"username": target_user, "password": "WrongPassword!"},
    )
    assert blocked_resp.status_code == 429
    assert "Too many failed login attempts" in blocked_resp.json()["detail"]
    assert blocked_resp.headers.get("Retry-After") == "60"


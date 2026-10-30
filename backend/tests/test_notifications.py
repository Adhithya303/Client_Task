from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch
import pytest
from pymongo.errors import ServerSelectionTimeoutError
from firebase_admin import exceptions, messaging

import app.firebase as fb
from app.config import settings
from app.database import get_notify_collection

TEST_KEY = "test-admin-key-not-a-real-secret"


@pytest.fixture(autouse=True)
def reset_firebase():
    fb.reset_firebase_for_tests()
    yield
    fb.reset_firebase_for_tests()


@pytest.fixture
def admin_key(monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_API_KEY", TEST_KEY)
    return TEST_KEY


def _setup_initialized_firebase(monkeypatch):
    """Helper to mock Firebase in initialized state."""
    monkeypatch.setattr(settings, "FIREBASE_PROJECT_ID", "fcm-snippet")
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "mock-path-not-read")
    monkeypatch.setattr(
        fb.credentials,
        "ApplicationDefault",
        lambda: SimpleNamespace(project_id="fcm-snippet"),
    )

    def fake_get_app():
        raise ValueError("no app")

    def fake_initialize_app(cred, options=None):
        return object()

    monkeypatch.setattr(fb.firebase_admin, "get_app", fake_get_app)
    monkeypatch.setattr(fb.firebase_admin, "initialize_app", fake_initialize_app)
    fb.init_firebase()


# ---------------------------------------------------------------- unauthorized tests


def test_devices_list_unauthorized(client, admin_key):
    # Missing header
    assert client.get("/api/admin/devices").status_code == 401
    # Wrong header
    r = client.get("/api/admin/devices", headers={"X-Admin-Key": "wrong-key"})
    assert r.status_code == 401


def test_send_notification_unauthorized(client, admin_key):
    payload = {
        "registration_id": "507f1f77bcf86cd799439011",
        "title": "Title",
        "body": "Body",
    }
    # Missing header
    assert client.post("/api/admin/notifications/send", json=payload).status_code == 401
    # Wrong header
    r = client.post(
        "/api/admin/notifications/send",
        headers={"X-Admin-Key": "wrong-key"},
        json=payload,
    )
    assert r.status_code == 401


# ---------------------------------------------------------------- device listing tests


def test_safe_device_listing_without_token_exposure(client, admin_key):
    # Register two devices
    token_1 = "secret_real_long_fcm_token_device_one_111111"
    token_2 = "secret_real_long_fcm_token_device_two_222222"

    r1 = client.post("/api/devices/register", json={"token": token_1, "platform": "web"})
    r2 = client.post("/api/devices/register", json={"token": token_2, "platform": "web"})
    assert r1.status_code == 200
    assert r2.status_code == 200

    r = client.get("/api/admin/devices", headers={"X-Admin-Key": TEST_KEY})
    assert r.status_code == 200
    data = r.json()

    assert data["total"] >= 2
    assert "devices" in data
    assert len(data["devices"]) >= 2

    # Check fields of listed devices
    device_suffixes = [d["token_suffix"] for d in data["devices"]]
    assert "...111111" in device_suffixes
    assert "...222222" in device_suffixes

    # CRITICAL: Verify full tokens are NEVER exposed in the JSON response
    assert token_1 not in r.text
    assert token_2 not in r.text

    for item in data["devices"]:
        assert "registration_id" in item
        assert item["platform"] in ["web", "android"]
        assert item["is_active"] is True
        assert "created_at" in item
        assert "last_seen_at" in item


def test_device_listing_pagination(client, admin_key):
    for i in range(5):
        token = f"token_for_pagination_test_device_{i:03d}_suffix"
        client.post("/api/devices/register", json={"token": token, "platform": "web"})

    r = client.get(
        "/api/admin/devices?limit=2&offset=1",
        headers={"X-Admin-Key": TEST_KEY},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["devices"]) == 2
    assert data["limit"] == 2
    assert data["offset"] == 1


# ---------------------------------------------------------------- malformed and unknown ID tests


def test_send_malformed_registration_id(client, admin_key):
    r = client.post(
        "/api/admin/notifications/send",
        headers={"X-Admin-Key": TEST_KEY},
        json={
            "registration_id": "not-a-valid-hex-id",
            "title": "Title",
            "body": "Body",
        },
    )
    assert r.status_code == 400
    assert "Invalid registration_id format" in r.json()["detail"]


def test_send_unknown_registration_id(client, admin_key):
    r = client.post(
        "/api/admin/notifications/send",
        headers={"X-Admin-Key": TEST_KEY},
        json={
            "registration_id": "507f1f77bcf86cd799439011",
            "title": "Title",
            "body": "Body",
        },
    )
    assert r.status_code == 404
    assert "Device not found" in r.json()["detail"]


def test_send_rejects_missing_whitespace_and_extra_fields(client, admin_key):
    valid_id = "507f1f77bcf86cd799439011"

    # Whitespace title
    r = client.post(
        "/api/admin/notifications/send",
        headers={"X-Admin-Key": TEST_KEY},
        json={"registration_id": valid_id, "title": "   ", "body": "Valid body"},
    )
    assert r.status_code == 422

    # Whitespace body
    r = client.post(
        "/api/admin/notifications/send",
        headers={"X-Admin-Key": TEST_KEY},
        json={"registration_id": valid_id, "title": "Valid title", "body": "   "},
    )
    assert r.status_code == 422

    # Unexpected extra field (extra="forbid")
    r = client.post(
        "/api/admin/notifications/send",
        headers={"X-Admin-Key": TEST_KEY},
        json={
            "registration_id": valid_id,
            "title": "Title",
            "body": "Body",
            "arbitrary_token": "injected",
        },
    )
    assert r.status_code == 422


# ---------------------------------------------------------------- successful send tests


def test_successful_notification_send(client, admin_key, monkeypatch):
    _setup_initialized_firebase(monkeypatch)

    token = "real_stored_token_send_success_999999"
    reg_res = client.post("/api/devices/register", json={"token": token, "platform": "web"})
    reg_id = reg_res.json()["registration_id"]

    sent_messages = []

    def fake_send(message):
        sent_messages.append(message)
        return "projects/fcm-snippet/messages/test_msg_id_456"

    monkeypatch.setattr(messaging, "send", fake_send)

    r = client.post(
        "/api/admin/notifications/send",
        headers={"X-Admin-Key": TEST_KEY},
        json={
            "registration_id": reg_id,
            "title": "Welcome Admin",
            "body": "Your test message body",
        },
    )

    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "accepted"
    assert data["message_id"] == "projects/fcm-snippet/messages/test_msg_id_456"
    assert data["registration_id"] == reg_id

    # Verify full token is NEVER echoed in response
    assert token not in r.text

    # Verify message payload passed to FCM
    assert len(sent_messages) == 1
    msg = sent_messages[0]
    assert msg.token == token
    assert msg.notification.title == "Welcome Admin"
    assert msg.notification.body == "Your test message body"
    assert msg.data["title"] == "Welcome Admin"
    assert msg.data["body"] == "Your test message body"


# ---------------------------------------------------------------- failure and error handling tests


def test_send_fails_when_firebase_not_initialized(client, admin_key):
    token = "token_firebase_uninit_test_333333"
    reg_res = client.post("/api/devices/register", json={"token": token, "platform": "web"})
    reg_id = reg_res.json()["registration_id"]

    r = client.post(
        "/api/admin/notifications/send",
        headers={"X-Admin-Key": TEST_KEY},
        json={
            "registration_id": reg_id,
            "title": "Title",
            "body": "Body",
        },
    )
    assert r.status_code == 503
    assert "Firebase Admin service is unavailable" in r.json()["detail"]


def test_send_firebase_permission_denied_returns_502(client, admin_key, monkeypatch):
    _setup_initialized_firebase(monkeypatch)

    token = "token_firebase_perm_denied_test_444444"
    reg_res = client.post("/api/devices/register", json={"token": token, "platform": "web"})
    reg_id = reg_res.json()["registration_id"]

    def fake_send(message):
        raise exceptions.PermissionDeniedError("Simulated permission denied")

    monkeypatch.setattr(messaging, "send", fake_send)

    r = client.post(
        "/api/admin/notifications/send",
        headers={"X-Admin-Key": TEST_KEY},
        json={
            "registration_id": reg_id,
            "title": "Title",
            "body": "Body",
        },
    )
    assert r.status_code == 502
    assert "authentication or authorization failed" in r.json()["detail"]


def test_send_firebase_timeout_returns_504(client, admin_key, monkeypatch):
    _setup_initialized_firebase(monkeypatch)

    token = "token_firebase_timeout_test_555555"
    reg_res = client.post("/api/devices/register", json={"token": token, "platform": "web"})
    reg_id = reg_res.json()["registration_id"]

    def fake_send(message):
        raise exceptions.DeadlineExceededError("Simulated timeout")

    monkeypatch.setattr(messaging, "send", fake_send)

    r = client.post(
        "/api/admin/notifications/send",
        headers={"X-Admin-Key": TEST_KEY},
        json={
            "registration_id": reg_id,
            "title": "Title",
            "body": "Body",
        },
    )
    assert r.status_code == 504
    assert "timed out" in r.json()["detail"]
    assert "duplicate" in r.json()["detail"]

    # Ensure device is NOT marked inactive for timeout
    col = get_notify_collection()
    doc = col.find_one({"token": token})
    assert doc["is_active"] is True


# ---------------------------------------------------------------- unregistered token & reactivation tests


def test_unregistered_token_marked_inactive_and_reactivated_on_reregister(
    client, admin_key, monkeypatch
):
    _setup_initialized_firebase(monkeypatch)

    token = "token_unregistered_flow_test_777777"
    reg_res = client.post("/api/devices/register", json={"token": token, "platform": "web"})
    reg_id = reg_res.json()["registration_id"]

    # 1. FCM throws UnregisteredError
    def fake_send_unregistered(message):
        raise messaging.UnregisteredError("App instance has been unregistered.")

    monkeypatch.setattr(messaging, "send", fake_send_unregistered)

    r1 = client.post(
        "/api/admin/notifications/send",
        headers={"X-Admin-Key": TEST_KEY},
        json={
            "registration_id": reg_id,
            "title": "Title",
            "body": "Body",
        },
    )
    assert r1.status_code == 410
    assert "permanently unregistered" in r1.json()["detail"]

    # 2. Check MongoDB: is_active should now be False, unregistered_at should be set
    col = get_notify_collection()
    doc = col.find_one({"token": token})
    assert doc["is_active"] is False
    assert "unregistered_at" in doc
    assert doc["unregistered_at"] is not None

    # 3. Subsequent send to this inactive device is blocked
    r2 = client.post(
        "/api/admin/notifications/send",
        headers={"X-Admin-Key": TEST_KEY},
        json={
            "registration_id": reg_id,
            "title": "Title",
            "body": "Body",
        },
    )
    assert r2.status_code == 400
    assert "marked inactive" in r2.json()["detail"]

    # 4. Device re-registers with the same token
    r3 = client.post("/api/devices/register", json={"token": token, "platform": "web"})
    assert r3.status_code == 200
    assert r3.json()["registration_id"] == reg_id

    # Verify device record is now active and unregistered_at is removed
    doc_after = col.find_one({"token": token})
    assert doc_after["is_active"] is True
    assert doc_after.get("unregistered_at") is None

    # 5. Subsequent send to the reactivated device now succeeds
    def fake_send_success(message):
        return "projects/fcm-snippet/messages/msg_reactivated_888"

    monkeypatch.setattr(messaging, "send", fake_send_success)

    r4 = client.post(
        "/api/admin/notifications/send",
        headers={"X-Admin-Key": TEST_KEY},
        json={
            "registration_id": reg_id,
            "title": "Title",
            "body": "Body",
        },
    )
    assert r4.status_code == 200
    assert r4.json()["status"] == "accepted"


# ---------------------------------------------------------------- database unavailable tests


def test_database_unavailable_handling_for_devices_and_send(client, admin_key):
    with patch(
        "app.database.get_notify_collection",
        side_effect=ServerSelectionTimeoutError("Simulated DB down"),
    ):
        # Listing devices returns 503
        r_list = client.get("/api/admin/devices", headers={"X-Admin-Key": TEST_KEY})
        assert r_list.status_code == 503
        assert "currently unavailable" in r_list.json()["detail"]

        # Sending notification returns 503
        r_send = client.post(
            "/api/admin/notifications/send",
            headers={"X-Admin-Key": TEST_KEY},
            json={
                "registration_id": "507f1f77bcf86cd799439011",
                "title": "Title",
                "body": "Body",
            },
        )
        assert r_send.status_code == 503
        assert "currently unavailable" in r_send.json()["detail"]

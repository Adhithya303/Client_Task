from types import SimpleNamespace

import pytest

import app.firebase as fb
from app.config import settings

TEST_KEY = "test-admin-key-not-a-real-secret"
STATUS_URL = "/api/admin/status"


@pytest.fixture(autouse=True)
def reset_firebase_state():
    fb.reset_firebase_for_tests()
    yield
    fb.reset_firebase_for_tests()


@pytest.fixture
def admin_key(monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_API_KEY", TEST_KEY)
    return TEST_KEY


# ---------------------------------------------------------------- admin authentication


def test_missing_authorization_header_rejected(client):
    assert client.get(STATUS_URL).status_code == 401


def test_legacy_x_admin_key_header_rejected(client):
    """Verify that legacy X-Admin-Key header alone is rejected with 401 (fallback removed)."""
    r = client.get(STATUS_URL, headers={"X-Admin-Key": TEST_KEY})
    assert r.status_code == 401


def test_incorrect_bearer_token_rejected(client):
    r = client.get(STATUS_URL, headers={"Authorization": "Bearer not-a-valid-token"})
    assert r.status_code == 401


def test_correct_bearer_token_allowed(client, admin_auth_headers):
    r = client.get(STATUS_URL, headers=admin_auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["backend"] == "reachable"
    assert body["mongodb"] == "reachable"


# ---------------------------------------------------------------- firebase status


def test_status_unavailable_when_project_id_missing(client, admin_auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "FIREBASE_PROJECT_ID", "")
    fb.init_firebase()
    body = client.get(STATUS_URL, headers=admin_auth_headers).json()
    assert body["firebase_admin"]["state"] == "unavailable"
    assert body["firebase_admin"]["reason"] == "project_id_not_configured"
    assert "no notification has been sent" in body["notice"]


def test_status_unavailable_when_credentials_missing(client, admin_auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "FIREBASE_PROJECT_ID", "fcm-snippet")
    monkeypatch.delenv("GOOGLE_APPLICATION_CREDENTIALS", raising=False)
    fb.init_firebase()
    body = client.get(STATUS_URL, headers=admin_auth_headers).json()
    assert body["firebase_admin"]["state"] == "unavailable"
    assert body["firebase_admin"]["reason"] == "credentials_not_configured"


def _mock_firebase(monkeypatch, credential_project, init_calls):
    monkeypatch.setattr(settings, "FIREBASE_PROJECT_ID", "fcm-snippet")
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "mock-path-not-read")
    monkeypatch.setattr(
        fb.credentials,
        "ApplicationDefault",
        lambda: SimpleNamespace(project_id=credential_project),
    )

    def fake_get_app():
        raise ValueError("no app")

    def fake_initialize_app(cred, options=None):
        init_calls.append(options)
        return object()

    monkeypatch.setattr(fb.firebase_admin, "get_app", fake_get_app)
    monkeypatch.setattr(fb.firebase_admin, "initialize_app", fake_initialize_app)


def test_status_initialized_with_mocked_firebase(client, admin_auth_headers, monkeypatch):
    calls = []
    _mock_firebase(monkeypatch, "fcm-snippet", calls)
    fb.init_firebase()
    fb.init_firebase()  # second call must reuse, not re-initialize
    assert calls == [{"projectId": "fcm-snippet", "httpTimeout": 10}]

    r = client.get(STATUS_URL, headers=admin_auth_headers)
    body = r.json()
    assert body["firebase_admin"]["state"] == "initialized"
    assert body["firebase_admin"]["reason"] is None
    assert "mock-path-not-read" not in r.text
    assert "does not verify permission to send" in body["notice"]


def test_project_id_mismatch_detected(client, admin_auth_headers, monkeypatch):
    calls = []
    _mock_firebase(monkeypatch, "some-other-project", calls)
    fb.init_firebase()
    assert calls == []
    body = client.get(STATUS_URL, headers=admin_auth_headers).json()
    assert body["firebase_admin"]["state"] == "unavailable"
    assert body["firebase_admin"]["reason"] == "project_id_mismatch"
    assert "some-other-project" not in str(body)


def test_credential_load_error_is_sanitized(client, admin_auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "FIREBASE_PROJECT_ID", "fcm-snippet")
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "C:/secret/path.json")

    class Boom:
        @property
        def project_id(self):
            raise RuntimeError("raw error mentioning C:/secret/path.json")

    monkeypatch.setattr(fb.credentials, "ApplicationDefault", lambda: Boom())
    fb.init_firebase()
    r = client.get(STATUS_URL, headers=admin_auth_headers)
    assert r.json()["firebase_admin"]["reason"] == "credentials_invalid"
    assert "secret" not in r.text


# ---------------------------------------------------------------- existing behavior


def test_registration_still_works_without_admin_key_or_firebase(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_API_KEY", "")
    monkeypatch.setattr(settings, "FIREBASE_PROJECT_ID", "")
    fb.init_firebase()
    r = client.post(
        "/api/devices/register",
        json={"token": "admin-test-token-1234567890", "platform": "web"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "registered"
    assert client.get("/ready").status_code == 200
    assert client.get("/health").status_code == 200

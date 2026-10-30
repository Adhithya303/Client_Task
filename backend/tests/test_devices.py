import time
from unittest.mock import patch
from pymongo.errors import ServerSelectionTimeoutError
from app.config import settings
from app.database import get_notify_collection


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    # Verify no connection strings or credentials leaked
    assert "mongodb" not in response.text.lower()


def test_readiness_check(client):
    response = client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "ready"


def test_valid_device_registration(client):
    synthetic_token = "synthetic_fcm_token_test_abc123456789"
    payload = {
        "token": synthetic_token,
        "platform": "web",
    }
    response = client.post("/api/devices/register", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "registered"
    assert "registration_id" in data
    assert isinstance(data["registration_id"], str)
    # Ensure token is NOT echoed back in response
    assert synthetic_token not in response.text

    # Verify MongoDB persistence directly in test collection
    col = get_notify_collection()
    doc = col.find_one({"token": synthetic_token})
    assert doc is not None
    assert doc["platform"] == "web"
    assert "created_at" in doc
    assert "updated_at" in doc
    assert "last_seen_at" in doc


def test_repeated_registration_is_idempotent_and_preserves_created_at(client):
    synthetic_token = "synthetic_fcm_token_idempotent_test_987654321"
    payload = {"token": synthetic_token, "platform": "web"}

    # 1. First registration
    res1 = client.post("/api/devices/register", json=payload)
    assert res1.status_code == 200
    id1 = res1.json()["registration_id"]

    col = get_notify_collection()
    doc1 = col.find_one({"token": synthetic_token})
    assert doc1 is not None
    created_at_1 = doc1["created_at"]

    # Sleep briefly to ensure clock ticks
    time.sleep(0.05)

    # 2. Second registration of same token
    res2 = client.post("/api/devices/register", json=payload)
    assert res2.status_code == 200
    id2 = res2.json()["registration_id"]
    assert id1 == id2

    # Exactly one document exists in the collection for this token
    count = col.count_documents({"token": synthetic_token})
    assert count == 1

    doc2 = col.find_one({"token": synthetic_token})
    # created_at is preserved
    assert doc2["created_at"] == created_at_1
    # updated_at and last_seen_at were updated
    assert doc2["updated_at"] >= created_at_1


def test_reject_empty_token(client):
    response = client.post("/api/devices/register", json={"token": "", "platform": "web"})
    assert response.status_code == 422


def test_reject_whitespace_only_token(client):
    response = client.post("/api/devices/register", json={"token": "   ", "platform": "web"})
    assert response.status_code == 422


def test_reject_embedded_whitespace_token(client):
    response = client.post(
        "/api/devices/register",
        json={"token": "token with embedded spaces 123456", "platform": "web"},
    )
    assert response.status_code == 422


def test_valid_android_device_registration(client, test_db):
    token = "synthetic_real_android_token_abc12345"
    response = client.post(
        "/api/devices/register",
        json={"token": token, "platform": "android"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "registered"
    assert "registration_id" in data

    # Clean up test artifact
    test_db[settings.MONGODB_COLLECTION].delete_one({"token": token})


def test_reject_invalid_platform(client):
    response = client.post(
        "/api/devices/register",
        json={"token": "valid_token_string_12345", "platform": "ios"},
    )
    assert response.status_code == 422


def test_device_unregistration(client, test_db):
    token = "synthetic_token_to_unregister_99999"
    reg_response = client.post(
        "/api/devices/register",
        json={"token": token, "platform": "web"},
    )
    assert reg_response.status_code == 200

    unreg_response = client.post(
        "/api/devices/unregister",
        json={"token": token},
    )
    assert unreg_response.status_code == 200
    assert unreg_response.json()["status"] == "unregistered"

    doc = test_db[settings.MONGODB_COLLECTION].find_one({"token": token})
    assert doc is not None
    assert doc["is_active"] is False
    assert "unregistered_at" in doc

    # Clean up
    test_db[settings.MONGODB_COLLECTION].delete_one({"token": token})


def test_device_unregistration_not_found(client):
    response = client.post(
        "/api/devices/unregister",
        json={"token": "non_existent_token_12345678"},
    )
    assert response.status_code == 404


def test_reject_unexpected_fields(client):
    response = client.post(
        "/api/devices/register",
        json={
            "token": "valid_token_string_12345",
            "platform": "web",
            "user_id": "attacker_injected_id",
        },
    )
    assert response.status_code == 422


def test_database_unavailable_returns_503(client):
    synthetic_token = "synthetic_token_db_failure_test"
    with patch(
        "app.database.get_notify_collection",
        side_effect=ServerSelectionTimeoutError("Simulated timeout"),
    ):
        response = client.post(
            "/api/devices/register",
            json={"token": synthetic_token, "platform": "web"},
        )
        assert response.status_code == 503
        data = response.json()
        assert "detail" in data
        # Ensure sanitized error message without leaking internal connection info
        assert "currently unavailable" in data["detail"].lower()
        assert synthetic_token not in response.text

import os
import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

# Use test database for backend tests
TEST_DB_NAME = "fcm_notification_demo_test"
os.environ["MONGODB_DATABASE"] = TEST_DB_NAME
os.environ["MONGODB_COLLECTION"] = "notify_test"

from app.config import settings
settings.MONGODB_DATABASE = TEST_DB_NAME
settings.MONGODB_COLLECTION = "notify_test"

from app.main import app
from app.database import init_database, close_database, get_notify_collection, get_admins_collection, get_mongo_client


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def test_db(client):
    db_client = get_mongo_client()
    return db_client[settings.MONGODB_DATABASE]


from app.auth import create_access_token


@pytest.fixture
def admin_token():
    return create_access_token("admin_test_user")


@pytest.fixture
def admin_auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(autouse=True)
def clean_test_collection():
    """Ensure test collection only contains isolated test tokens and cleanup after test."""
    yield
    try:
        col = get_notify_collection()
        col.delete_many({"platform": {"$in": ["web", "android"]}})
        admins_col = get_admins_collection()
        admins_col.delete_many({"username": {"$regex": "^(cli_|jwt_)"}})
    except Exception:
        pass



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
from app.database import init_database, close_database, get_notify_collection


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def clean_test_collection():
    """Ensure test collection only contains isolated test tokens and cleanup after test."""
    yield
    try:
        col = get_notify_collection()
        # Clean only documents created in the test collection
        col.delete_many({"platform": "web"})
    except Exception:
        pass

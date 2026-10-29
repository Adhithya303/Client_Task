import logging
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from pymongo import MongoClient, ReturnDocument
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, DuplicateKeyError, PyMongoError, ServerSelectionTimeoutError
from fastapi import HTTPException, status
from app.config import settings

logger = logging.getLogger("backend.database")

_mongo_client: Optional[MongoClient] = None


def get_mongo_client() -> MongoClient:
    global _mongo_client
    if _mongo_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database client is not initialized",
        )
    return _mongo_client


def init_database() -> None:
    """
    Initialize MongoDB client, ping the server to verify connectivity,
    and ensure required unique indexes exist on the collection.
    Fails at startup if MongoDB is unreachable.
    """
    global _mongo_client
    logger.info("Connecting to MongoDB...")
    try:
        client = MongoClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=settings.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
        )
        # Verify connection
        client.admin.command("ping")
        logger.info("MongoDB ping successful.")

        db: Database = client[settings.MONGODB_DATABASE]
        collection: Collection = db[settings.MONGODB_COLLECTION]

        # Ensure unique index on token
        collection.create_index("token", unique=True)
        logger.info("Unique index on 'token' verified.")

        _mongo_client = client
    except (ConnectionFailure, ServerSelectionTimeoutError) as err:
        logger.error("Failed to connect to MongoDB at startup: %s", type(err).__name__)
        raise RuntimeError(
            f"Cannot connect to MongoDB at {settings.MONGODB_URI}. "
            "Please ensure MongoDB service is running and accessible."
        ) from err


def close_database() -> None:
    """Close MongoDB client connection on shutdown."""
    global _mongo_client
    if _mongo_client is not None:
        logger.info("Closing MongoDB connection.")
        _mongo_client.close()
        _mongo_client = None


def check_database_ready() -> bool:
    """Check whether MongoDB is currently reachable."""
    if _mongo_client is None:
        return False
    try:
        _mongo_client.admin.command("ping")
        return True
    except PyMongoError:
        return False


def get_notify_collection() -> Collection:
    client = get_mongo_client()
    return client[settings.MONGODB_DATABASE][settings.MONGODB_COLLECTION]


def upsert_device_token(token: str, platform: str) -> str:
    """
    Atomically register or update a device token in the notify collection.
    - Preserves created_at for existing registrations.
    - Updates platform, updated_at, and last_seen_at.
    - Handles concurrent duplicate-key races cleanly.
    - Returns the document's string ID.
    """
    now = datetime.now(timezone.utc)

    try:
        collection = get_notify_collection()
        try:
            doc = collection.find_one_and_update(
                {"token": token},
                {
                    "$setOnInsert": {
                        "created_at": now,
                    },
                    "$set": {
                        "platform": platform,
                        "updated_at": now,
                        "last_seen_at": now,
                    },
                },
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError:
            # Race condition on unique index upsert; update the existing document
            doc = collection.find_one_and_update(
                {"token": token},
                {
                    "$set": {
                        "platform": platform,
                        "updated_at": now,
                        "last_seen_at": now,
                    },
                },
                return_document=ReturnDocument.AFTER,
            )

        if not doc or "_id" not in doc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Registration document could not be retrieved",
            )

        return str(doc["_id"])

    except (ConnectionFailure, ServerSelectionTimeoutError) as err:
        logger.error("MongoDB unavailable during upsert: %s", type(err).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service currently unavailable",
        ) from err
    except PyMongoError as err:
        logger.error("Database error during registration: %s", type(err).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service error occurred",
        ) from err

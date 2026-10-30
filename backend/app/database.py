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

        # Ensure unique index on token and sorting index on last_seen_at
        collection.create_index("token", unique=True)
        collection.create_index([("last_seen_at", -1)])
        logger.info("Indexes on 'notify' collection verified.")

        # Ensure unique index on admin username
        admins_collection: Collection = db[settings.ADMINS_COLLECTION]
        admins_collection.create_index("username", unique=True)
        logger.info("Unique index on 'admins' collection verified.")

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


def is_database_initialized() -> bool:
    """Return whether the MongoDB client is currently initialized."""
    return _mongo_client is not None


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
    - Reactivates previously inactive tokens and clears unregistered_at.
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
                        "is_active": True,
                    },
                    "$unset": {
                        "unregistered_at": "",
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
                        "is_active": True,
                    },
                    "$unset": {
                        "unregistered_at": "",
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


def get_device_by_id(device_id: str) -> Optional[dict]:
    """Retrieve device document by string ObjectId."""
    try:
        oid = ObjectId(device_id)
    except Exception:
        return None

    try:
        collection = get_notify_collection()
        return collection.find_one({"_id": oid})
    except (ConnectionFailure, ServerSelectionTimeoutError) as err:
        logger.error("MongoDB unavailable during get_device_by_id: %s", type(err).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service currently unavailable",
        ) from err
    except PyMongoError as err:
        logger.error("Database error during get_device_by_id: %s", type(err).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service error occurred",
        ) from err


def mark_device_inactive(device_id: str) -> None:
    """
    Mark device inactive with an unregistered_at timestamp after FCM reports it unregistered.
    Does not delete the document.
    """
    try:
        oid = ObjectId(device_id)
    except Exception:
        return

    now = datetime.now(timezone.utc)
    try:
        collection = get_notify_collection()
        collection.update_one(
            {"_id": oid},
            {
                "$set": {
                    "is_active": False,
                    "unregistered_at": now,
                    "updated_at": now,
                }
            },
        )
    except (ConnectionFailure, ServerSelectionTimeoutError) as err:
        logger.error("MongoDB unavailable during mark_device_inactive: %s", type(err).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service currently unavailable",
        ) from err
    except PyMongoError as err:
        logger.error("Database error during mark_device_inactive: %s", type(err).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service error occurred",
        ) from err


def list_devices(limit: int = 50, offset: int = 0) -> tuple[list[dict], int]:
    """
    Return paginated devices sorted by recent activity (last_seen_at desc, _id desc) and total count.
    Never exposes raw tokens outside DB layer without masking.
    """
    try:
        collection = get_notify_collection()
        total = collection.count_documents({})
        cursor = (
            collection.find({})
            .sort([("last_seen_at", -1), ("_id", -1)])
            .skip(offset)
            .limit(limit)
        )
        return list(cursor), total
    except (ConnectionFailure, ServerSelectionTimeoutError) as err:
        logger.error("MongoDB unavailable during list_devices: %s", type(err).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service currently unavailable",
        ) from err
    except PyMongoError as err:
        logger.error("Database error during list_devices: %s", type(err).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service error occurred",
        ) from err


def unregister_device_token(token: str) -> None:
    """
    Marks a device token inactive and records unregistered_at timestamp.
    Used when a device logs out or disables notifications.
    """
    now = datetime.now(timezone.utc)
    try:
        collection = get_notify_collection()
        res = collection.update_one(
            {"token": token},
            {
                "$set": {
                    "is_active": False,
                    "unregistered_at": now,
                    "updated_at": now,
                }
            },
        )
        if res.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device token not found.",
            )
    except HTTPException:
        raise
    except (ConnectionFailure, ServerSelectionTimeoutError) as err:
        logger.error("MongoDB unavailable during unregister_device_token: %s", type(err).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service currently unavailable",
        ) from err
    except PyMongoError as err:
        logger.error("Database error during unregister_device_token: %s", type(err).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service error occurred",
        ) from err


def get_admins_collection() -> Collection:
    client = get_mongo_client()
    return client[settings.MONGODB_DATABASE][settings.ADMINS_COLLECTION]


def get_admin_user(username: str) -> Optional[dict]:
    """Retrieve admin user document by username."""
    try:
        col = get_admins_collection()
        return col.find_one({"username": username})
    except (ConnectionFailure, ServerSelectionTimeoutError) as err:
        logger.error("MongoDB unavailable during get_admin_user: %s", type(err).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service currently unavailable",
        ) from err
    except PyMongoError as err:
        logger.error("Database error during get_admin_user: %s", type(err).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service error occurred",
        ) from err


def create_admin_user(username: str, password_hash: str) -> dict:
    """Create a new admin user record with hashed password."""
    now = datetime.now(timezone.utc)
    doc = {
        "username": username,
        "password_hash": password_hash,
        "created_at": now,
        "updated_at": now,
    }
    try:
        col = get_admins_collection()
        res = col.insert_one(doc)
        doc["_id"] = res.inserted_id
        return doc
    except DuplicateKeyError as err:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Admin username '{username}' already exists.",
        ) from err
    except (ConnectionFailure, ServerSelectionTimeoutError) as err:
        logger.error("MongoDB unavailable during create_admin_user: %s", type(err).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service currently unavailable",
        ) from err
    except PyMongoError as err:
        logger.error("Database error during create_admin_user: %s", type(err).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service error occurred",
        ) from err


def count_admins() -> int:
    """Return total count of provisioned admin users."""
    try:
        col = get_admins_collection()
        return col.count_documents({})
    except Exception:
        return 0


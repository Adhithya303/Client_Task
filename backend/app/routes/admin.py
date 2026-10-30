from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth import require_admin_key
from app.database import (
    check_database_ready,
    get_device_by_id,
    list_devices,
)
from app.firebase import get_firebase_status, send_fcm_notification
from app.schemas import (
    DeviceItem,
    DeviceListResponse,
    SendNotificationRequest,
    SendNotificationResponse,
)

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin_key)],
)


@router.get(
    "/status",
    summary="Admin status (backend, MongoDB, Firebase Admin initialization)",
)
def admin_status():
    firebase = get_firebase_status()
    return {
        "backend": "reachable",
        "mongodb": "reachable" if check_database_ready() else "unreachable",
        "firebase_admin": {
            "state": "initialized" if firebase["initialized"] else "unavailable",
            "reason": firebase["reason"],
            "message": firebase["message"],
        },
        "notice": (
            "'initialized' means server credentials loaded for the expected project. "
            "It does not verify permission to send, and no notification has been sent."
        ),
    }


@router.get(
    "/devices",
    response_model=DeviceListResponse,
    summary="List registered devices (paginated, masked tokens)",
    description=(
        "Returns a bounded, paginated list of registered devices sorted by recent activity. "
        "Tokens are masked to a short suffix and the full token is never returned."
    ),
)
def get_devices(
    limit: int = Query(default=50, ge=1, le=100, description="Maximum number of devices to return (1-100)"),
    offset: int = Query(default=0, ge=0, description="Pagination offset (>=0)"),
) -> DeviceListResponse:
    docs, total = list_devices(limit=limit, offset=offset)

    items = []
    now = datetime.now(timezone.utc)
    for doc in docs:
        token = doc.get("token", "")
        masked_suffix = f"...{token[-6:]}" if len(token) > 6 else token
        items.append(
            DeviceItem(
                registration_id=str(doc["_id"]),
                platform=doc.get("platform", "web"),
                token_suffix=masked_suffix,
                created_at=doc.get("created_at") or now,
                last_seen_at=doc.get("last_seen_at") or now,
                is_active=doc.get("is_active", True),
            )
        )

    return DeviceListResponse(
        devices=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/notifications/send",
    response_model=SendNotificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Send notification to a registered device",
    description=(
        "Retrieves the device token from MongoDB on the server and dispatches a push notification "
        "via the Firebase Admin SDK. Returns 'accepted' once accepted by FCM. "
        "Note: Acceptance by FCM does not guarantee delivery or display on the device."
    ),
)
def send_notification(request: SendNotificationRequest) -> SendNotificationResponse:
    # 1. Validate MongoDB ObjectId format
    if not ObjectId.is_valid(request.registration_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid registration_id format. Must be a 24-character hexadecimal string.",
        )

    # 2. Retrieve token from database
    device = get_device_by_id(request.registration_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found.",
        )

    # 3. Ensure device token is active
    if not device.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Device token is marked inactive because it was previously reported as unregistered by FCM. The device must re-register before receiving notifications.",
        )

    token = device.get("token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Device record contains no registration token.",
        )

    # 4. Dispatch notification via Firebase Admin SDK
    message_id = send_fcm_notification(
        token=token,
        title=request.title,
        body=request.body,
        registration_id=request.registration_id,
        custom_data=request.data,
    )

    return SendNotificationResponse(
        status="accepted",
        message_id=message_id,
        registration_id=request.registration_id,
    )

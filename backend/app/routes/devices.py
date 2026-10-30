import logging
from fastapi import APIRouter, status
from app.schemas import (
    DeviceRegisterRequest,
    DeviceRegisterResponse,
    DeviceUnregisterRequest,
    DeviceUnregisterResponse,
)
from app.database import unregister_device_token, upsert_device_token

logger = logging.getLogger("backend.devices")
router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.post(
    "/register",
    response_model=DeviceRegisterResponse,
    status_code=status.HTTP_200_OK,
    summary="Register or update device FCM token",
    description="Idempotently registers an FCM token in MongoDB without storing user identity.",
)
def register_device(request: DeviceRegisterRequest) -> DeviceRegisterResponse:
    # Mask token for logging: never log full token in logs or responses
    masked_token = (
        request.token[:6] + "..." + request.token[-4:]
        if len(request.token) > 12
        else "***"
    )
    logger.info("Registering device token: %s (platform=%s)", masked_token, request.platform)

    registration_id = upsert_device_token(
        token=request.token,
        platform=request.platform,
    )

    return DeviceRegisterResponse(
        status="registered",
        registration_id=registration_id,
    )


@router.post(
    "/unregister",
    response_model=DeviceUnregisterResponse,
    status_code=status.HTTP_200_OK,
    summary="Unregister device FCM token",
    description="Marks a device token inactive when a device logs out or disables notifications.",
)
def unregister_device(request: DeviceUnregisterRequest) -> DeviceUnregisterResponse:
    masked_token = (
        request.token[:6] + "..." + request.token[-4:]
        if len(request.token) > 12
        else "***"
    )
    logger.info("Unregistering device token: %s", masked_token)

    unregister_device_token(token=request.token)

    return DeviceUnregisterResponse(status="unregistered")


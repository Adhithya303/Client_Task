"""
Firebase Admin SDK initialization (credentials only; no message sending yet).

- Uses Application Default Credentials. The operator sets GOOGLE_APPLICATION_CREDENTIALS
  in the backend server process environment; this module never reads, prints, or copies
  the key file or its contents.
- Initializes exactly once and reuses the app afterwards.
- Failures are reduced to short reason codes. Raw provider exceptions, file paths and
  credential contents are never stored or returned.
- "initialized" only means credentials loaded and match the expected project. It does NOT
  prove the service account is permitted to send FCM messages.
"""
import logging
import os
import threading
from typing import Dict, Optional

import firebase_admin
from firebase_admin import credentials

from app.config import settings

logger = logging.getLogger("backend.firebase")

STATE_NOT_ATTEMPTED = "not_attempted"
STATE_INITIALIZED = "initialized"
STATE_UNAVAILABLE = "unavailable"

# Sanitized reason codes -> safe human-readable messages
REASON_MESSAGES: Dict[str, str] = {
    "project_id_not_configured": "FIREBASE_PROJECT_ID is not configured on the server.",
    "credentials_not_configured": "Server credentials (GOOGLE_APPLICATION_CREDENTIALS) are not configured.",
    "credentials_invalid": "Server credentials could not be loaded.",
    "credentials_project_unknown": "Credentials do not report a project ID, so the project cannot be verified.",
    "project_id_mismatch": "Credentials belong to a different Firebase project than FIREBASE_PROJECT_ID.",
    "initialization_failed": "Firebase Admin SDK initialization failed.",
}

_lock = threading.Lock()
_state: str = STATE_NOT_ATTEMPTED
_reason: Optional[str] = None
_app: Optional[firebase_admin.App] = None


def _fail(reason: str) -> None:
    global _state, _reason
    _state = STATE_UNAVAILABLE
    _reason = reason
    logger.warning("Firebase Admin unavailable (%s)", reason)


def init_firebase() -> None:
    """Initialize Firebase Admin once. Never raises; failures are recorded as reason codes."""
    global _state, _reason, _app
    with _lock:
        if _state == STATE_INITIALIZED:
            return

        expected_project = settings.FIREBASE_PROJECT_ID.strip()
        if not expected_project:
            _fail("project_id_not_configured")
            return
        if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            _fail("credentials_not_configured")
            return

        try:
            cred = credentials.ApplicationDefault()
            credential_project = cred.project_id  # lazily loads credentials
        except Exception:  # noqa: BLE001 - deliberately sanitized
            _fail("credentials_invalid")
            return

        if not credential_project:
            _fail("credentials_project_unknown")
            return
        if credential_project != expected_project:
            _fail("project_id_mismatch")
            return

        try:
            try:
                _app = firebase_admin.get_app()
            except ValueError:
                _app = firebase_admin.initialize_app(
                    cred,
                    options={
                        "projectId": expected_project,
                        "httpTimeout": settings.FCM_REQUEST_TIMEOUT_SECONDS,
                    },
                )
        except Exception:  # noqa: BLE001 - deliberately sanitized
            _fail("initialization_failed")
            return

        _state = STATE_INITIALIZED
        _reason = None
        logger.info("Firebase Admin initialized for the expected project.")


def get_firebase_status() -> Dict[str, Optional[str]]:
    """Sanitized status for diagnostics. Contains no paths, keys, or provider errors."""
    return {
        "state": _state,
        "initialized": _state == STATE_INITIALIZED,
        "reason": _reason,
        "message": REASON_MESSAGES.get(_reason) if _reason else None,
    }


def send_fcm_notification(token: str, title: str, body: str, registration_id: str) -> str:
    """
    Sends a push notification to a registered device token using the Firebase Admin SDK.
    Returns the FCM message ID upon acceptance by FCM.
    Catches FCM-specific errors and maps them to appropriate sanitized HTTPExceptions.
    Handles permanently unregistered tokens by marking them inactive in MongoDB.
    """
    from fastapi import HTTPException, status
    from firebase_admin import exceptions, messaging

    status_info = get_firebase_status()
    if not status_info["initialized"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Firebase Admin service is unavailable ({status_info.get('reason') or 'not_configured'}). Notification sending is not operational.",
        )

    # Build notification payload compatible with foreground and background handlers
    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        data={
            "title": title,
            "body": body,
        },
        token=token,
    )

    try:
        message_id = messaging.send(message)
        logger.info(
            "FCM message accepted for registration_id=%s (message_id=%s)",
            registration_id,
            message_id,
        )
        return message_id
    except messaging.UnregisteredError as err:
        logger.warning(
            "FCM token is permanently unregistered for registration_id=%s; marking inactive.",
            registration_id,
        )
        from app.database import mark_device_inactive
        mark_device_inactive(registration_id)
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="The target device token is permanently unregistered with FCM and has been marked inactive. The device must re-register before receiving notifications.",
        ) from err
    except (exceptions.UnauthenticatedError, exceptions.PermissionDeniedError) as err:
        logger.error(
            "Firebase authentication/authorization failure during send: %s",
            type(err).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Firebase authentication or authorization failed. Check server credentials and IAM permissions.",
        ) from err
    except (exceptions.DeadlineExceededError, TimeoutError) as err:
        logger.warning(
            "FCM request timed out for registration_id=%s: %s",
            registration_id,
            type(err).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Request to FCM provider timed out. Warning: do not automatically retry; the notification may have already been accepted and retrying may produce duplicate notifications.",
        ) from err
    except (exceptions.UnavailableError, messaging.QuotaExceededError) as err:
        logger.warning(
            "FCM service temporarily unavailable for registration_id=%s: %s",
            registration_id,
            type(err).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="FCM service is temporarily unavailable or quota exceeded. Please try again later. Warning: manual retry may cause duplicate delivery if the prior attempt was received.",
        ) from err
    except messaging.SenderIdMismatchError as err:
        logger.warning(
            "FCM SenderIdMismatch for registration_id=%s",
            registration_id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FCM sender ID mismatch for the target device token.",
        ) from err
    except exceptions.InvalidArgumentError as err:
        logger.warning(
            "Invalid argument error during FCM send for registration_id=%s",
            registration_id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FCM notification payload or target token was rejected as invalid.",
        ) from err
    except exceptions.FirebaseError as err:
        logger.error(
            "Firebase error during FCM send: %s",
            type(err).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="FCM notification dispatch failed.",
        ) from err
    except HTTPException:
        raise
    except Exception as err:
        logger.error(
            "Unexpected error during notification dispatch: %s",
            type(err).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during notification dispatch.",
        ) from err


def reset_firebase_for_tests() -> None:
    """Reset module state (tests only)."""
    global _state, _reason, _app
    with _lock:
        _state = STATE_NOT_ATTEMPTED
        _reason = None
        _app = None

"""
Admin authentication and authorization module.
Supports:
1. Modern OAuth2 Bearer JWT access tokens with short expiry, audience, and issuer validation.
2. Secure password hashing with bcrypt.
3. Backward-compatible X-Admin-Key header for CLI / testing integration.
"""
from datetime import datetime, timedelta, timezone
import hmac
import logging
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.security.api_key import APIKeyHeader
import jwt

from app.config import settings
from app.database import get_admin_user

logger = logging.getLogger("backend.auth")

oauth2_scheme = HTTPBearer(auto_error=False)
admin_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt with random salt."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception as err:
        logger.warning("Password verification failed with exception: %s", type(err).__name__)
        return False


def create_access_token(username: str) -> str:
    """
    Generate a signed, short-lived JWT access token for an authenticated admin.
    Includes sub, iat, exp, iss, and aud claims.
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": username,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
    }
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict:
    """
    Verify signature, algorithm, expiration, issuer, and audience claims of a JWT.
    Raises HTTPException 401 on any validation failure.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE,
            options={"require": ["sub", "exp", "iat", "iss", "aud"]},
        )
        return payload
    except jwt.ExpiredSignatureError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin session token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from err
    except jwt.InvalidTokenError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from err


def get_current_admin(
    bearer: Optional[HTTPAuthorizationCredentials] = Security(oauth2_scheme),
    x_admin_key: Optional[str] = Security(admin_key_header),
) -> str:
    """
    Authorizes an admin request.
    Priority 1: Bearer token from 'Authorization: Bearer <token>' header.
    Priority 2: X-Admin-Key header matching ADMIN_API_KEY (backward-compatibility).
    Rejects with 401 Unauthorized if neither is valid.
    """
    # 1. Bearer Token Authentication
    if bearer and bearer.credentials:
        payload = decode_access_token(bearer.credentials)
        username = payload.get("sub")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token subject missing.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return username

    # 2. X-Admin-Key Header (backward-compatibility fallback for tests/CLI)
    server_key = settings.ADMIN_API_KEY
    if server_key and x_admin_key:
        try:
            if hmac.compare_digest(x_admin_key.encode("utf-8"), server_key.encode("utf-8")):
                return "api_key_admin"
        except Exception:
            pass

    # Neither Bearer token nor valid X-Admin-Key provided
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Admin access denied. Valid Bearer JWT token or admin key required.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_admin_key(
    admin_user: str = Depends(get_current_admin),
) -> str:
    """
    Dependency wrapper ensuring admin authorization on routes.
    Accepts valid OAuth2 Bearer token or matching X-Admin-Key.
    """
    return admin_user

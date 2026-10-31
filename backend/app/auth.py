"""
Admin authentication and authorization module.
Strictly requires modern OAuth2 Bearer JWT access tokens with short expiry,
signature verification, algorithm checking, audience, issuer, and subject claims.
Legacy X-Admin-Key header support has been removed in favor of authenticated admin accounts.
"""
from datetime import datetime, timedelta, timezone
import logging
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt

from app.config import settings

logger = logging.getLogger("backend.auth")

oauth2_scheme = HTTPBearer(auto_error=False)


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
    credentials: Optional[HTTPAuthorizationCredentials] = Security(oauth2_scheme),
) -> str:
    """
    Authorizes an admin request strictly via OAuth2 Bearer JWT token.
    Rejects with 401 Unauthorized if token is missing, malformed, expired, or invalid.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin access denied. Valid Bearer JWT token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return str(username)


def require_admin_key(
    admin_user: str = Depends(get_current_admin),
) -> str:
    """
    Dependency wrapper ensuring admin authorization on protected routes.
    """
    return admin_user

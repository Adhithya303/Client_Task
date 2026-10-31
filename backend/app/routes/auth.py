from collections import defaultdict
import logging
from threading import Lock
import time
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.auth import (
    create_access_token,
    get_current_admin,
    verify_password,
)
from app.config import settings
from app.database import get_admin_user
from app.schemas import AdminLoginRequest, TokenResponse

logger = logging.getLogger("backend.auth_routes")
router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRateLimiter:
    """
    Sliding window in-memory rate limiter for admin login attempts.
    Tracks failed and total login attempts per IP and username.
    """

    def __init__(self, max_attempts: int = 5, window_seconds: int = 60):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts = defaultdict(list)
        self._lock = Lock()

    def check_rate_limit(self, key: str) -> bool:
        now = time.time()
        with self._lock:
            # Filter attempts within the active time window
            self._attempts[key] = [
                t for t in self._attempts[key] if now - t < self.window_seconds
            ]
            return len(self._attempts[key]) < self.max_attempts

    def record_attempt(self, key: str) -> None:
        now = time.time()
        with self._lock:
            self._attempts[key].append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            if key in self._attempts:
                del self._attempts[key]


login_limiter = LoginRateLimiter(max_attempts=5, window_seconds=60)


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Obtain admin OAuth2 JWT access token",
    description="Authenticates an admin user using credentials and returns a short-lived signed JWT bearer token.",
)
def login_for_access_token(
    request: AdminLoginRequest,
    req: Request,
) -> TokenResponse:
    username = request.username.strip()
    password = request.password

    # Determine rate limiting key based on client IP and target username
    client_ip = req.client.host if req.client else "unknown"
    rate_limit_key = f"{client_ip}:{username.lower()}"

    if not login_limiter.check_rate_limit(rate_limit_key):
        logger.warning(
            "Rate limit exceeded for admin login attempt: ip=%s, user=%s",
            client_ip,
            username,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please wait 60 seconds before trying again.",
            headers={"Retry-After": "60"},
        )

    admin_doc = get_admin_user(username)

    is_authenticated = False
    if admin_doc and "password_hash" in admin_doc:
        is_authenticated = verify_password(password, admin_doc["password_hash"])

    if not is_authenticated:
        login_limiter.record_attempt(rate_limit_key)
        logger.warning(
            "Failed login attempt for username: %s from IP: %s", username, client_ip
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Reset rate limiting counter upon successful authentication
    login_limiter.reset(rate_limit_key)

    access_token = create_access_token(username=username)
    logger.info("Admin user '%s' authenticated successfully.", username)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        username=username,
    )


@router.get(
    "/me",
    summary="Get currently authenticated admin user",
    description="Validates Bearer token and returns current user identity.",
)
def get_current_user_profile(
    current_user: str = Depends(get_current_admin),
) -> dict:
    return {
        "username": current_user,
        "status": "authenticated",
        "role": "admin",
    }

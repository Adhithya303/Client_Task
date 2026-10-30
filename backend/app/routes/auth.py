import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

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


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Obtain admin OAuth2 JWT access token",
    description="Authenticates an admin user using credentials and returns a short-lived signed JWT bearer token.",
)
def login_for_access_token(request: AdminLoginRequest) -> TokenResponse:
    username = request.username.strip()
    password = request.password

    admin_doc = get_admin_user(username)

    is_authenticated = False
    if admin_doc and "password_hash" in admin_doc:
        is_authenticated = verify_password(password, admin_doc["password_hash"])
    elif settings.ADMIN_API_KEY and username.lower() == "admin" and password == settings.ADMIN_API_KEY:
        # Fallback bootstrap: allow default admin user when configured with ADMIN_API_KEY
        is_authenticated = True

    if not is_authenticated:
        logger.warning("Failed login attempt for username: %s", username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

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
    description="Validates Bearer token or admin key and returns current user identity.",
)
def get_current_user_profile(
    current_user: str = Depends(get_current_admin),
) -> dict:
    return {
        "username": current_user,
        "status": "authenticated",
        "role": "admin",
    }

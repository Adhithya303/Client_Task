"""
Simple shared admin API key for LOCAL DEMO use only (not user authentication).

Usage on any future admin route:
    @router.post("/...", dependencies=[Depends(require_admin_key)])
"""
import hmac
from typing import Optional

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.config import settings

admin_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)


def require_admin_key(x_admin_key: Optional[str] = Security(admin_key_header)) -> None:
    """
    Deny unless the X-Admin-Key header matches ADMIN_API_KEY.
    Denies when the server key is not configured, or the header is missing/incorrect.
    The key is never logged or echoed.
    """
    server_key = settings.ADMIN_API_KEY
    if not server_key or not x_admin_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin access denied",
        )
    # Compare as bytes so non-ASCII input cannot raise; constant-time for equal lengths.
    if not hmac.compare_digest(x_admin_key.encode("utf-8"), server_key.encode("utf-8")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin access denied",
        )

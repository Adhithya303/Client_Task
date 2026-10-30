import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import check_database_ready, close_database, init_database
from app.firebase import init_firebase
from app.routes import admin, auth, devices

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("backend.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Application starting up...")
    init_database()
    # Non-fatal: missing/invalid Firebase credentials must not break MongoDB endpoints.
    init_firebase()
    yield
    # Shutdown
    logger.info("Application shutting down...")
    close_database()


app = FastAPI(
    title="Push Notification Backend API",
    description="FastAPI service for managing FCM device registrations in MongoDB.",
    version="1.0.0",
    lifespan=lifespan,
)

# Strict development CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health", status_code=status.HTTP_200_OK, tags=["system"])
def health_check():
    """Basic liveness check. Does not expose credentials or connection strings."""
    return {"status": "ok"}


@app.get("/ready", status_code=status.HTTP_200_OK, tags=["system"])
def readiness_check():
    """Readiness probe. Verifies MongoDB connectivity."""
    if not check_database_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service not ready",
        )
    return {"status": "ready", "database": "connected"}


# Include device registration routes
app.include_router(devices.router)

# Include auth routes (OAuth2 JWT tokens and user profile)
app.include_router(auth.router)

# Admin routes (protected by OAuth2 Bearer / admin key)
app.include_router(admin.router)


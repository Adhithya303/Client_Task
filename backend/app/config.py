import json
from pathlib import Path
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Predictable .env path relative to this file (backend/.env)
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DATABASE: str = "fcm_notification_demo"
    MONGODB_COLLECTION: str = "notify"
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "https://localhost",
        "http://localhost",
        "capacitor://localhost",
    ]
    MONGODB_SERVER_SELECTION_TIMEOUT_MS: int = 3000

    # Local-demo shared admin key (sent by clients in X-Admin-Key). Never a VITE_ variable.
    ADMIN_API_KEY: str = ""
    # Expected Firebase project ID; credentials for any other project are rejected.
    FIREBASE_PROJECT_ID: str = ""
    # Bounded provider request timeout for FCM calls (seconds)
    FCM_REQUEST_TIMEOUT_SECONDS: int = 10

    # OAuth2 / JWT Admin Authentication Settings
    JWT_SECRET_KEY: str = "insecure-local-demo-jwt-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_ISSUER: str = "fcm-notification-demo"
    JWT_AUDIENCE: str = "fcm-admin-app"
    ADMINS_COLLECTION: str = "admins"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            v_trimmed = v.strip()
            if v_trimmed.startswith("[") and v_trimmed.endswith("]"):
                try:
                    parsed = json.loads(v_trimmed)
                    if isinstance(parsed, list):
                        return parsed
                except json.JSONDecodeError:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


settings = Settings()

import re
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class DeviceRegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(
        ...,
        min_length=10,
        max_length=500,
        description="FCM device registration token",
    )
    platform: Literal["web"] = Field(
        "web",
        description="Client device platform (must be 'web' in this phase)",
    )

    @field_validator("token")
    @classmethod
    def validate_token(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Token cannot be empty or whitespace only")
        # Ensure no whitespace inside the token
        if re.search(r"\s", v):
            raise ValueError("Token must not contain whitespace characters")
        return v


class DeviceRegisterResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["registered"] = "registered"
    registration_id: str

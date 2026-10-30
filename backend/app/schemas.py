from datetime import datetime
import re
from typing import List, Literal
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


class DeviceItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    registration_id: str = Field(
        ...,
        description="MongoDB document ID string",
    )
    platform: str = Field(
        ...,
        description="Client device platform",
    )
    token_suffix: str = Field(
        ...,
        description="Short masked token suffix for distinguishing devices (never full token)",
    )
    created_at: datetime = Field(
        ...,
        description="UTC timestamp of initial registration",
    )
    last_seen_at: datetime = Field(
        ...,
        description="UTC timestamp of most recent device activity or sync",
    )
    is_active: bool = Field(
        ...,
        description="Whether this device token is active and eligible to receive push notifications",
    )


class DeviceListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    devices: List[DeviceItem] = Field(
        ...,
        description="List of registered devices sorted by recent activity",
    )
    total: int = Field(
        ...,
        description="Total number of registered devices in database",
    )
    limit: int = Field(
        ...,
        description="Pagination limit",
    )
    offset: int = Field(
        ...,
        description="Pagination offset",
    )


class SendNotificationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    registration_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Stored MongoDB document ID of the target device",
    )
    title: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Notification title (1 to 100 characters)",
    )
    body: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Notification body text (1 to 1000 characters)",
    )

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("title cannot be empty or whitespace only")
        return trimmed

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("body cannot be empty or whitespace only")
        return trimmed


class SendNotificationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["accepted"] = "accepted"
    message_id: str = Field(
        ...,
        description="FCM message ID returned upon acceptance by Firebase",
    )
    registration_id: str = Field(
        ...,
        description="Target device MongoDB document ID",
    )

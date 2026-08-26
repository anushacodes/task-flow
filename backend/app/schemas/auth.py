"""Authentication Pydantic schemas."""

from __future__ import annotations

from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegisterRequest(BaseModel):
    """User registration payload."""

    email: EmailStr
    name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    """Direct JSON login payload."""

    email: EmailStr
    password: str = Field(min_length=1)


class UserResponse(BaseModel):
    """User response model."""

    id: uuid.UUID
    email: EmailStr
    name: str
    avatar_url: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    """Access token payload returned on authentication."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int

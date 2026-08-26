"""Workspace Pydantic schemas."""

from __future__ import annotations

from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class WorkspaceCreate(BaseModel):
    """Payload for workspace creation."""

    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=1000)


class WorkspaceUpdate(BaseModel):
    """Payload for updating workspace properties."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=1000)


class WorkspaceResponse(BaseModel):
    """Full workspace entity response."""

    id: uuid.UUID
    name: str
    description: str | None = None
    owner_id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkspaceListItem(BaseModel):
    """Workspace summary for multi-workspace lists."""

    id: uuid.UUID
    name: str
    description: str | None = None
    role: str
    member_count: int = 1


class WorkspaceMemberResponse(BaseModel):
    """Member profile with workspace-scoped role."""

    user_id: uuid.UUID
    name: str
    email: EmailStr
    avatar_url: str | None = None
    role: str
    joined_at: datetime


class InviteRequest(BaseModel):
    """Payload for inviting new member to a workspace."""

    email: EmailStr
    role: str = Field(default="MEMBER", pattern="^(ADMIN|MEMBER)$")


class RoleUpdateRequest(BaseModel):
    """Payload for updating a member's role."""

    role: str = Field(pattern="^(ADMIN|MEMBER)$")


class OwnershipTransferRequest(BaseModel):
    """Payload for transferring workspace ownership."""

    new_owner_id: uuid.UUID

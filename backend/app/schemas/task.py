"""Pydantic schemas for Task, Tag, and Board operations."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
import uuid

from pydantic import BaseModel, ConfigDict, Field


class TagCreate(BaseModel):
    """Schema for creating a workspace tag."""

    name: str = Field(..., min_length=1, max_length=50)
    color: str | None = Field(None, max_length=7)


class TagResponse(BaseModel):
    """Schema for returning a tag."""

    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    color: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserSummary(BaseModel):
    """Minimal user profile summary for task assignee/creator."""

    id: uuid.UUID
    name: str
    email: str
    avatar_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class TaskBlockerSummary(BaseModel):
    """Minimal blocker reference for task card and detail views."""

    id: uuid.UUID
    title: str
    status: str

    model_config = ConfigDict(from_attributes=True)


class TaskCreate(BaseModel):
    """Schema for creating a new task."""

    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    status: str = Field("TODO", pattern="^(TODO|IN_PROGRESS|IN_REVIEW|DONE)$")
    due_date: date | None = None
    assignee_id: uuid.UUID | None = None
    commands: list[dict[str, Any]] | None = None
    tag_ids: list[uuid.UUID] | None = None


class TaskUpdate(BaseModel):
    """Schema for modifying existing task attributes."""

    title: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = None
    status: str | None = Field(None, pattern="^(TODO|IN_PROGRESS|IN_REVIEW|DONE)$")
    due_date: date | None = None
    assignee_id: uuid.UUID | None = None
    commands: list[dict[str, Any]] | None = None
    tag_ids: list[uuid.UUID] | None = None


class TaskResponse(BaseModel):
    """Detailed task object representation."""

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: str | None
    status: str
    due_date: date | None
    is_overdue: bool = False
    is_blocked: bool = False
    assignee: UserSummary | None = None
    tags: list[TagResponse] = []
    blockers: list[TaskBlockerSummary] = []
    blocking: list[TaskBlockerSummary] = []
    commands: list[dict[str, Any]] | None = None
    series_id: uuid.UUID | None = None
    series_instance_num: int | None = None
    created_by_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BoardResponse(BaseModel):
    """Kanban board representation partitioned by status columns."""

    columns: dict[str, list[TaskResponse]] = {
        "TODO": [],
        "IN_PROGRESS": [],
        "IN_REVIEW": [],
        "DONE": [],
    }

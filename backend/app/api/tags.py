"""Tags API router."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import RoleChecker, WorkspaceAccess, require_member
from app.db.engine import get_db
from app.schemas.task import TagCreate, TagResponse
from app.services import tag_service

router = APIRouter(tags=["tags"])
require_admin = RoleChecker("ADMIN")


@router.get(
    "/workspaces/{workspace_id}/tags",
    response_model=list[TagResponse],
    summary="List tags for a workspace",
)
async def list_tags(
    workspace_id: uuid.UUID,
    q: str | None = Query(None, description="Search tag by name"),
    access: WorkspaceAccess = Depends(require_member),
    db: AsyncSession = Depends(get_db),
) -> list[TagResponse]:
    """Return all tags scoped to the workspace."""
    tags = await tag_service.list_tags(db, workspace_id, q)
    return [TagResponse.model_validate(t) for t in tags]


@router.post(
    "/workspaces/{workspace_id}/tags",
    response_model=TagResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or retrieve workspace tag",
)
async def create_tag(
    workspace_id: uuid.UUID,
    req: TagCreate,
    access: WorkspaceAccess = Depends(require_member),
    db: AsyncSession = Depends(get_db),
) -> TagResponse:
    """Create a new tag within the specified workspace."""
    tag = await tag_service.create_tag(db, workspace_id, req)
    return TagResponse.model_validate(tag)


@router.delete(
    "/workspaces/{workspace_id}/tags/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete workspace tag",
)
async def delete_tag(
    workspace_id: uuid.UUID,
    tag_id: uuid.UUID,
    access: WorkspaceAccess = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete tag and cascade remove from associated tasks."""
    await tag_service.delete_tag(db, workspace_id, tag_id)

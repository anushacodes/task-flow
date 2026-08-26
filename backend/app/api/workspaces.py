"""Workspace API router."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import (
    WorkspaceAccess,
    get_current_user,
    require_admin,
    require_member,
    require_owner,
)
from app.db.engine import get_db
from app.models.user import User
from app.schemas.workspace import (
    InviteRequest,
    OwnershipTransferRequest,
    RoleUpdateRequest,
    WorkspaceCreate,
    WorkspaceListItem,
    WorkspaceMemberResponse,
    WorkspaceResponse,
    WorkspaceUpdate,
)
from app.services import workspace_service

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.post(
    "",
    response_model=WorkspaceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new workspace",
)
async def create_workspace(
    req: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    """Create workspace with caller as owner."""
    return await workspace_service.create_workspace(db, current_user, req)


@router.get(
    "",
    response_model=list[WorkspaceListItem],
    summary="List workspaces the authenticated user belongs to",
)
async def list_workspaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WorkspaceListItem]:
    """Return all active workspaces of the current user."""
    return await workspace_service.list_workspaces(db, current_user)


@router.get(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
    summary="Get workspace details",
)
async def get_workspace(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    """Get single workspace if caller is an active member."""
    return await workspace_service.get_workspace(db, workspace_id, current_user)


@router.patch(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
    summary="Update workspace details",
)
async def update_workspace(
    workspace_id: uuid.UUID,
    req: WorkspaceUpdate,
    access: WorkspaceAccess = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    """Update workspace name or description (ADMIN+ required)."""
    return await workspace_service.update_workspace(db, workspace_id, req, access)


@router.delete(
    "/{workspace_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete workspace",
)
async def delete_workspace(
    workspace_id: uuid.UUID,
    access: WorkspaceAccess = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft delete workspace (OWNER required)."""
    await workspace_service.delete_workspace(db, workspace_id, access)


@router.post(
    "/{workspace_id}/transfer",
    response_model=WorkspaceResponse,
    summary="Transfer workspace ownership",
)
async def transfer_ownership(
    workspace_id: uuid.UUID,
    req: OwnershipTransferRequest,
    access: WorkspaceAccess = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    """Transfer ownership to another workspace member (OWNER required)."""
    return await workspace_service.transfer_ownership(db, workspace_id, req.new_owner_id, access)


@router.get(
    "/{workspace_id}/members",
    response_model=list[WorkspaceMemberResponse],
    summary="List workspace members",
)
async def list_members(
    workspace_id: uuid.UUID,
    access: WorkspaceAccess = Depends(require_member),
    db: AsyncSession = Depends(get_db),
) -> list[WorkspaceMemberResponse]:
    """List members and their roles within the workspace."""
    return await workspace_service.list_members(db, workspace_id)


@router.post(
    "/{workspace_id}/invites",
    response_model=WorkspaceMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a teammate to the workspace",
)
async def invite_member(
    workspace_id: uuid.UUID,
    req: InviteRequest,
    access: WorkspaceAccess = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceMemberResponse:
    """Invite user by email (ADMIN+ required)."""
    return await workspace_service.invite_member(db, workspace_id, req, access)


@router.patch(
    "/{workspace_id}/members/{user_id}",
    response_model=WorkspaceMemberResponse,
    summary="Update a member's role",
)
async def update_member_role(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    req: RoleUpdateRequest,
    access: WorkspaceAccess = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceMemberResponse:
    """Update role of a member in workspace (ADMIN+ required)."""
    return await workspace_service.update_member_role(db, workspace_id, user_id, req, access)


@router.delete(
    "/{workspace_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a member from the workspace",
)
async def remove_member(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    access: WorkspaceAccess = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove member from workspace (ADMIN+ required)."""
    await workspace_service.remove_member(db, workspace_id, user_id, access)

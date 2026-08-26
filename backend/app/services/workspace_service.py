"""Workspace management and membership service."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import WorkspaceAccess
from app.models.user import User
from app.models.workspace import ROLE_RANK, Workspace, WorkspaceMembership
from app.schemas.workspace import (
    InviteRequest,
    RoleUpdateRequest,
    WorkspaceCreate,
    WorkspaceListItem,
    WorkspaceMemberResponse,
    WorkspaceResponse,
    WorkspaceUpdate,
)


async def create_workspace(
    db: AsyncSession,
    user: User,
    req: WorkspaceCreate,
) -> WorkspaceResponse:
    """Create a new workspace and assign owner role to creator."""
    workspace = Workspace(
        name=req.name.strip(),
        description=req.description.strip() if req.description else None,
        owner_id=user.id,
    )
    db.add(workspace)
    await db.flush()

    membership = WorkspaceMembership(
        workspace_id=workspace.id,
        user_id=user.id,
        role="OWNER",
    )
    db.add(membership)
    await db.flush()
    await db.refresh(workspace)

    return WorkspaceResponse.model_validate(workspace)


async def list_workspaces(
    db: AsyncSession,
    user: User,
) -> list[WorkspaceListItem]:
    """List all active workspaces the user belongs to with their roles."""
    member_count_subq = (
        select(
            WorkspaceMembership.workspace_id,
            func.count(WorkspaceMembership.user_id).label("member_count"),
        )
        .group_by(WorkspaceMembership.workspace_id)
        .subquery()
    )

    stmt = (
        select(
            Workspace.id,
            Workspace.name,
            Workspace.description,
            WorkspaceMembership.role,
            func.coalesce(member_count_subq.c.member_count, 1).label("member_count"),
        )
        .join(WorkspaceMembership, WorkspaceMembership.workspace_id == Workspace.id)
        .outerjoin(member_count_subq, member_count_subq.c.workspace_id == Workspace.id)
        .where(
            WorkspaceMembership.user_id == user.id,
            Workspace.is_active.is_(True),
        )
        .order_by(Workspace.created_at.desc())
    )

    result = await db.execute(stmt)
    rows = result.all()
    return [
        WorkspaceListItem(
            id=row.id,
            name=row.name,
            description=row.description,
            role=row.role,
            member_count=row.member_count,
        )
        for row in rows
    ]


async def get_workspace(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user: User,
) -> WorkspaceResponse:
    """Get single workspace if caller is an active member."""
    stmt = (
        select(Workspace)
        .join(WorkspaceMembership, WorkspaceMembership.workspace_id == Workspace.id)
        .where(
            Workspace.id == workspace_id,
            WorkspaceMembership.user_id == user.id,
            Workspace.is_active.is_(True),
        )
    )
    result = await db.execute(stmt)
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied",
        )
    return WorkspaceResponse.model_validate(workspace)


async def update_workspace(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    req: WorkspaceUpdate,
    access: WorkspaceAccess,
) -> WorkspaceResponse:
    """Update workspace details (ADMIN+ permissions required)."""
    workspace = access.workspace
    if req.name is not None:
        workspace.name = req.name.strip()
    if req.description is not None:
        workspace.description = req.description.strip() or None

    await db.flush()
    await db.refresh(workspace)
    return WorkspaceResponse.model_validate(workspace)


async def delete_workspace(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    access: WorkspaceAccess,
) -> None:
    """Soft delete workspace (OWNER permission required)."""
    if access.role != "OWNER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace owner can delete workspace",
        )
    access.workspace.is_active = False
    await db.flush()


async def transfer_ownership(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    new_owner_id: uuid.UUID,
    access: WorkspaceAccess,
) -> WorkspaceResponse:
    """Transfer workspace ownership to another existing member."""
    if access.role != "OWNER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace owner can transfer ownership",
        )

    if new_owner_id == access.user.id:
        return WorkspaceResponse.model_validate(access.workspace)

    stmt = select(WorkspaceMembership).where(
        WorkspaceMembership.workspace_id == workspace_id,
        WorkspaceMembership.user_id == new_owner_id,
    )
    result = await db.execute(stmt)
    target_membership = result.scalar_one_or_none()
    if not target_membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user is not a member of this workspace",
        )

    stmt_owner = select(WorkspaceMembership).where(
        WorkspaceMembership.workspace_id == workspace_id,
        WorkspaceMembership.user_id == access.user.id,
    )
    res_owner = await db.execute(stmt_owner)
    current_owner_membership = res_owner.scalar_one()

    current_owner_membership.role = "ADMIN"
    target_membership.role = "OWNER"
    access.workspace.owner_id = new_owner_id

    await db.flush()
    await db.refresh(access.workspace)
    return WorkspaceResponse.model_validate(access.workspace)


async def list_members(
    db: AsyncSession,
    workspace_id: uuid.UUID,
) -> list[WorkspaceMemberResponse]:
    """List all members and their roles in a workspace."""
    stmt = (
        select(User, WorkspaceMembership)
        .join(WorkspaceMembership, WorkspaceMembership.user_id == User.id)
        .where(
            WorkspaceMembership.workspace_id == workspace_id,
            User.is_active.is_(True),
        )
        .order_by(WorkspaceMembership.joined_at.asc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        WorkspaceMemberResponse(
            user_id=user.id,
            name=user.name,
            email=user.email,
            avatar_url=user.avatar_url,
            role=membership.role,
            joined_at=membership.joined_at,
        )
        for user, membership in rows
    ]


async def invite_member(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    req: InviteRequest,
    access: WorkspaceAccess,
) -> WorkspaceMemberResponse:
    """Invite user by email into workspace (ADMIN+ required)."""
    email_norm = req.email.lower().strip()
    stmt = select(User).where(User.email == email_norm)
    res = await db.execute(stmt)
    target_user = res.scalar_one_or_none()

    if not target_user:
        target_user = User(
            email=email_norm,
            name=email_norm.split("@")[0],
            password_hash="temp-invite-placeholder",
        )
        db.add(target_user)
        await db.flush()

    stmt_m = select(WorkspaceMembership).where(
        WorkspaceMembership.workspace_id == workspace_id,
        WorkspaceMembership.user_id == target_user.id,
    )
    res_m = await db.execute(stmt_m)
    existing_m = res_m.scalar_one_or_none()
    if existing_m:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this workspace",
        )

    membership = WorkspaceMembership(
        workspace_id=workspace_id,
        user_id=target_user.id,
        role=req.role,
        invited_by_id=access.user.id,
    )
    db.add(membership)
    await db.flush()

    return WorkspaceMemberResponse(
        user_id=target_user.id,
        name=target_user.name,
        email=target_user.email,
        avatar_url=target_user.avatar_url,
        role=membership.role,
        joined_at=membership.joined_at,
    )


async def update_member_role(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    target_user_id: uuid.UUID,
    req: RoleUpdateRequest,
    access: WorkspaceAccess,
) -> WorkspaceMemberResponse:
    """Update role of an existing member (ADMIN+ required)."""
    if target_user_id == access.workspace.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change role of the workspace owner; use transfer ownership instead",
        )

    stmt = (
        select(User, WorkspaceMembership)
        .join(WorkspaceMembership, WorkspaceMembership.user_id == User.id)
        .where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.user_id == target_user_id,
        )
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this workspace",
        )

    target_user, membership = row

    if membership.role == "ADMIN" and access.role != "OWNER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace owner can modify another admin's role",
        )

    membership.role = req.role
    await db.flush()

    return WorkspaceMemberResponse(
        user_id=target_user.id,
        name=target_user.name,
        email=target_user.email,
        avatar_url=target_user.avatar_url,
        role=membership.role,
        joined_at=membership.joined_at,
    )


async def remove_member(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    target_user_id: uuid.UUID,
    access: WorkspaceAccess,
) -> None:
    """Remove member from workspace (ADMIN+ required)."""
    if target_user_id == access.workspace.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the workspace owner",
        )

    stmt = select(WorkspaceMembership).where(
        WorkspaceMembership.workspace_id == workspace_id,
        WorkspaceMembership.user_id == target_user_id,
    )
    result = await db.execute(stmt)
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this workspace",
        )

    if membership.role == "ADMIN" and access.role != "OWNER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace owner can remove an admin",
        )

    await db.delete(membership)
    await db.flush()

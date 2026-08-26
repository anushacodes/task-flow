"""FastAPI dependency injection utilities for authentication and RBAC."""

from __future__ import annotations

from dataclasses import dataclass
import uuid

from fastapi import Depends, HTTPException, Path, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.engine import get_db
from app.models.user import User
from app.models.workspace import ROLE_RANK, Workspace, WorkspaceMembership

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


@dataclass
class WorkspaceAccess:
    """Encapsulates authenticated user context within a specific workspace."""

    user: User
    workspace: Workspace
    role: str
    workspace_id: uuid.UUID


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate bearer token and resolve authenticated User entity."""
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = uuid.UUID(payload["sub"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    return user


async def get_workspace_role(
    workspace_id: uuid.UUID = Path(..., description="Target workspace identifier"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceAccess:
    """Resolve and enforce membership of the user in the specified workspace."""
    stmt = (
        select(WorkspaceMembership, Workspace)
        .join(Workspace, Workspace.id == WorkspaceMembership.workspace_id)
        .where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.user_id == user.id,
            Workspace.is_active.is_(True),
        )
    )
    result = await db.execute(stmt)
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this workspace",
        )

    membership, workspace = row
    return WorkspaceAccess(
        user=user,
        workspace=workspace,
        role=membership.role,
        workspace_id=workspace_id,
    )


class RoleChecker:
    """Callable dependency enforcing minimum workspace role requirements."""

    def __init__(self, minimum_role: str) -> None:
        self.minimum_role = minimum_role

    def __call__(
        self,
        access: WorkspaceAccess = Depends(get_workspace_role),
    ) -> WorkspaceAccess:
        """Verify role rank satisfies minimum requirement."""
        user_rank = ROLE_RANK.get(access.role, 0)
        required_rank = ROLE_RANK.get(self.minimum_role, 0)

        if user_rank < required_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action requires at least '{self.minimum_role}' permissions in this workspace",
            )
        return access


require_member = RoleChecker("MEMBER")
require_admin = RoleChecker("ADMIN")
require_owner = RoleChecker("OWNER")

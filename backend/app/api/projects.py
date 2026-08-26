"""Projects API router."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import WorkspaceAccess, require_admin, require_member
from app.db.engine import get_db
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services import project_service

router = APIRouter(prefix="/workspaces/{workspace_id}/projects", tags=["projects"])


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project in the workspace",
)
async def create_project(
    workspace_id: uuid.UUID,
    req: ProjectCreate,
    access: WorkspaceAccess = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """Create project inside workspace (ADMIN+ required)."""
    return await project_service.create_project(db, workspace_id, req, access)


@router.get(
    "",
    response_model=list[ProjectResponse],
    summary="List all projects in workspace",
)
async def list_projects(
    workspace_id: uuid.UUID,
    status: str | None = Query(default=None, pattern="^(ACTIVE|ARCHIVED)$"),
    access: WorkspaceAccess = Depends(require_member),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectResponse]:
    """List projects matching optional status filter."""
    return await project_service.list_projects(db, workspace_id, status)


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Get project details",
)
async def get_project(
    workspace_id: uuid.UUID,
    project_id: uuid.UUID,
    access: WorkspaceAccess = Depends(require_member),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """Retrieve project by ID within workspace."""
    return await project_service.get_project(db, workspace_id, project_id)


@router.patch(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Update project details",
)
async def update_project(
    workspace_id: uuid.UUID,
    project_id: uuid.UUID,
    req: ProjectUpdate,
    access: WorkspaceAccess = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """Update project name, description, or status (ADMIN+ required)."""
    return await project_service.update_project(db, workspace_id, project_id, req, access)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project",
)
async def delete_project(
    workspace_id: uuid.UUID,
    project_id: uuid.UUID,
    access: WorkspaceAccess = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete project from workspace (ADMIN+ required)."""
    await project_service.delete_project(db, workspace_id, project_id, access)

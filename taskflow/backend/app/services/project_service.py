"""Project management service."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import WorkspaceAccess
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate


async def create_project(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    req: ProjectCreate,
    access: WorkspaceAccess,
) -> ProjectResponse:
    """Create a new project inside the workspace (ADMIN+ required)."""
    stmt = select(Project).where(
        Project.workspace_id == workspace_id,
        Project.name == req.name.strip(),
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A project with this name already exists in this workspace",
        )

    project = Project(
        workspace_id=workspace_id,
        name=req.name.strip(),
        description=req.description.strip() if req.description else None,
        status="ACTIVE",
        created_by_id=access.user.id,
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)

    return ProjectResponse.model_validate(project)


async def list_projects(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    status_filter: str | None = None,
) -> list[ProjectResponse]:
    """List all projects in workspace matching optional status filter."""
    stmt = select(Project).where(Project.workspace_id == workspace_id)
    if status_filter:
        stmt = stmt.where(Project.status == status_filter.upper())
    stmt = stmt.order_by(Project.created_at.desc())

    result = await db.execute(stmt)
    projects = result.scalars().all()
    return [ProjectResponse.model_validate(p) for p in projects]


async def get_project(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    project_id: uuid.UUID,
) -> ProjectResponse:
    """Retrieve project by ID within workspace."""
    stmt = select(Project).where(
        Project.id == project_id,
        Project.workspace_id == workspace_id,
    )
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found in this workspace",
        )
    return ProjectResponse.model_validate(project)


async def update_project(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    project_id: uuid.UUID,
    req: ProjectUpdate,
    access: WorkspaceAccess,
) -> ProjectResponse:
    """Update project name, description, or status (ADMIN+ required)."""
    stmt = select(Project).where(
        Project.id == project_id,
        Project.workspace_id == workspace_id,
    )
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found in this workspace",
        )

    if req.name is not None:
        project.name = req.name.strip()
    if req.description is not None:
        project.description = req.description.strip() or None
    if req.status is not None:
        project.status = req.status

    await db.flush()
    await db.refresh(project)
    return ProjectResponse.model_validate(project)


async def delete_project(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    project_id: uuid.UUID,
    access: WorkspaceAccess,
) -> None:
    """Delete a project from workspace (ADMIN+ required)."""
    stmt = select(Project).where(
        Project.id == project_id,
        Project.workspace_id == workspace_id,
    )
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found in this workspace",
        )
    await db.delete(project)
    await db.flush()

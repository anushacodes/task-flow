"""Tasks API router for Kanban board and task lifecycle."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.engine import get_db
from app.models.user import User
from app.schemas.task import BoardResponse, TaskCreate, TaskResponse, TaskUpdate
from app.services import task_service

router = APIRouter(tags=["tasks"])


@router.get(
    "/projects/{project_id}/tasks",
    summary="List tasks for a project or fetch Kanban board grouping",
)
async def list_project_tasks(
    project_id: uuid.UUID,
    status: list[str] | None = Query(None),
    assignee_id: list[uuid.UUID] | None = Query(None),
    tag_id: list[uuid.UUID] | None = Query(None),
    view: str | None = Query(None, description="Set to 'board' for column grouping"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TaskResponse] | BoardResponse:
    """Retrieve filtered project tasks or partitioned Kanban board columns."""
    return await task_service.list_tasks(
        db=db,
        project_id=project_id,
        status_filter=status,
        assignee_filter=assignee_id,
        tag_filter=tag_id,
        view=view,
    )


@router.post(
    "/projects/{project_id}/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new task in a project",
)
async def create_task(
    project_id: uuid.UUID,
    req: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    """Create and return a new task within the specified project."""
    return await task_service.create_task(db, project_id, req, current_user)


@router.get(
    "/tasks/{task_id}",
    response_model=TaskResponse,
    summary="Get detailed task object",
)
async def get_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    """Retrieve full task details including blockers, tags, and assignee."""
    return await task_service.get_task(db, task_id)


@router.patch(
    "/tasks/{task_id}",
    response_model=TaskResponse,
    summary="Update task fields or transition status",
)
async def update_task(
    task_id: uuid.UUID,
    req: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    """Update task attributes and validate blocker constraints on status transitions."""
    return await task_service.update_task(db, task_id, req, current_user)


@router.delete(
    "/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete task",
)
async def delete_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Permanently delete a task."""
    await task_service.delete_task(db, task_id)


@router.post(
    "/tasks/{task_id}/blockers",
    response_model=TaskResponse,
    summary="Add a blocker dependency to a task",
)
async def add_blocker(
    task_id: uuid.UUID,
    blocker_id: uuid.UUID = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    """Add a blocker relationship with cycle detection."""
    return await task_service.add_blocker(db, task_id, blocker_id, current_user)


@router.delete(
    "/tasks/{task_id}/blockers/{blocker_id}",
    response_model=TaskResponse,
    summary="Remove a blocker dependency from a task",
)
async def remove_blocker(
    task_id: uuid.UUID,
    blocker_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    """Remove an existing blocker relationship."""
    return await task_service.remove_blocker(db, task_id, blocker_id)

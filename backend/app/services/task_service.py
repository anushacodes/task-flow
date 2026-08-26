"""Task domain service for CRUD, state transitions, and Kanban boards."""

from __future__ import annotations

from collections import deque
from datetime import date
import uuid

from fastapi import HTTPException, status
from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.project import Project
from app.models.tag import Tag
from app.models.task import Task, task_blockers, task_tags
from app.models.user import User
from app.models.workspace import WorkspaceMembership
from app.schemas.task import (
    BoardResponse,
    TagResponse,
    TaskBlockerSummary,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
    UserSummary,
)


def _serialize_task(task: Task) -> TaskResponse:
    """Transform SQLAlchemy Task model to TaskResponse with computed fields."""
    today = date.today()
    is_overdue = bool(task.due_date and task.due_date < today and task.status != "DONE")
    is_blocked = any(b.status != "DONE" for b in (task.blockers or []))

    assignee_summary = (
        UserSummary(
            id=task.assignee.id,
            name=task.assignee.name,
            email=task.assignee.email,
            avatar_url=task.assignee.avatar_url,
        )
        if task.assignee
        else None
    )

    tags_list = [
        TagResponse(
            id=t.id,
            workspace_id=t.workspace_id,
            name=t.name,
            color=t.color,
            created_at=t.created_at,
        )
        for t in (task.tags or [])
    ]

    blockers_list = [
        TaskBlockerSummary(
            id=b.id,
            title=b.title,
            status=b.status,
        )
        for b in (task.blockers or [])
    ]

    blocking_list = [
        TaskBlockerSummary(
            id=b.id,
            title=b.title,
            status=b.status,
        )
        for b in (task.blocking or [])
    ]

    return TaskResponse(
        id=task.id,
        project_id=task.project_id,
        title=task.title,
        description=task.description,
        status=task.status,
        due_date=task.due_date,
        is_overdue=is_overdue,
        is_blocked=is_blocked,
        assignee=assignee_summary,
        tags=tags_list,
        blockers=blockers_list,
        blocking=blocking_list,
        commands=task.commands,
        series_id=task.series_id,
        series_instance_num=task.series_instance_num,
        created_by_id=task.created_by_id,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


async def _get_project_with_workspace(db: AsyncSession, project_id: uuid.UUID) -> Project:
    """Resolve active project entity."""
    stmt = select(Project).where(Project.id == project_id)
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


async def _validate_workspace_member(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    """Validate that specified user is a member of the workspace."""
    stmt = select(WorkspaceMembership).where(
        WorkspaceMembership.workspace_id == workspace_id,
        WorkspaceMembership.user_id == user_id,
    )
    result = await db.execute(stmt)
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignee must be a member of the workspace",
        )


async def create_task(
    db: AsyncSession,
    project_id: uuid.UUID,
    req: TaskCreate,
    current_user: User,
) -> TaskResponse:
    """Create a new task within a project."""
    project = await _get_project_with_workspace(db, project_id)

    if req.assignee_id:
        await _validate_workspace_member(db, project.workspace_id, req.assignee_id)

    task = Task(
        project_id=project_id,
        title=req.title.strip(),
        description=req.description.strip() if req.description else None,
        status=req.status,
        due_date=req.due_date,
        assignee_id=req.assignee_id,
        commands=req.commands,
        created_by_id=current_user.id,
    )
    db.add(task)
    await db.flush()

    if req.tag_ids:
        tag_stmt = select(Tag).where(
            Tag.id.in_(req.tag_ids),
            Tag.workspace_id == project.workspace_id,
        )
        tag_result = await db.execute(tag_stmt)
        tags = list(tag_result.scalars().all())
        for tag in tags:
            await db.execute(insert(task_tags).values(task_id=task.id, tag_id=tag.id))
        await db.flush()

    return await get_task(db, task.id)


async def get_task(db: AsyncSession, task_id: uuid.UUID) -> TaskResponse:
    """Fetch single task with all eager relationships."""
    stmt = (
        select(Task)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.tags),
            selectinload(Task.blockers),
            selectinload(Task.blocking),
        )
        .where(Task.id == task_id)
    )
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    return _serialize_task(task)


async def list_tasks(
    db: AsyncSession,
    project_id: uuid.UUID,
    status_filter: list[str] | None = None,
    assignee_filter: list[uuid.UUID] | None = None,
    tag_filter: list[uuid.UUID] | None = None,
    view: str | None = None,
) -> list[TaskResponse] | BoardResponse:
    """List tasks with multi-dimensional filtering or Kanban board grouping."""
    stmt = (
        select(Task)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.tags),
            selectinload(Task.blockers),
            selectinload(Task.blocking),
        )
        .where(Task.project_id == project_id)
    )

    if status_filter:
        stmt = stmt.where(Task.status.in_(status_filter))

    if assignee_filter:
        stmt = stmt.where(Task.assignee_id.in_(assignee_filter))

    if tag_filter:
        for t_id in tag_filter:
            stmt = stmt.where(
                Task.id.in_(
                    select(task_tags.c.task_id).where(task_tags.c.tag_id == t_id)
                )
            )

    stmt = stmt.order_by(Task.created_at.asc())
    result = await db.execute(stmt)
    tasks = [_serialize_task(t) for t in result.scalars().all()]

    if view == "board":
        board: dict[str, list[TaskResponse]] = {
            "TODO": [],
            "IN_PROGRESS": [],
            "IN_REVIEW": [],
            "DONE": [],
        }
        for task in tasks:
            if task.status in board:
                board[task.status].append(task)
        return BoardResponse(columns=board)

    return tasks


async def update_task(
    db: AsyncSession,
    task_id: uuid.UUID,
    req: TaskUpdate,
    current_user: User,
) -> TaskResponse:
    """Update task fields and enforce blocker constraints."""
    stmt = (
        select(Task)
        .options(
            selectinload(Task.project),
            selectinload(Task.blockers),
            selectinload(Task.tags),
        )
        .where(Task.id == task_id)
    )
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    if req.status == "IN_PROGRESS":
        incomplete_blockers = [b for b in task.blockers if b.status != "DONE"]
        if incomplete_blockers:
            blocker_titles = ", ".join(f"'{b.title}'" for b in incomplete_blockers)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Task is blocked by incomplete tasks: {blocker_titles}",
                headers={"X-Error-Code": "TASK_BLOCKED"},
            )

    if req.assignee_id is not None:
        await _validate_workspace_member(db, task.project.workspace_id, req.assignee_id)
        task.assignee_id = req.assignee_id

    if req.title is not None:
        task.title = req.title.strip()
    if req.description is not None:
        task.description = req.description.strip() if req.description else None
    if req.status is not None:
        task.status = req.status
    if req.due_date is not None:
        task.due_date = req.due_date
    if req.commands is not None:
        task.commands = req.commands

    if req.tag_ids is not None:
        await db.execute(delete(task_tags).where(task_tags.c.task_id == task.id))
        if req.tag_ids:
            tag_stmt = select(Tag).where(
                Tag.id.in_(req.tag_ids),
                Tag.workspace_id == task.project.workspace_id,
            )
            tag_result = await db.execute(tag_stmt)
            tags = list(tag_result.scalars().all())
            for tag in tags:
                await db.execute(insert(task_tags).values(task_id=task.id, tag_id=tag.id))

    await db.flush()
    return await get_task(db, task.id)


async def delete_task(db: AsyncSession, task_id: uuid.UUID) -> None:
    """Delete task and its associations."""
    stmt = select(Task).where(Task.id == task_id)
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    await db.delete(task)
    await db.flush()


async def add_blocker(
    db: AsyncSession,
    task_id: uuid.UUID,
    blocker_id: uuid.UUID,
    current_user: User,
) -> TaskResponse:
    """Add a blocker relationship with cycle detection."""
    if task_id == blocker_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A task cannot block itself",
        )

    stmt = select(Task).where(Task.id.in_([task_id, blocker_id]))
    result = await db.execute(stmt)
    tasks = {t.id: t for t in result.scalars().all()}

    if task_id not in tasks or blocker_id not in tasks:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Both tasks must exist",
        )

    queue = deque([task_id])
    visited = set([task_id])
    while queue:
        curr = queue.popleft()
        if curr == blocker_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Adding this blocker would create a dependency cycle",
                headers={"X-Error-Code": "BLOCKER_CYCLE"},
            )
        blocked_stmt = select(task_blockers.c.blocked_id).where(task_blockers.c.blocker_id == curr)
        blocked_res = await db.execute(blocked_stmt)
        for next_id in blocked_res.scalars().all():
            if next_id not in visited:
                visited.add(next_id)
                queue.append(next_id)

    existing = await db.execute(
        select(task_blockers).where(
            task_blockers.c.blocker_id == blocker_id,
            task_blockers.c.blocked_id == task_id,
        )
    )
    if not existing.first():
        await db.execute(
            insert(task_blockers).values(
                blocker_id=blocker_id,
                blocked_id=task_id,
                created_by_id=current_user.id,
            )
        )
        await db.flush()

    return await get_task(db, task_id)


async def remove_blocker(
    db: AsyncSession,
    task_id: uuid.UUID,
    blocker_id: uuid.UUID,
) -> TaskResponse:
    """Remove a blocker dependency between two tasks."""
    await db.execute(
        delete(task_blockers).where(
            task_blockers.c.blocker_id == blocker_id,
            task_blockers.c.blocked_id == task_id,
        )
    )
    await db.flush()
    return await get_task(db, task_id)

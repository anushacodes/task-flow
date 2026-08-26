"""Tag domain service for workspace label management."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import Tag
from app.schemas.task import TagCreate


async def list_tags(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    q: str | None = None,
) -> list[Tag]:
    """Retrieve workspace tags with optional text search."""
    stmt = select(Tag).where(Tag.workspace_id == workspace_id)
    if q:
        stmt = stmt.where(Tag.name.ilike(f"%{q.strip()}%"))
    stmt = stmt.order_by(Tag.name.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_tag(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    req: TagCreate,
) -> Tag:
    """Create a new tag within a workspace or return existing."""
    normalized_name = req.name.strip()
    stmt = select(Tag).where(
        Tag.workspace_id == workspace_id,
        Tag.name == normalized_name,
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    tag = Tag(
        workspace_id=workspace_id,
        name=normalized_name,
        color=req.color.strip() if req.color else None,
    )
    db.add(tag)
    await db.flush()
    await db.refresh(tag)
    return tag


async def delete_tag(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    tag_id: uuid.UUID,
) -> None:
    """Remove a tag and cascade delete associated task_tags references."""
    stmt = select(Tag).where(
        Tag.id == tag_id,
        Tag.workspace_id == workspace_id,
    )
    result = await db.execute(stmt)
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found in this workspace",
        )
    await db.delete(tag)
    await db.flush()

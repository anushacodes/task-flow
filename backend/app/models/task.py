"""Task database model and blocker/tag association tables."""

from __future__ import annotations

from datetime import date, datetime, timezone
import uuid
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Table,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

task_blockers = Table(
    "task_blockers",
    Base.metadata,
    Column("blocker_id", Uuid(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("blocked_id", Uuid(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), server_default=func.now()),
    Column("created_by_id", Uuid(as_uuid=True), ForeignKey("users.id"), nullable=True),
    CheckConstraint("blocker_id != blocked_id", name="ck_task_blockers_no_self_block"),
)

task_tags = Table(
    "task_tags",
    Base.metadata,
    Column("task_id", Uuid(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Uuid(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    Index("idx_task_tags_tag", "tag_id"),
)


class Task(Base):
    """Core unit of work residing inside a Project."""

    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="TODO", nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    commands: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    series_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("recurring_series.id", ondelete="SET NULL"),
        nullable=True,
    )
    series_instance_num: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assignee_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    series = relationship("RecurringSeries", back_populates="tasks")
    tags = relationship("Tag", secondary=task_tags, back_populates="tasks")

    blockers = relationship(
        "Task",
        secondary=task_blockers,
        primaryjoin="Task.id == task_blockers.c.blocked_id",
        secondaryjoin="Task.id == task_blockers.c.blocker_id",
        back_populates="blocking",
    )
    blocking = relationship(
        "Task",
        secondary=task_blockers,
        primaryjoin="Task.id == task_blockers.c.blocker_id",
        secondaryjoin="Task.id == task_blockers.c.blocked_id",
        back_populates="blockers",
    )

    __table_args__ = (
        CheckConstraint("status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE')", name="ck_tasks_status"),
        Index("idx_tasks_project_status", "project_id", "status"),
        Index("idx_tasks_project_assignee", "project_id", "assignee_id"),
        Index("idx_tasks_project_due", "project_id", "due_date"),
        Index("idx_tasks_series", "series_id"),
    )

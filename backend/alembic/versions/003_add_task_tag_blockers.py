"""Add task, tag, recurring series, and blockers tables.

Revision ID: 003_add_task_tag_blockers
Revises: 002_add_project
Create Date: 2026-08-26 00:00:00.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "003_add_task_tag_blockers"
down_revision = "002_add_project"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create tags, recurring_series, tasks, task_blockers, and task_tags tables."""
    op.create_table(
        "tags",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("workspace_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("color", sa.String(length=7), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE", name="fk_tags_workspace_id_workspaces"),
        sa.PrimaryKeyConstraint("id", name="pk_tags"),
        sa.UniqueConstraint("workspace_id", "name", name="uq_tags_workspace_name"),
    )
    op.create_index("idx_tags_workspace", "tags", ["workspace_id"])

    op.create_table(
        "recurring_series",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("workspace_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("project_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("cadence", sa.String(length=20), nullable=False, server_default="WEEKLY"),
        sa.Column("interval_days", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("template_title", sa.String(length=500), nullable=False),
        sa.Column("template_description", sa.Text(), nullable=True),
        sa.Column("assignee_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("cadence = 'WEEKLY'", name="ck_recurring_series_cadence"),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"], name="fk_recurring_series_assignee_id_users"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE", name="fk_recurring_series_project_id_projects"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE", name="fk_recurring_series_workspace_id_workspaces"),
        sa.PrimaryKeyConstraint("id", name="pk_recurring_series"),
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("project_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="TODO"),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("assignee_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("commands", sa.JSON(), nullable=True),
        sa.Column("series_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("series_instance_num", sa.Integer(), nullable=True),
        sa.Column("created_by_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE')", name="ck_tasks_status"),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"], name="fk_tasks_assignee_id_users"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], name="fk_tasks_created_by_id_users"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE", name="fk_tasks_project_id_projects"),
        sa.ForeignKeyConstraint(["series_id"], ["recurring_series.id"], ondelete="SET NULL", name="fk_tasks_series_id_recurring_series"),
        sa.PrimaryKeyConstraint("id", name="pk_tasks"),
    )
    op.create_index("idx_tasks_project_status", "tasks", ["project_id", "status"])
    op.create_index("idx_tasks_project_assignee", "tasks", ["project_id", "assignee_id"])
    op.create_index("idx_tasks_project_due", "tasks", ["project_id", "due_date"])
    op.create_index("idx_tasks_series", "tasks", ["series_id"])

    op.create_table(
        "task_blockers",
        sa.Column("blocker_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("blocked_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.CheckConstraint("blocker_id != blocked_id", name="ck_task_blockers_no_self_block"),
        sa.ForeignKeyConstraint(["blocked_id"], ["tasks.id"], ondelete="CASCADE", name="fk_task_blockers_blocked_id_tasks"),
        sa.ForeignKeyConstraint(["blocker_id"], ["tasks.id"], ondelete="CASCADE", name="fk_task_blockers_blocker_id_tasks"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], name="fk_task_blockers_created_by_id_users"),
        sa.PrimaryKeyConstraint("blocker_id", "blocked_id", name="pk_task_blockers"),
    )

    op.create_table(
        "task_tags",
        sa.Column("task_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("tag_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE", name="fk_task_tags_tag_id_tags"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE", name="fk_task_tags_task_id_tasks"),
        sa.PrimaryKeyConstraint("task_id", "tag_id", name="pk_task_tags"),
    )
    op.create_index("idx_task_tags_tag", "task_tags", ["tag_id"])


def downgrade() -> None:
    """Drop task and related tables."""
    op.drop_table("task_tags")
    op.drop_table("task_blockers")
    op.drop_table("tasks")
    op.drop_table("recurring_series")
    op.drop_table("tags")

"""Add project table.

Revision ID: 002_add_project
Revises: 001_initial_user_workspace
Create Date: 2026-08-25 20:30:00.000000

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "002_add_project"
down_revision = "001_initial_user_workspace"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create projects table with workspace FK and status constraint."""
    op.create_table(
        "projects",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("workspace_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="ACTIVE", nullable=False),
        sa.Column("created_by_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status IN ('ACTIVE', 'ARCHIVED')", name="ck_projects_status"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], name="fk_projects_created_by_id_users"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE", name="fk_projects_workspace_id_workspaces"),
        sa.PrimaryKeyConstraint("id", name="pk_projects"),
        sa.UniqueConstraint("workspace_id", "name", name="uq_projects_workspace_name"),
    )
    op.create_index("idx_projects_workspace_status", "projects", ["workspace_id", "status"])


def downgrade() -> None:
    """Drop projects table."""
    op.drop_table("projects")

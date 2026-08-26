# Data Model: TaskFlow Team Task Manager

**Phase**: 1 — Design
**Date**: 2026-08-25
**Feature**: `specs/001-taskflow-team-manager`
**Research**: See [research.md](./research.md)

---

## Entity Overview

```
User ──────────────────── WorkspaceMembership ──────── Workspace
                                (role)                     │
                                                           ├── Project ──── Task ──────────────── ActivityFeed
                                                           │              │    │                       (events + comments)
                                                           └── Tag        │    ├── task_blockers
                                                                          │    │   (self-ref M2M)
                                                                          │    ├── task_tags ──── Tag
                                                                          │    └── RecurringSeries
                                                                          │
                                                                          └── RefreshToken
```

---

## Entities

### 1. User

Represents a registered account. One user can belong to many workspaces with independent roles per workspace.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, default gen | UUID v4 |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Login identifier |
| `name` | VARCHAR(100) | NOT NULL | Display name |
| `password_hash` | VARCHAR(255) | NOT NULL | Argon2id via pwdlib |
| `avatar_url` | TEXT | nullable | Profile image URL |
| `is_active` | BOOLEAN | default TRUE | Soft-disable accounts |
| `created_at` | TIMESTAMPTZ | default NOW(), NOT NULL | UTC |
| `updated_at` | TIMESTAMPTZ | auto-updated | UTC |

**Indexes**: `UNIQUE(email)`

**Validation rules**:
- `email` must be a valid email format
- `name` must be 1–100 characters
- `password` (pre-hash) must be ≥ 8 characters

---

### 2. RefreshToken

Stores hashed opaque refresh tokens for revocation and reuse detection.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `token_hash` | VARCHAR(64) | UNIQUE, NOT NULL | SHA-256 of the raw token |
| `user_id` | UUID | FK → users.id, NOT NULL | |
| `family_id` | UUID | NOT NULL | Groups token rotation chain |
| `expires_at` | TIMESTAMPTZ | NOT NULL | 7-day TTL |
| `revoked` | BOOLEAN | default FALSE | |
| `created_at` | TIMESTAMPTZ | default NOW() | |

**Indexes**: `UNIQUE(token_hash)`, `INDEX(user_id, expires_at)`, `INDEX(family_id)`

---

### 3. Workspace

Top-level organizational container. All projects and members are scoped to a workspace.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `name` | VARCHAR(100) | NOT NULL | |
| `description` | TEXT | nullable | |
| `owner_id` | UUID | FK → users.id, NOT NULL | Current owner |
| `is_active` | BOOLEAN | default TRUE | Soft-delete |
| `created_at` | TIMESTAMPTZ | default NOW() | |
| `updated_at` | TIMESTAMPTZ | auto-updated | |

**Indexes**: `INDEX(owner_id)`

**Validation rules**:
- `name` must be 1–100 characters, unique within — no uniqueness constraint globally (workspace names need not be globally unique)
- `owner_id` must reference a user who has an `OWNER` membership

---

### 4. WorkspaceMembership

Join table between User and Workspace. Stores the per-workspace role.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `workspace_id` | UUID | PK (composite), FK → workspaces.id | |
| `user_id` | UUID | PK (composite), FK → users.id | |
| `role` | VARCHAR(20) | NOT NULL, CHECK IN ('OWNER','ADMIN','MEMBER') | |
| `invited_by_id` | UUID | FK → users.id, nullable | Who sent the invite |
| `joined_at` | TIMESTAMPTZ | default NOW() | |

**PK**: `(workspace_id, user_id)`

**Role hierarchy**: `MEMBER < ADMIN < OWNER` (integer comparison: 1, 2, 3)

**Validation rules**:
- Exactly one `OWNER` per workspace at all times (enforced in service layer on transfer)
- A user may hold only one role per workspace (enforced by composite PK)

---

### 5. Project

A named collection of tasks within a workspace.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `workspace_id` | UUID | FK → workspaces.id, NOT NULL | |
| `name` | VARCHAR(200) | NOT NULL | |
| `description` | TEXT | nullable | |
| `status` | VARCHAR(20) | NOT NULL, CHECK IN ('ACTIVE','ARCHIVED') | default 'ACTIVE' |
| `created_by_id` | UUID | FK → users.id | |
| `created_at` | TIMESTAMPTZ | default NOW() | |
| `updated_at` | TIMESTAMPTZ | auto-updated | |

**Indexes**: `INDEX(workspace_id, status)`

**Validation rules**:
- `name` must be 1–200 characters
- Project names must be unique within a workspace: `UNIQUE(workspace_id, name)`

---

### 6. Tag

A workspace-scoped label applied to tasks.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `workspace_id` | UUID | FK → workspaces.id, NOT NULL | |
| `name` | VARCHAR(50) | NOT NULL | e.g. "urgent", "frontend" |
| `color` | VARCHAR(7) | nullable | Hex color, e.g. "#FF5733" |
| `created_at` | TIMESTAMPTZ | default NOW() | |

**Unique constraint**: `UNIQUE(workspace_id, name)` — same tag name in different workspaces are independent entities.

**Indexes**: `INDEX(workspace_id)`

---

### 7. RecurringSeries

Template for recurring task series. Instances reference this entity via FK.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `workspace_id` | UUID | FK → workspaces.id | For scoping |
| `project_id` | UUID | FK → projects.id | Default project for new instances |
| `cadence` | VARCHAR(20) | NOT NULL, CHECK = 'WEEKLY' | v1: weekly only |
| `interval_days` | INTEGER | NOT NULL, default 7 | Days between instances |
| `template_title` | VARCHAR(500) | NOT NULL | |
| `template_description` | TEXT | nullable | |
| `assignee_id` | UUID | FK → users.id, nullable | |
| `is_active` | BOOLEAN | default TRUE | False = no more instances after current |
| `created_at` | TIMESTAMPTZ | default NOW() | |
| `updated_at` | TIMESTAMPTZ | auto-updated | |

---

### 8. Task

The core unit of work. Lives inside a Project.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `project_id` | UUID | FK → projects.id, NOT NULL | |
| `title` | VARCHAR(500) | NOT NULL | |
| `description` | TEXT | nullable | |
| `status` | VARCHAR(20) | NOT NULL, CHECK IN ('TODO','IN_PROGRESS','IN_REVIEW','DONE') | default 'TODO' |
| `due_date` | DATE | nullable | Date only, no time |
| `assignee_id` | UUID | FK → users.id, nullable | Must be a workspace member |
| `commands` | JSONB | nullable | List of `{label, url}` or `{label, cmd}` objects |
| `series_id` | UUID | FK → recurring_series.id, nullable | Non-null = recurring instance |
| `series_instance_num` | INTEGER | nullable | Ordinal position in series |
| `is_overdue` | BOOLEAN | computed / derived | `due_date < NOW() AND status != 'DONE'` |
| `created_by_id` | UUID | FK → users.id | |
| `created_at` | TIMESTAMPTZ | default NOW() | |
| `updated_at` | TIMESTAMPTZ | auto-updated | |

**Indexes**:
```sql
CREATE INDEX idx_tasks_project_status     ON tasks(project_id, status);
CREATE INDEX idx_tasks_project_assignee   ON tasks(project_id, assignee_id);
CREATE INDEX idx_tasks_project_due        ON tasks(project_id, due_date);
CREATE INDEX idx_tasks_series             ON tasks(series_id) WHERE series_id IS NOT NULL;
```

**Status State Machine**:

```
           ┌──────────────────────────────────────────────────────┐
           │                                                      │
     ┌─────▼──────┐     ┌─────────────┐     ┌──────────┐   ┌────▼───┐
     │   TODO     │────▶│ IN_PROGRESS │────▶│ IN_REVIEW│──▶│  DONE  │
     └────────────┘     └─────────────┘     └──────────┘   └────────┘
           ▲                  │  ▲                │               │
           │                  ▼  │                ▼               │
           │            (blocked │           (reopen)            │
           │             check)  │                               │
           └────────────────────────────────────────────────────┘
                         (any column → TODO is allowed)
```

**Blocking constraint**: Transition from `TODO → IN_PROGRESS` is blocked if any entry in `task_blockers` where `blocked_id = this.id` has a `blocker` task with `status != 'DONE'`.

**Validation rules**:
- `title` must be 1–500 characters
- `assignee_id` must be a member of the project's workspace (validated in service layer)
- `commands`: each entry is `{label: string, url: string}` or `{label: string, cmd: string}`

---

### 9. task_blockers (Association Table)

Self-referential many-to-many. Records which tasks block which other tasks.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `blocker_id` | UUID | PK (composite), FK → tasks.id ON DELETE CASCADE | The task doing the blocking |
| `blocked_id` | UUID | PK (composite), FK → tasks.id ON DELETE CASCADE | The task that is blocked |
| `created_at` | TIMESTAMPTZ | default NOW() | |
| `created_by_id` | UUID | FK → users.id | Who set up the block |

**PK**: `(blocker_id, blocked_id)`

**Constraints**:
- `blocker_id != blocked_id` (CHECK constraint — a task cannot block itself)
- Cycle prevention: service layer performs BFS/DFS before inserting a new blocker row

---

### 10. task_tags (Association Table)

Many-to-many between Task and Tag.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `task_id` | UUID | PK (composite), FK → tasks.id ON DELETE CASCADE | |
| `tag_id` | UUID | PK (composite), FK → tags.id ON DELETE CASCADE | |

**Index (for tag-based filtering)**:
```sql
CREATE INDEX idx_task_tags_tag ON task_tags(tag_id);
```

**GIN index on tags for the tasks table** (denormalized fast path for filter queries):
> The filter API joins `task_tags` on tag IDs. The `INDEX(project_id, status, assignee_id)` composite + `INDEX(tag_id)` on `task_tags` covers all filter combinations efficiently at the target scale (1,000 tasks/project).

---

### 11. ActivityFeed

Unified, append-only log of comments and system field-change events per task.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | UUID v7 preferred (monotonic) |
| `task_id` | UUID | FK → tasks.id ON DELETE CASCADE, NOT NULL | |
| `workspace_id` | UUID | FK → workspaces.id, NOT NULL | For workspace-level audit |
| `actor_id` | UUID | FK → users.id, NOT NULL | Who performed the action |
| `entry_type` | VARCHAR(30) | NOT NULL, CHECK IN ('COMMENT','FIELD_CHANGE','TASK_CREATED','BLOCKER_ADDED','BLOCKER_REMOVED','RECURRING_SPAWNED') | |
| `payload` | JSONB | NOT NULL | Type-specific data (see below) |
| `created_at` | TIMESTAMPTZ | default NOW(), NOT NULL | |

**Immutability**: Application-level only. The app user has `INSERT + SELECT` privileges on this table. No `UPDATE` or `DELETE` routes are exposed.

**JSONB payload schemas by entry_type**:

```json
// COMMENT
{"text": "Looks good, merging tomorrow"}

// FIELD_CHANGE
{"field": "status", "from": "TODO", "to": "IN_PROGRESS"}
{"field": "assignee", "from": "user-uuid-A", "to": "user-uuid-B"}
{"field": "due_date", "from": "2026-09-01", "to": "2026-09-15"}

// BLOCKER_ADDED
{"blocker_task_id": "uuid", "blocker_task_title": "Fix login bug"}

// RECURRING_SPAWNED
{"new_task_id": "uuid", "series_id": "uuid", "instance_num": 3}
```

**Indexes**:
```sql
-- Primary query: all entries for a task, newest first (keyset pagination)
CREATE INDEX idx_activity_task_time ON activity_feed(task_id, created_at DESC);

-- Workspace-level audit dashboard
CREATE INDEX idx_activity_workspace_time ON activity_feed(workspace_id, created_at DESC);

-- BRIN for very large tables (use when rows exceed ~10M)
-- CREATE INDEX idx_activity_brin ON activity_feed USING BRIN(created_at);
```

**Pagination**: Keyset on `(created_at DESC, id DESC)` — O(1) regardless of log depth. Pass `before_id` cursor in filter requests.

---

## Relationships Summary

| Relationship | Cardinality | Join / FK |
|---|---|---|
| User ↔ Workspace | M:M | `workspace_memberships(workspace_id, user_id)` |
| Workspace → Project | 1:M | `projects.workspace_id` |
| Workspace → Tag | 1:M | `tags.workspace_id` |
| Project → Task | 1:M | `tasks.project_id` |
| Task ↔ Task (blocking) | M:M self-ref | `task_blockers(blocker_id, blocked_id)` |
| Task ↔ Tag | M:M | `task_tags(task_id, tag_id)` |
| Task → RecurringSeries | M:1 | `tasks.series_id` (nullable) |
| Task → ActivityFeed | 1:M | `activity_feed.task_id` |
| Task → User (assignee) | M:1 | `tasks.assignee_id` (nullable) |

---

## Alembic Naming Convention

```python
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}
```

All constraints use this convention. Migrations are generated via `alembic revision --autogenerate` and reviewed before applying.

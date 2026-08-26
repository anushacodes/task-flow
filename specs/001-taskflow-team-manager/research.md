# Research Findings: TaskFlow Team Task Manager

**Phase**: 0 — Technical Research
**Date**: 2026-08-25
**Feature**: `specs/001-taskflow-team-manager`
**Stack**: Python 3.12 + FastAPI (backend) · React + Vite (frontend)

> **Note**: Validated and refined by 5 parallel specialist research agents (Auth/RBAC, Database/ORM, NLP Parser, React Frontend, Async/Realtime). Key corrections incorporated below.

---

## 1. Authentication Strategy

**Decision**: JWT hybrid pattern — short-lived access token (15–30 min) held in React in-memory state, long-lived opaque refresh token (7 days) in `httpOnly; Secure; SameSite=Lax` cookie; custom auth using **`PyJWT`** + **`pwdlib[argon2]`**; no `fastapi-users`.

**Rationale**:
- Hybrid storage eliminates both XSS risk (access token never in localStorage) and CSRF risk (Authorization header not auto-sent by browsers).
- **`PyJWT`**: `python-jose` has documented maintenance gaps as of 2025 — community migrating to PyJWT, which is the actively-maintained standard.
- **`pwdlib[argon2]`**: `passlib` is unmaintained as of 2025. `pwdlib` is its modern replacement, defaulting to Argon2id (OWASP/NIST first-choice; memory-hard; no 72-byte truncation limit like bcrypt).
- **`fastapi-users` is in official maintenance mode** (no new features planned, late 2025). Rolling custom auth is ~120 lines and gives full control over workspace-scoped role schema.
- Opaque refresh tokens (stored as SHA-256 hash in DB) support rotation and reuse detection (if a revoked token is replayed → nuke the entire token family).

**Alternatives considered**:
- *Session cookies (server-side sessions)*: Requires shared Redis session store, adds infrastructure; better for same-domain monoliths, not SPAs.
- *JWT in localStorage*: XSS-vulnerable; any injected script can steal the token. Industry consensus: never store JWTs in browser storage.
- *`fastapi-users`*: Maintenance mode + flat global role model conflicts with per-workspace RBAC.

---

## 2. Workspace-Scoped RBAC

**Decision**: FastAPI **dependency injection** pattern — a reusable `Depends(require_role(...))` factory that accepts a minimum required role and is injected per route.

**Rationale**:
- Dependency injection is idiomatic FastAPI and composable. A `get_current_workspace_member` dependency resolves the calling user's `WorkspaceMembership` for the target workspace (extracted from path param). A `require_role(WorkspaceRole.ADMIN)` dependency wraps it and raises `403` if the role is insufficient.
- Roles are ordered: `MEMBER < ADMIN < OWNER`. A single integer comparison handles "minimum role" checks.
- This pattern is testable (inject mock dependencies in tests) and avoids cross-cutting middleware that would need to parse route parameters.

**Alternatives considered**:
- *Middleware*: Can't easily access path parameters; role checking requires URL parsing, which is fragile.
- *Decorators*: Non-idiomatic in FastAPI; complicates async context.

---

## 3. Database & ORM

**Decision**: **PostgreSQL 16** (production) + **SQLite** (local dev/test); **SQLAlchemy 2.0 async** with `asyncpg` driver; **Alembic** for migrations; **SQLModel** rejected in favor of plain SQLAlchemy models + Pydantic v2 schemas as separate layers.

**Rationale**:
- PostgreSQL GIN indexes on `tags` (array column) and composite indexes on `(project_id, status, assignee_id)` satisfy SC-003 (filter in <1s for 1,000 tasks) without a search layer.
- SQLAlchemy 2.0 async is the most mature and well-documented async ORM for FastAPI. It integrates cleanly with Alembic.
- SQLModel (Tiangolo's library) merges Pydantic + SQLAlchemy models, which sounds appealing but causes painful edge cases (e.g., relationship loading, Pydantic v2 compatibility). Keeping ORM models and API schemas separate is cleaner.
- Tortoise ORM: less mature, smaller ecosystem, not worth switching from SQLAlchemy.
- Alembic: still the definitive migration tool for SQLAlchemy; `--autogenerate` works well with async engines using `run_sync`.

**Alternatives considered**:
- *Tortoise ORM*: Django-style async ORM, good DX but smaller ecosystem and fewer advanced features.
- *SQLModel*: Appealing but Pydantic v2 integration has rough edges; adds confusion between ORM and schema layers.

---

## 4. Task Blocking (Self-Referential Many-to-Many)

**Decision**: Explicit **`task_blockers` association table** with `(blocker_id, blocked_id)` columns — both foreign keys to `tasks.id`. No ORM-level cascade; blocking state computed on-read or updated on-write via a lightweight trigger/hook.

**Rationale**:
- A self-referential many-to-many is cleanest as an explicit join table. SQLAlchemy `relationship` with `primaryjoin`/`secondaryjoin` and `secondary` pointing to `task_blockers` handles bidirectional queries.
- On status update to `IN_PROGRESS`: backend service checks `task_blockers` for any `blocker_id` where `blocker.status != DONE`. If any exist, raise `409 Conflict` with the blocking task IDs.
- No need for a separate `is_blocked` boolean column — it's always derivable from the join table + blocker statuses. Computing it avoids stale flag bugs.
- Unique constraint on `(blocker_id, blocked_id)` prevents duplicate blocker entries.
- Cycle detection (Task A blocks Task B blocks Task A): enforce on insert via a BFS/DFS check before writing the row.

**Alternatives considered**:
- *Boolean `is_blocked` flag on tasks*: Denormalized; goes stale when blocker status changes.
- *Graph database*: Overkill for this scale; PostgreSQL handles task dependency graphs well at <10k tasks per project.

---

## 5. Recurring Tasks

**Decision**: **`recurring_series` table** (series configuration) + **`series_id` FK on `tasks`**. Spawn logic runs **synchronously within the same request** that marks the task Done (not a background worker).

**Rationale**:
- Separate `recurring_series` table holds the template: `{title, description, assignee_id, tags, commands, cadence}`. Each task instance has a `series_id` FK and a `series_instance_number`.
- When a task is marked Done and `series_id IS NOT NULL` and `series.active = true`: the API handler reads the series config, creates the next task instance (due_date +7 days), and returns both the updated task and the new instance in the response. This keeps things simple and synchronous.
- SC-004 requires new instance visible within 5 seconds — synchronous generation in the same transaction guarantees this.
- Editing "this task only" vs "this and future": the series config is updated for "future" edits; `series_id` is set to NULL for "this task only" detachment.

**Alternatives considered**:
- *Background worker (Celery/ARQ)*: Adds infrastructure complexity. Synchronous generation is simpler, meets SC-004, and avoids failure scenarios where the background job silently fails.
- *Cron job*: Polling-based; less responsive and requires a scheduler service.
- *series_id self-reference on tasks (no separate table)*: Couples template and instance, making "edit series" queries complex.

---

## 6. Activity Log & Comments

**Decision**: Single **`activity_feed` table** with a `entry_type` discriminator column (`COMMENT` or `FIELD_CHANGE`). Append-only enforced at the application layer (no UPDATE/DELETE routes). Paginated via keyset pagination on `(task_id, created_at, id)`.

**Rationale**:
- Unified table simplifies the chronological feed query (single `ORDER BY created_at DESC` with a `task_id` filter).
- `entry_type` discriminator with nullable `comment_text` and nullable `{field_name, old_value, new_value}` columns covers both types. Using JSONB for field-change details gives flexibility for future event types.
- Activity writes are **async fire-and-forward**: the service layer writes activity entries as part of the same database transaction as the field change. No separate queue needed; the DB transaction guarantees consistency.
- Keyset pagination (using `id` as cursor) is O(1) on large datasets vs offset pagination which degrades at depth.
- DB-level constraint: No `ON UPDATE` or `ON DELETE` triggers — enforcement at application layer is sufficient and more transparent.

**Alternatives considered**:
- *Separate `comments` and `activity_events` tables*: Requires UNION query for the unified feed. More normalized but more complex for reads.
- *Event sourcing (append-only event log as source of truth)*: Overkill for this scope; adds significant complexity to the read model.

---

## 7. Natural Language Task Parser

**Decision**: **OpenAI GPT-4o-mini** with **structured output** (JSON Schema response format via the Responses API); **`dateparser` library** for relative date normalization post-LLM; **`rapidfuzz`** for assignee name fuzzy matching against workspace members.

**Rationale**:
- GPT-4o-mini with structured outputs guarantees a valid JSON response matching our schema — no free-form parsing needed. Cost is ~$0.15/1M input tokens, negligible for this use case.
- The LLM extracts: `{title, raw_assignee_name, raw_due_date_expression, tags[]}`. It does NOT resolve the date or match the assignee — those are deterministic operations handled in Python.
- `dateparser` handles relative expressions ("next Friday", "in 3 days", "end of week") robustly with locale awareness.
- `rapidfuzz` (Rust-backed, fast) handles fuzzy matching of extracted assignee names against the workspace member list (WRatio scorer, threshold ≥ 85).
- Workspace member list is passed to the LLM as context in the system prompt to guide extraction (but final resolution is done in Python for reliability).
- Fallback on LLM failure: return 503 with a user-friendly error; do not silently create a malformed task.

**Alternatives considered**:
- *Google Gemini API*: Comparable quality, structured output support added recently. OpenAI's structured output is more battle-tested and documented.
- *Local model (Ollama)*: No API cost but adds infrastructure complexity, model management, and variable quality. Inappropriate for a v1.
- *Free-form LLM + regex parsing*: Unreliable. Structured output eliminates parsing errors entirely.
- *`fuzzywuzzy` / `thefuzz`*: `rapidfuzz` is a drop-in replacement that is 10x faster and Apache-licensed.

---

## 8. Search & Filter

**Decision**: **PostgreSQL native filtering** with composite indexes on `(project_id, status)`, `(project_id, assignee_id)`, and a **GIN index on `tags` array column**. No additional search layer for v1.

**Rationale**:
- Filter queries are simple `WHERE` clause compositions — `AND project_id = ? AND status IN (?) AND assignee_id IN (?) AND tags @> ?`. PostgreSQL query planner will use the composite and GIN indexes efficiently.
- For 1,000 tasks per project (SC-003), this approach returns results in single-digit milliseconds — well within the 1-second requirement.
- Tags stored as `TEXT[]` PostgreSQL array with a GIN index supports the `@>` (contains) operator efficiently.
- A dedicated search layer (Elasticsearch, Meilisearch) is unnecessary at this scale and adds operational overhead.

**Alternatives considered**:
- *Elasticsearch / Meilisearch*: Powerful for full-text search but overkill for structured field filtering at <10k tasks.
- *Storing tags as a separate normalized table*: More relational but requires JOINs that are slower for multi-tag filter queries vs. GIN on array column.

---

## 9. Real-Time Board Updates

**Decision**: **Server-Sent Events (SSE)** via FastAPI's `EventSourceResponse` (using `sse-starlette` library) for board-level updates; scoped per project.

**Rationale**:
- SSE is unidirectional (server → client), which matches the update pattern: server pushes board changes to all connected clients in a project.
- SSE is simpler to implement than WebSockets (no upgrade protocol, works over standard HTTP/2, auto-reconnects in browsers). For ~50 concurrent users (SC-008), SSE handles the load with minimal overhead.
- Each connected client subscribes to `/projects/{id}/events` SSE stream. On task create/update/delete, the API handler publishes an event to an in-memory pub/sub (a simple `asyncio.Queue` per project, managed as a FastAPI singleton). The SSE handler reads from the queue and pushes to the client.
- For v1 with a single server process, in-memory pub/sub is sufficient. A Redis pub/sub layer can be added when scaling to multiple replicas.

**Alternatives considered**:
- *WebSockets*: Bidirectional, more complex. SSE is sufficient for unidirectional push.
- *Polling (every N seconds)*: Simplest but degrades UX (delay between update and display); violates SC-002 intent.
- *Redis pub/sub from day 1*: Premature for a single-server v1. In-memory queue is sufficient and easily upgradeable.

---

## 10. Background Jobs (Recurring Task Generation)

**Decision**: **Synchronous generation** within the same database transaction as the task completion (no external task queue for v1).

**Rationale**:
- When a task is marked Done via `PATCH /tasks/{id}`, the service layer: (1) updates task status, (2) checks if `series_id IS NOT NULL`, (3) if so, creates the next task instance, (4) commits the transaction. Both operations succeed or fail together.
- This is the simplest approach that satisfies SC-004 (next instance visible within 5 seconds — it's created before the response returns).
- FastAPI `BackgroundTasks` was considered but introduces a race: the client might poll the board before the background task completes.
- Celery/ARQ: significant infrastructure overhead (Redis broker, worker processes) not warranted for synchronous generation of a single new task row.

**Alternatives considered**:
- *FastAPI `BackgroundTasks`*: Runs after response is sent; tiny race window before the new task appears. Fails SC-004 edge case.
- *Celery + Redis*: Robust for distributed workers but far exceeds the complexity needed here.

---

## 11. React Frontend Architecture

**Decision**:
- **State management**: TanStack Query (React Query v5) for server state; Zustand for lightweight UI state (modals, filters, board drag state).
- **Drag-and-drop**: `@dnd-kit/core` + `@dnd-kit/sortable` (dnd-kit).
- **Component library**: shadcn/ui (Tailwind CSS based).
- **API client**: `axios` instance + TanStack Query; **no codegen for v1**.
- **Routing**: React Router v6.
- **Forms**: React Hook Form + Zod.
- **Auth token storage**: Tokens in `httpOnly` cookies (set by backend); frontend never touches token directly.

**Rationale**:
- TanStack Query eliminates most global state by making server state reactive. Cache invalidation on task mutations triggers automatic board re-render. Zustand handles the remaining UI state that doesn't need server sync.
- `dnd-kit` is the modern successor to `react-beautiful-dnd`. It's maintained, accessible, and designed for React 18+. `@hello-pangea/dnd` is a maintenance fork that works but dnd-kit has better accessibility and flexibility.
- shadcn/ui generates unstyled (copy-paste) components based on Radix UI primitives + Tailwind. Gives full control without fighting a component library's design system. Ideal for a productivity app.
- React Router v6 is the standard; TanStack Router is excellent but adds a learning curve with typed routes. React Router v6 is sufficient.
- `httpOnly` cookies: tokens set by the backend response cannot be read by JavaScript. This eliminates XSS token theft. CSRF protection via `SameSite=Strict` cookie attribute.

**Alternatives considered**:
- *Redux Toolkit*: Overkill; most state is server state, which TanStack Query handles better.
- *`@hello-pangea/dnd`*: Maintained fork of react-beautiful-dnd; works but dnd-kit is architecturally superior (no strict DOM structure requirements, better accessibility).
- *Material UI / Chakra UI*: Heavier bundles, opinionated design systems that fight back. shadcn/ui is more flexible.
- *OpenAPI codegen*: Valuable at scale but setup overhead for v1 isn't warranted. Can be added later.

---

## 12. Project Structure Decision

**Decision**: **Web application structure** — `backend/` (FastAPI) + `frontend/` (React/Vite) at repo root.

```text
taskflow/
├── backend/
│   ├── app/
│   │   ├── api/          # Route handlers (routers)
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── schemas/      # Pydantic v2 request/response schemas
│   │   ├── services/     # Business logic layer
│   │   ├── db/           # DB engine, session, migrations config
│   │   └── core/         # Config, auth utilities, dependencies
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   ├── alembic/
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route-level page components
│   │   ├── features/     # Feature-grouped logic (board, tasks, etc.)
│   │   ├── hooks/        # Custom React hooks
│   │   ├── api/          # Axios client + query definitions
│   │   └── stores/       # Zustand stores
│   ├── tests/
│   └── vite.config.ts
└── docker-compose.yml
```

---

## Summary: All NEEDS CLARIFICATION Resolved

| Topic | Decision |
|-------|----------|
| Auth method | JWT hybrid (in-memory access + httpOnly refresh cookie), custom implementation |
| Auth libraries | **`PyJWT`** + **`pwdlib[argon2]`** (passlib/python-jose deprecated) |
| RBAC pattern | FastAPI dependency injection (`RoleChecker` callable class) |
| ORM | SQLAlchemy 2.0 async + asyncpg |
| Database | PostgreSQL 16 (prod), SQLite (dev) |
| Migrations | Alembic (async template) |
| Task blocking | Explicit `task_blockers` join table, computed on status change |
| Recurring tasks | Separate `recurring_series` table, **FastAPI `BackgroundTasks`** spawn on Done |
| Tags | Normalized `tags` table with `UNIQUE(workspace_id, name)` + `task_tags` junction |
| Activity log | Unified `activity_feed` table, JSONB details, keyset pagination, BRIN index |
| NLP parser | GPT-4o-mini structured output (`pwdlib.beta.chat.completions.parse()`) + `dateparser` + `rapidfuzz` |
| Filtering | PostgreSQL GIN + composite indexes, no search layer |
| Real-time | Server-Sent Events (sse-starlette), in-memory pub/sub (→ Redis when scaling) |
| Background jobs | **FastAPI `BackgroundTasks`** (in-process, post-response) for v1 |
| Frontend state | TanStack Query (server) + Zustand (UI) |
| Drag-and-drop | **dnd-kit** (`@dnd-kit/core` + `@dnd-kit/sortable`) |
| UI components | shadcn/ui + Tailwind CSS + Radix UI |
| Routing | React Router v6/v7 |
| Forms | React Hook Form + Zod |
| API client | Native `fetch` + **OpenAPI codegen** (`@hey-api/openapi-ts` or `orval`) |
| Auth token storage | httpOnly cookie (refresh) + React in-memory context (access) |

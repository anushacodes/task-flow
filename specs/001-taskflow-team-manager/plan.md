# Implementation Plan: TaskFlow Team Task Manager

**Branch**: `001-taskflow-team-manager` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-taskflow-team-manager/spec.md`

---

## Summary

TaskFlow is a full-stack team task management web app. Users join workspaces with per-workspace roles (Owner/Admin/Member). Inside workspaces, projects contain tasks displayed on a Kanban board (4 fixed columns: To Do, In Progress, In Review, Done). Tasks support blocking dependencies, recurring weekly patterns (auto-spawn on completion), a unified activity/comments audit trail, structured search/filter, and a natural language quick-add powered by GPT-4o-mini structured outputs.

**Backend**: Python 3.12 + FastAPI + SQLAlchemy 2.0 async + PostgreSQL 16
**Frontend**: React + Vite + TanStack Query + Zustand + shadcn/ui + dnd-kit

---

## Technical Context

**Language/Version**: Python 3.12 (backend) · TypeScript / React 18 (frontend)

**Primary Dependencies**:
- Backend: `fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `pyjwt[crypto]`, `pwdlib[argon2]`, `pydantic-settings`, `openai>=1.30`, `dateparser`, `rapidfuzz`, `tenacity`, `sse-starlette`
- Frontend: `react`, `vite`, `@tanstack/react-query`, `zustand`, `react-router-dom`, `@dnd-kit/core`, `@dnd-kit/sortable`, `shadcn/ui`, `tailwindcss`, `react-hook-form`, `zod`, `@hookform/resolvers`, `@hey-api/openapi-ts`

**Storage**: PostgreSQL 16 (production) · SQLite + aiosqlite (local dev/test)

**Testing**: `pytest` + `pytest-asyncio` + `httpx[test]` (backend) · `vitest` + `@testing-library/react` (frontend)

**Target Platform**: Linux server (Docker) + modern desktop browsers (Chrome 120+, Firefox 120+, Safari 17+)

**Project Type**: Full-stack web application (REST API + SPA)

**Performance Goals**:
- Filter queries: < 1s for 1,000 tasks per project (SC-003)
- SSE board updates: visible within 1s of task change (SC-002)
- Recurring task spawn: visible within 5s of completion (SC-004)

**Constraints**: UTC timestamps only; no email notifications v1; weekly recurrence only v1; 4 fixed Kanban columns v1

**Scale/Scope**: ~50 concurrent users per workspace (SC-008); up to 1,000 tasks per project for filter performance guarantee

---

## Constitution Check

*The project constitution is a template with placeholder content (no project-specific principles have been ratified). Proceeding without constitution gates.*

**Post-design re-check**: N/A — constitution contains only placeholder examples, no binding constraints.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-taskflow-team-manager/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0: Technology decisions
├── data-model.md        # Phase 1: Entity schema & indexes
├── quickstart.md        # Phase 1: Validation guide
├── contracts/
│   └── api.md           # Phase 1: REST API contract
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
taskflow/
├── backend/
│   ├── app/
│   │   ├── api/                 # FastAPI routers
│   │   │   ├── auth.py          # /auth/* endpoints
│   │   │   ├── workspaces.py    # /workspaces/* endpoints
│   │   │   ├── projects.py      # /projects/* endpoints
│   │   │   ├── tasks.py         # /tasks/* endpoints
│   │   │   └── events.py        # SSE /projects/{id}/events
│   │   ├── models/              # SQLAlchemy 2.0 ORM models
│   │   │   ├── user.py
│   │   │   ├── workspace.py
│   │   │   ├── project.py
│   │   │   ├── task.py          # Task + task_blockers + task_tags
│   │   │   ├── recurring.py     # RecurringSeries
│   │   │   └── activity.py      # ActivityFeed
│   │   ├── schemas/             # Pydantic v2 request/response schemas
│   │   │   ├── auth.py
│   │   │   ├── workspace.py
│   │   │   ├── project.py
│   │   │   ├── task.py
│   │   │   └── activity.py
│   │   ├── services/            # Business logic
│   │   │   ├── auth_service.py
│   │   │   ├── workspace_service.py
│   │   │   ├── task_service.py  # blocking checks, status transitions
│   │   │   ├── recurring_service.py
│   │   │   ├── activity_service.py
│   │   │   └── nlp_service.py   # GPT-4o-mini parse + dateparser + rapidfuzz
│   │   ├── db/
│   │   │   ├── engine.py        # async_engine, AsyncSessionLocal
│   │   │   └── base.py          # DeclarativeBase + naming convention
│   │   ├── core/
│   │   │   ├── config.py        # pydantic-settings
│   │   │   ├── security.py      # JWT encode/decode, pwdlib
│   │   │   ├── deps.py          # get_current_user, get_workspace_role, RoleChecker
│   │   │   └── pubsub.py        # In-memory async pub/sub for SSE
│   │   └── main.py              # FastAPI app factory, CORS, routers
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── test_security.py
│   │   │   ├── test_nlp_service.py
│   │   │   └── test_recurring_service.py
│   │   └── integration/
│   │       ├── test_auth.py
│   │       ├── test_workspaces.py
│   │       ├── test_tasks.py
│   │       ├── test_blockers.py
│   │       ├── test_recurring.py
│   │       ├── test_activity.py
│   │       └── test_quick_add.py
│   ├── alembic/
│   │   ├── env.py               # Async Alembic config
│   │   └── versions/            # Migration scripts
│   └── pyproject.toml
│
├── frontend/
│   ├── src/
│   │   ├── api/                 # Axios/fetch client + query definitions
│   │   │   ├── client.ts        # Base axios instance with auth header
│   │   │   ├── workspaces.ts
│   │   │   ├── projects.ts
│   │   │   ├── tasks.ts
│   │   │   └── activity.ts
│   │   ├── components/          # Reusable UI components
│   │   │   ├── KanbanBoard/
│   │   │   ├── TaskCard/
│   │   │   ├── TaskDetail/
│   │   │   ├── QuickAdd/
│   │   │   ├── ActivityFeed/
│   │   │   └── FilterBar/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── WorkspacePage.tsx
│   │   │   └── ProjectBoardPage.tsx
│   │   ├── features/
│   │   │   ├── board/           # dnd-kit drag logic, column rendering
│   │   │   ├── tasks/           # Task CRUD hooks + optimistic updates
│   │   │   └── auth/            # Login, token refresh, auth context
│   │   ├── hooks/
│   │   │   ├── useBoard.ts
│   │   │   ├── useTaskFilter.ts
│   │   │   └── useSSE.ts
│   │   └── stores/              # Zustand stores
│   │       ├── authStore.ts     # In-memory access token + user info
│   │       └── uiStore.ts       # Modal state, active workspace, filter state
│   ├── tests/
│   └── vite.config.ts
│
└── docker-compose.yml            # postgres + backend + frontend services
```

**Structure Decision**: Web application (Option 2) — FastAPI backend (`backend/`) + React/Vite frontend (`frontend/`) at repo root with a `docker-compose.yml` for local development.

---

## Complexity Tracking

> No Constitution Check violations — this table is not applicable.

---

## Phase 0 Output

✅ **research.md** — All technology decisions resolved. See [research.md](./research.md).

Key decisions:
- Auth: JWT hybrid (in-memory access + httpOnly refresh) · `PyJWT` + `pwdlib[argon2]`
- DB/ORM: PostgreSQL 16 + SQLAlchemy 2.0 async + asyncpg + Alembic
- Recurring: FastAPI `BackgroundTasks` (post-response spawn)
- NLP: GPT-4o-mini structured output + `dateparser` + `rapidfuzz`
- SSE: `sse-starlette` with in-memory asyncio pub/sub per project
- Frontend: TanStack Query + Zustand + dnd-kit + shadcn/ui + RHF+Zod

---

## Phase 1 Output

✅ **data-model.md** — 11 entities defined with fields, types, indexes, state machines. See [data-model.md](./data-model.md).

✅ **contracts/api.md** — Full REST API contract: 35 endpoints across auth, workspaces, projects, tasks, blockers, recurring, activity, tags, NLP parse, and SSE. See [contracts/api.md](./contracts/api.md).

✅ **quickstart.md** — 10 validation scenarios with curl commands covering all 7 user stories and 8 success criteria. See [quickstart.md](./quickstart.md).

---

## Next Steps

Run **`/speckit-tasks`** to generate the implementation task list (`tasks.md`).

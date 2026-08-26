# TaskFlow

A modern, full-stack team task manager featuring Kanban boards, role-based workspaces, task blocking dependencies, recurring tasks, audit activity feeds, real-time board updates, and natural language quick-add.

---

## Features Roadmap & Progress

- [x] ~~**Monorepo Scaffolding & Infrastructure**~~: Python 3.12 FastAPI backend + React 18/Vite/TypeScript frontend with Docker Compose and Tailwind CSS.
- [x] ~~**Authentication & Session Security**~~: Argon2id password hashing (`pwdlib`), PyJWT access tokens, secure `httpOnly` refresh token rotation with reuse detection.
- [x] ~~**Workspaces & Role-Based Access Control (RBAC)**~~: Multi-workspace support with `OWNER`, `ADMIN`, and `MEMBER` roles, teammate invitations, and permission enforcement.
- [x] ~~**Projects Management**~~: Workspace-scoped projects with active and archived views.
- [ ] **Kanban Board & Core Task Lifecycle**: 4 fixed columns (`To Do`, `In Progress`, `In Review`, `Done`), drag-and-drop via `dnd-kit`, tags, and inline task editing.
- [ ] **Task Blocking Dependencies**: Task-level blockers preventing transitions to `In Progress` until dependencies resolve, complete with cycle detection.
- [ ] **Recurring Tasks**: Weekly recurrence engine that automatically generates new instances upon task completion.
- [ ] **Audit Trail & Task Comments**: Immutable activity log capturing all field modifications and team discussions.
- [ ] **Search & Multi-Dimensional Filtering**: Combined filtering across status, assignees, and tags.
- [ ] **Natural Language Quick-Add**: Structured task extraction from free-form text using Groq (LLaMA 3.3 70B), `dateparser`, and fuzzy assignee resolution.
- [ ] **Real-Time Board Synchronization**: Server-Sent Events (SSE) push updates across team members without manual refresh.

---

## Tech Stack

- **Backend**: Python 3.12 · FastAPI · SQLAlchemy 2.0 (async) · asyncpg · Alembic · Pydantic v2 · PyJWT · Argon2id · Groq SDK
- **Frontend**: React 18 · Vite · TypeScript · TanStack Query · Zustand · dnd-kit · Tailwind CSS · React Hook Form · Zod
- **Database**: PostgreSQL 16 (production/Docker) · SQLite with `aiosqlite` (local test)

---

## Quick Start (Docker)

```bash
cp backend/.env.example backend/.env
# Update SECRET_KEY and GROQ_API_KEY in backend/.env
docker compose up
```

- **Frontend App**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **Interactive Swagger Docs**: http://localhost:8000/docs

---

## Local Development

### 1. Backend Setup

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

---

## Running Tests

```bash
# Backend test suite (unit + integration)
cd backend
pytest tests/

# Frontend tests
cd frontend
npm test
```

---

## Project Structure

```text
taskflow/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI route handlers (auth, workspaces, projects)
│   │   ├── core/         # Config, security, dependencies, RBAC
│   │   ├── db/           # Async engine, sessionmaker, DeclarativeBase
│   │   ├── models/       # SQLAlchemy 2.0 ORM models
│   │   ├── schemas/      # Pydantic v2 schemas
│   │   └── services/     # Business logic & domain services
│   ├── alembic/          # Database migrations
│   └── tests/            # Pytest test suite
├── frontend/
│   ├── src/
│   │   ├── api/          # Axios client & typed API requests
│   │   ├── components/   # UI components (members, projects, board)
│   │   ├── features/     # Feature contexts & domain modules
│   │   ├── pages/        # Route pages (Login, Register, Workspace)
│   │   └── stores/       # Zustand state stores (auth, UI)
│   └── vite.config.ts
└── docker-compose.yml
```

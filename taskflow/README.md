# TaskFlow

A full-stack team task manager with Kanban boards, role-based workspaces, task blocking dependencies, recurring tasks, activity audit trail, and natural language quick-add.

## Stack

- **Backend**: Python 3.12 + FastAPI + SQLAlchemy 2.0 async + PostgreSQL 16
- **Frontend**: React 18 + Vite + TanStack Query + Zustand + shadcn/ui + dnd-kit

## Quick Start (Docker)

```bash
cd taskflow
cp backend/.env.example backend/.env
# Edit backend/.env — set SECRET_KEY and OPENAI_API_KEY
docker compose up
```

- Backend: http://localhost:8000
- Frontend: http://localhost:5173
- API docs: http://localhost:8000/docs

## Local Development

### Backend

```bash
cd taskflow/backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env  # fill in values
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd taskflow/frontend
npm install
cp .env.example .env.local
npm run dev
```

## Running Tests

```bash
# Backend
cd taskflow/backend
pytest tests/

# Frontend
cd taskflow/frontend
npm test
```

## Validation

See `specs/001-taskflow-team-manager/quickstart.md` for end-to-end validation scenarios.

## Project Structure

```
taskflow/
├── backend/          # FastAPI app
├── frontend/         # React/Vite SPA
└── docker-compose.yml
```

See `specs/001-taskflow-team-manager/plan.md` for detailed architecture.

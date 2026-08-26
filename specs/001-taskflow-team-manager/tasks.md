# Tasks: TaskFlow Team Task Manager

**Branch**: `001-taskflow-team-manager` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Data Model**: [data-model.md](./data-model.md) | **API Contract**: [contracts/api.md](./contracts/api.md) | **Quickstart**: [quickstart.md](./quickstart.md)

> **Format**: `- [ ] T### [P] [US#] Description → file/path`
> - `[P]` = parallelizable (no dependency on incomplete tasks in the same batch)
> - `[US#]` = user story this task belongs to
> - No story label = Setup or Foundational phase

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project scaffolding, tooling, and dev environment. No user story depends on another in this phase — all are parallel once Docker is up.

- [x] T001 Create monorepo root with `taskflow/` directory containing `backend/`, `frontend/`, and `docker-compose.yml`
- [x] T002 [P] Initialize FastAPI backend: create `backend/pyproject.toml` with dependencies (`fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `pyjwt[crypto]`, `pwdlib[argon2]`, `pydantic-settings`, `openai>=1.30`, `dateparser`, `rapidfuzz`, `tenacity`, `sse-starlette`, `aiosqlite`) and dev extras (`pytest`, `pytest-asyncio`, `httpx`, `ruff`, `mypy`)
- [x] T003 [P] Initialize React/Vite frontend: run `npm create vite@latest frontend -- --template react-ts`, install dependencies (`@tanstack/react-query`, `zustand`, `react-router-dom`, `@dnd-kit/core`, `@dnd-kit/sortable`, `axios`, `react-hook-form`, `zod`, `@hookform/resolvers`) in `frontend/`
- [x] T004 [P] Install and configure shadcn/ui + Tailwind CSS in `frontend/` (run `npx shadcn@latest init`, configure `frontend/tailwind.config.ts` and `frontend/src/index.css`)
- [x] T005 [P] Create `backend/app/` package skeleton: empty `__init__.py` files under `app/`, `app/api/`, `app/models/`, `app/schemas/`, `app/services/`, `app/db/`, `app/core/`
- [x] T006 [P] Create `frontend/src/` directory structure: `api/`, `components/`, `pages/`, `features/auth/`, `features/board/`, `features/tasks/`, `hooks/`, `stores/`
- [x] T007 [P] Write `docker-compose.yml` at repo root with services: `postgres` (postgres:16, port 5432, env POSTGRES_DB/USER/PASSWORD), `backend` (build `./backend`, port 8000, depends_on postgres), `frontend` (build `./frontend`, port 5173)
- [x] T008 [P] Create `backend/.env.example` and `backend/app/core/config.py` using `pydantic-settings`: fields `DATABASE_URL`, `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES=15`, `REFRESH_TOKEN_EXPIRE_DAYS=7`, `OPENAI_API_KEY`, `ENVIRONMENT=development`
- [x] T009 [P] Configure Ruff linting + Black formatting in `backend/pyproject.toml` (`[tool.ruff]` section) and add `backend/.ruff.toml`; configure ESLint + Prettier in `frontend/`

**Checkpoint**: `docker compose up` starts postgres, backend returns 200 on `GET /health`, frontend dev server loads at localhost:5173.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core database, auth primitives, and shared FastAPI infrastructure that ALL user stories depend on. Nothing in Phase 3+ can start until this is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T010 Create `backend/app/db/base.py`: define `DeclarativeBase` with `NAMING_CONVENTION` dict (`ix_`, `uq_`, `ck_`, `fk_`, `pk_` prefixes) and `Base = DeclarativeBase(metadata=MetaData(naming_convention=NAMING_CONVENTION))`
- [ ] T011 Create `backend/app/db/engine.py`: define `async_engine` from `DATABASE_URL` config using `create_async_engine`, `AsyncSessionLocal = async_sessionmaker(...)`, and `async def get_db()` dependency yielding `AsyncSession`
- [ ] T012 [P] Create `backend/app/models/user.py`: `User` SQLAlchemy 2.0 `Mapped[]` model with fields `id` (UUID PK), `email` (UNIQUE), `name`, `password_hash`, `avatar_url`, `is_active`, `created_at`, `updated_at`; add `__table_args__` with `UniqueConstraint("email")`
- [ ] T013 [P] Create `backend/app/models/token.py`: `RefreshToken` model with fields `id`, `token_hash` (UNIQUE), `user_id` (FK→users), `family_id`, `expires_at`, `revoked`, `created_at`; add indexes `(user_id, expires_at)` and `(family_id)`
- [ ] T014 Create `backend/app/models/workspace.py`: `Workspace` model (`id`, `name`, `description`, `owner_id` FK→users, `is_active`, timestamps) and `WorkspaceMembership` model (`workspace_id`+`user_id` composite PK, `role` CHECK IN ('OWNER','ADMIN','MEMBER'), `invited_by_id`, `joined_at`) with role hierarchy constant `ROLE_RANK = {"MEMBER":1,"ADMIN":2,"OWNER":3}`
- [ ] T015 Create `backend/app/models/__init__.py` importing all models so Alembic autogenerate detects them; configure `backend/alembic/env.py` with async engine setup using `asyncio.run(run_migrations_online())` pattern
- [ ] T016 Run `alembic init -t async backend/alembic` then update `backend/alembic/env.py` to import `Base` from `app.db.base` and all models, pull `DATABASE_URL` from `pydantic-settings` config, and use `async_engine_from_config`
- [ ] T017 Generate and apply initial Alembic migration for User + RefreshToken + Workspace + WorkspaceMembership: `alembic revision --autogenerate -m "initial_user_workspace"` → review → `alembic upgrade head`
- [ ] T018 Create `backend/app/core/security.py`: implement `hash_password(plain: str) -> str` and `verify_password(plain, hashed) -> bool` using `pwdlib.PasswordHash.recommended()` (Argon2id); implement `create_access_token(data: dict) -> str` and `decode_access_token(token: str) -> dict | None` using `PyJWT` with HS256 and `SECRET_KEY`; implement `generate_refresh_token() -> str` (32-byte `secrets.token_hex`)
- [ ] T019 Create `backend/app/schemas/auth.py`: Pydantic v2 schemas `UserRegisterRequest` (email, name, password), `UserResponse` (id, email, name, avatar_url, created_at), `TokenResponse` (access_token, token_type, expires_in), `RefreshRequest`
- [ ] T020 Create `backend/app/services/auth_service.py`: implement `register_user(db, req)` → validate email uniqueness → hash password → insert User → return UserResponse; implement `login_user(db, email, password)` → fetch user → verify password → create access JWT → create+store RefreshToken (hash, family_id, expires_at) → return (access_token, raw_refresh_token); implement `refresh_tokens(db, raw_token)` → hash lookup → check not revoked/expired → revoke old → issue new pair (full rotation); implement `logout(db, raw_token)` → revoke token
- [ ] T021 Create `backend/app/api/auth.py`: FastAPI `APIRouter` with prefix `/api/v1/auth`; routes `POST /register` → `auth_service.register_user`; `POST /token` (OAuth2PasswordRequestForm) → `auth_service.login_user` → set `httpOnly; Secure; SameSite=Lax` refresh cookie + return access token body; `POST /refresh` → read cookie → `auth_service.refresh_tokens`; `POST /logout`; `GET /me`
- [ ] T022 Create `backend/app/core/deps.py`: `async def get_current_user(token: str = Depends(OAuth2PasswordBearer)) -> User` decodes JWT, fetches User, raises 401 if invalid; `async def get_workspace_role(workspace_id: UUID = Path(...), user: User = Depends(get_current_user), db = Depends(get_db)) -> WorkspaceAccess`; `class RoleChecker` callable with `__init__(minimum_role: str)` and `__call__` raising 403 if insufficient; export `require_admin = RoleChecker("ADMIN")`, `require_owner = RoleChecker("OWNER")`
- [ ] T023 [P] Create `backend/app/schemas/workspace.py`: schemas `WorkspaceCreate`, `WorkspaceResponse`, `WorkspaceListItem`, `MemberResponse`, `InviteRequest`, `RoleUpdateRequest`
- [ ] T024 Create `backend/app/main.py`: FastAPI app factory with CORS middleware (allow `http://localhost:5173`, credentials=True, methods=["*"], headers=["*"]); include auth router; add `GET /health` returning `{"status":"ok"}`; lifespan handler for startup/shutdown
- [ ] T025 [P] Create `frontend/src/stores/authStore.ts`: Zustand store with `accessToken: string | null`, `user: User | null`, `setAuth(token, user)`, `clearAuth()` actions — token stored in memory only (never localStorage)
- [ ] T026 [P] Create `frontend/src/api/client.ts`: axios instance with `baseURL: import.meta.env.VITE_API_URL`, request interceptor adding `Authorization: Bearer ${authStore.accessToken}`, response interceptor calling `POST /auth/refresh` on 401 then retrying (silent refresh); `withCredentials: true` for cookie support
- [ ] T027 [P] Create `frontend/src/features/auth/AuthProvider.tsx`: React context wrapping the app; on mount calls `GET /auth/me` (with cookie), on success populates `authStore`; provides `login(email, password)`, `logout()` methods; exported `useAuth()` hook
- [ ] T028 [P] Create `frontend/src/pages/LoginPage.tsx`: form using React Hook Form + Zod schema (`{email: z.string().email(), password: z.string().min(8)}`), calls `useAuth().login()`, redirects to `/workspaces` on success; shadcn/ui `Card`, `Input`, `Button` components; `frontend/src/pages/RegisterPage.tsx`: similar form calling `POST /auth/register`
- [ ] T029 Configure React Router v6 in `frontend/src/main.tsx`: routes `"/" → redirect /workspaces`, `"/login" → LoginPage`, `"/register" → RegisterPage`, `"/workspaces" → WorkspacePage`, `"/workspaces/:wsId/projects/:projectId → ProjectBoardPage"`; wrap with `<TanStackQueryProvider>` and `<AuthProvider>`; add `ProtectedRoute` component redirecting unauthenticated users to `/login`

**Checkpoint**: User can register, log in (JWT issued, refresh cookie set), view `/auth/me`, and silent refresh works. Frontend login page functional. All other phases can now begin.

---

## Phase 3: User Story 1 — Workspace & Project Setup (Priority: P1) 🎯 MVP

**Goal**: Owner creates workspace, invites teammates with roles, creates a project. Full multi-workspace membership with RBAC enforced.

**Independent Test**: Scenario 2 from `quickstart.md` — create workspace, invite admin + member, verify role-based permission rejections, create project via admin.

### Backend — Workspace & Project

- [ ] T030 [P] [US1] Create `backend/app/services/workspace_service.py`: `create_workspace(db, user, req)` → insert Workspace + WorkspaceMembership(OWNER) atomically; `list_workspaces(db, user)` → query memberships for user; `get_workspace(db, workspace_id, user)` → fetch with member check; `update_workspace(db, workspace_id, req, access)` → ADMIN+ only; `delete_workspace(db, workspace_id, access)` → OWNER only soft-delete; `transfer_ownership(db, workspace_id, new_owner_id, access)` → OWNER only, atomic role swap
- [ ] T031 [US1] Create `backend/app/services/workspace_service.py` invite methods (same file as T030): `invite_member(db, workspace_id, email, role, access)` → resolve user by email → insert WorkspaceMembership (or create pending invite record if user not yet registered); `update_member_role(db, workspace_id, user_id, role, access)` → ADMIN+ can change MEMBER roles; OWNER-only to promote to ADMIN; `remove_member(db, workspace_id, user_id, access)` → ADMIN+ removes MEMBER; OWNER removes anyone (not themselves)
- [ ] T032 [US1] Create `backend/app/api/workspaces.py`: router prefix `/api/v1/workspaces`; `POST /` → `create_workspace`; `GET /` → `list_workspaces`; `GET /{workspace_id}` → `get_workspace` (requires membership); `PATCH /{workspace_id}` → `update_workspace` (ADMIN+); `DELETE /{workspace_id}` → `delete_workspace` (OWNER); `POST /{workspace_id}/transfer` → `transfer_ownership`; `GET /{workspace_id}/members`; `POST /{workspace_id}/invites`; `PATCH /{workspace_id}/members/{user_id}`; `DELETE /{workspace_id}/members/{user_id}`; register router in `backend/app/main.py`
- [ ] T033 [P] [US1] Create `backend/app/models/project.py`: `Project` model (`id`, `workspace_id` FK→workspaces, `name`, `description`, `status` CHECK IN ('ACTIVE','ARCHIVED') default 'ACTIVE', `created_by_id`, timestamps); add `UniqueConstraint("workspace_id","name")` and `Index("idx_projects_workspace_status", "workspace_id", "status")`
- [ ] T034 [US1] Generate and apply Alembic migration for Project table: `alembic revision --autogenerate -m "add_project"` → review → `alembic upgrade head`
- [ ] T035 [P] [US1] Create `backend/app/schemas/project.py`: `ProjectCreate`, `ProjectResponse`, `ProjectUpdate` (name, description, status) Pydantic v2 schemas
- [ ] T036 [US1] Create `backend/app/services/project_service.py`: `create_project(db, workspace_id, req, access)` → ADMIN+ only; `list_projects(db, workspace_id, user, status_filter)` → all workspace members; `update_project(db, project_id, req, access)` → ADMIN+ only (includes archive via `status=ARCHIVED`)
- [ ] T037 [US1] Create `backend/app/api/projects.py`: router prefix `/api/v1/workspaces/{workspace_id}/projects`; `POST /`, `GET /` (with `?status=` filter), `PATCH /{project_id}`; register in `backend/app/main.py`

### Frontend — Workspace & Project UI

- [ ] T038 [P] [US1] Create `frontend/src/api/workspaces.ts`: typed fetch functions `listWorkspaces()`, `createWorkspace(req)`, `getWorkspace(id)`, `getWorkspaceMembers(id)`, `inviteMember(wsId, req)`, `updateMemberRole(wsId, userId, role)`, `removeMember(wsId, userId)`, `createProject(wsId, req)`, `listProjects(wsId)` — all using the axios client from `client.ts`
- [ ] T039 [US1] Create `frontend/src/pages/WorkspacePage.tsx`: lists user's workspaces (via `useQuery(['workspaces'], listWorkspaces)`); "New Workspace" button opens shadcn/ui `Dialog` with React Hook Form form; clicking a workspace navigates to its project list; each workspace card shows name, role badge, member count
- [ ] T040 [US1] Create `frontend/src/components/WorkspaceSettings/MembersPanel.tsx`: lists members with role badges; "Invite" button opens dialog with email + role dropdown; "Change Role" dropdown for ADMIN+; "Remove" button for ADMIN+; uses `useMutation` from TanStack Query with `invalidateQueries(['workspace-members', wsId])` on success
- [ ] T041 [US1] Create `frontend/src/components/ProjectList/ProjectList.tsx`: renders project cards with name, status badge (ACTIVE/ARCHIVED), "New Project" button (ADMIN+ only, checks `authStore` role); clicking a project navigates to `ProjectBoardPage`; uses `useQuery(['projects', wsId], () => listProjects(wsId))`

**Checkpoint**: Full workspace lifecycle works — create workspace, invite users, assign roles, enforce permissions (403 on member trying to change roles), create project. User Story 1 independently testable via `quickstart.md` Scenario 2.

---

## Phase 4: User Story 2 — Kanban Task Management (Priority: P1) 🎯 MVP

**Goal**: Team member creates tasks with all fields, views them on a Kanban board with 4 columns, drags tasks between columns to update status.

**Independent Test**: Scenario 3 from `quickstart.md` — create task in TODO, move to IN_PROGRESS via PATCH, verify activity log records the change, verify board view reflects status.

### Backend — Task Core

- [ ] T042 [P] [US2] Create `backend/app/models/task.py`: `Task` model with all fields per data-model.md (`id`, `project_id`, `title`, `description`, `status` CHECK IN ('TODO','IN_PROGRESS','IN_REVIEW','DONE'), `due_date`, `assignee_id`, `commands` JSONB, `series_id`, `series_instance_num`, `created_by_id`, timestamps); `task_blockers` association `Table`; `task_tags` association `Table`; add relationships `blocked_by`, `blocking` with `primaryjoin`/`secondaryjoin`/`secondary`; add all indexes from data-model.md
- [ ] T043 [P] [US2] Create `backend/app/models/tag.py`: `Tag` model (`id`, `workspace_id` FK→workspaces, `name`, `color`, timestamps); `UniqueConstraint("workspace_id","name")` and `Index("idx_tags_workspace","workspace_id")`
- [ ] T044 [US2] Generate and apply Alembic migration for Task + Tag + task_blockers + task_tags: `alembic revision --autogenerate -m "add_task_tag_blockers"` → review carefully for self-referential FK order → `alembic upgrade head`
- [ ] T045 [P] [US2] Create `backend/app/schemas/task.py`: `TaskCreate` (title required, all optional fields), `TaskUpdate` (all fields optional), `TaskResponse` (full task object including nested `assignee`, `tags[]`, `blockers[]`, `blocking[]`, `series_id`, `is_blocked` computed field), `BoardResponse` (columns dict keyed by status), `TagCreate`, `TagResponse`
- [ ] T046 [US2] Create `backend/app/services/task_service.py`: `create_task(db, project_id, req, user)` → validate assignee is workspace member → insert Task → resolve+insert tag associations → write TASK_CREATED ActivityFeed entry → return TaskResponse; `get_task(db, task_id, user)` → fetch with relationships; `list_tasks(db, project_id, user, filters)` → build WHERE clause from status/assignee_id/tag_id filters (AND logic) → return flat list or board-keyed dict based on `view` param; `update_task(db, task_id, req, user)` → diff changed fields → enforce blocking constraint on status→IN_PROGRESS → update fields → write FIELD_CHANGE entries for each changed field → return TaskResponse; `delete_task(db, task_id, access)` → ADMIN+ only
- [ ] T047 [US2] Create `backend/app/services/tag_service.py`: `list_tags(db, workspace_id, q)` → filter by workspace + optional name search; `create_tag(db, workspace_id, req, user)` → upsert via `INSERT ... ON CONFLICT DO NOTHING RETURNING id`; `delete_tag(db, tag_id, access)` → ADMIN+ only, cascades via FK to task_tags
- [ ] T048 [US2] Create `backend/app/api/tasks.py`: router prefix `/api/v1`; `GET /projects/{project_id}/tasks` (with query params `status`, `assignee_id`, `tag_id`, `view`, `before_id`, `limit`); `POST /projects/{project_id}/tasks`; `GET /tasks/{task_id}`; `PATCH /tasks/{task_id}`; `DELETE /tasks/{task_id}`; register in `backend/app/main.py`
- [ ] T049 [US2] Create `backend/app/api/tags.py`: router prefix `/api/v1/workspaces/{workspace_id}/tags`; `GET /` (with `?q=` search); `POST /`; `DELETE /{tag_id}`; register in `backend/app/main.py`

### Frontend — Kanban Board

- [ ] T050 [P] [US2] Create `frontend/src/api/tasks.ts`: typed fetch functions `listTasks(projectId, filters, view)`, `createTask(projectId, req)`, `getTask(taskId)`, `updateTask(taskId, req)`, `deleteTask(taskId)`, `listTags(workspaceId, q)`, `createTag(workspaceId, req)`
- [ ] T051 [P] [US2] Create `frontend/src/stores/uiStore.ts`: Zustand store with `activeWorkspaceId`, `activeProjectId`, `openTaskId`, `filterState: {status[], assigneeIds[], tagIds[]}`, setters for each; `taskDetailOpen: boolean`, `setTaskDetailOpen()`
- [ ] T052 [US2] Create `frontend/src/features/board/KanbanColumn.tsx`: renders a single status column (header with column name + task count badge); wraps children in dnd-kit `<SortableContext items={taskIds} strategy={verticalListSortingStrategy}>`; receives `useDroppable({ id: status })` to accept drops; styled with Tailwind (`min-h-[400px] w-72 bg-muted rounded-lg p-3`)
- [ ] T053 [US2] Create `frontend/src/components/TaskCard/TaskCard.tsx`: draggable task card using `useSortable({ id: task.id })`; displays title, assignee avatar, due date (red if overdue), tag chips, blocked indicator (🔒 icon if `is_blocked`); clicking opens `TaskDetailModal`; styled with shadcn/ui `Card`
- [ ] T054 [US2] Create `frontend/src/features/board/KanbanBoard.tsx`: main board component; fetches tasks via `useQuery(['board', projectId, filters], () => listTasks(projectId, filters, 'board'))`; renders 4 `KanbanColumn` components inside `<DndContext sensors={sensors} collisionDetection={closestCorner} onDragEnd={handleDragEnd}>`; `handleDragEnd` calls `useMutation` to `updateTask(taskId, {status: newColumnId})` with optimistic update (update query cache immediately, revert on error); `frontend/src/pages/ProjectBoardPage.tsx` composes board + FilterBar + QuickAdd
- [ ] T055 [US2] Create `frontend/src/components/TaskDetail/TaskDetailModal.tsx`: shadcn/ui `Sheet` (side panel); displays all task fields; inline-editable title (click to edit), description (textarea), status (Select dropdown), due date (DatePicker), assignee (Combobox from workspace members), tags (multi-select), commands (list with add/remove); each field change calls `updateTask` mutation; shows `ActivityFeed` component at bottom

**Checkpoint**: Full Kanban board functional — create tasks, drag between columns, inline-edit all fields. Optimistic updates keep board snappy. User Story 2 independently testable via `quickstart.md` Scenario 3.

---

## Phase 5: User Story 3 — Task Blocking Dependencies (Priority: P2)

**Goal**: Mark Task A as a blocker for Task B. Task B cannot move to IN_PROGRESS while Task A is incomplete. Visual indicator shown on blocked tasks.

**Independent Test**: Scenario 4 from `quickstart.md` — create 2 tasks, add blocker, verify 409 on status move, complete blocker, verify Task B now moveable.

### Backend — Blocking Logic

- [ ] T056 [US3] Add `add_blocker(db, task_id, blocker_id, user)` to `backend/app/services/task_service.py`: validate both tasks exist in same workspace; check `blocker_id != task_id` (self-block); run BFS from `task_id` through existing `blocking` relationships to detect cycles (raise 409 `BLOCKER_CYCLE` if `blocker_id` found in reachable set); insert into `task_blockers`; write BLOCKER_ADDED ActivityFeed entry; publish SSE task_updated event
- [ ] T057 [US3] Add `remove_blocker(db, task_id, blocker_id, user)` to `backend/app/services/task_service.py`: delete from `task_blockers` where `blocked_id=task_id AND blocker_id=blocker_id`; write BLOCKER_REMOVED ActivityFeed entry; publish SSE task_updated event
- [ ] T058 [US3] Verify blocking check in `update_task` in `backend/app/services/task_service.py`: when `req.status == 'IN_PROGRESS'`, query `task_blockers` joining Task to get blocker statuses; if any blocker has `status != 'DONE'`, raise `HTTPException(409, detail=..., code='TASK_BLOCKED')` with list of blocking task summaries
- [ ] T059 [US3] Add blocker routes to `backend/app/api/tasks.py`: `POST /tasks/{task_id}/blockers` body `{blocker_id: UUID}` → `add_blocker`; `DELETE /tasks/{task_id}/blockers/{blocker_id}` → `remove_blocker`

### Frontend — Blocking UI

- [ ] T060 [P] [US3] Add blocker management to `frontend/src/components/TaskDetail/TaskDetailModal.tsx`: "Blocked by" section listing `task.blockers` with task title + status chip; "Add blocker" button opens task-search Combobox (searches tasks in same project by title); removing a blocker calls `DELETE /tasks/{id}/blockers/{blockerId}`; "Blocking" section listing `task.blocking`
- [ ] T061 [US3] Add blocked visual indicator to `frontend/src/components/TaskCard/TaskCard.tsx`: show 🔒 lock icon + red border when `task.is_blocked === true`; on drag-end handler in `KanbanBoard.tsx`, catch 409 `TASK_BLOCKED` error → revert optimistic update → show shadcn/ui `Toast` with message "Task is blocked by: [blocker title]"

**Checkpoint**: Blocker relationships fully functional — add/remove blockers, visual indicator on board, 409 error with toast on blocked drag. User Story 3 independently testable via `quickstart.md` Scenario 4.

---

## Phase 6: User Story 4 — Recurring Tasks (Priority: P2)

**Goal**: Mark a task as recurring weekly. On completion, a new instance is auto-spawned via `BackgroundTasks` with due_date +7 days. User can disable recurrence.

**Independent Test**: Scenario 5 from `quickstart.md` — create task, mark recurring, mark Done, wait 2s, verify new instance appears in TODO with due_date +7 days.

### Backend — Recurring Logic

- [ ] T062 [P] [US4] Create `backend/app/models/recurring.py`: `RecurringSeries` model (`id`, `workspace_id`, `project_id`, `cadence` CHECK='WEEKLY', `interval_days` default 7, `template_title`, `template_description`, `assignee_id`, `is_active`, timestamps); confirm `tasks.series_id` FK and `tasks.series_instance_num` are in migration from T044
- [ ] T063 [US4] Generate Alembic migration for RecurringSeries: `alembic revision --autogenerate -m "add_recurring_series"` → review → `alembic upgrade head`
- [ ] T064 [P] [US4] Create `backend/app/schemas/task.py` additions: `RecurringCreate` (cadence, interval_days), update `TaskResponse` to include `series_id`, `series_instance_num`; create `backend/app/schemas/recurring.py`: `RecurringSeriesResponse`
- [ ] T065 [US4] Create `backend/app/services/recurring_service.py`: `enable_recurring(db, task, req, user)` → create RecurringSeries from task fields → set `task.series_id` → return updated task; `disable_recurring(db, task, user)` → set `series.is_active=False`; `spawn_next_instance(db, series_id)` → fetch series → compute new due_date (completed task due_date + interval_days, or now() + interval_days if no due_date) → insert new Task with `series_id`, `series_instance_num+1`, status='TODO' → write RECURRING_SPAWNED ActivityFeed entry → publish SSE recurring_spawned event → return new task
- [ ] T066 [US4] Wire recurring spawn into `backend/app/services/task_service.py` `update_task`: when `new_status == 'DONE'` and `task.series_id IS NOT NULL`, call `background_tasks.add_task(recurring_service.spawn_next_instance, db_factory, task.series_id)` using a fresh DB session (not the request session); update `update_task` signature to accept `background_tasks: BackgroundTasks` parameter; update `backend/app/api/tasks.py` PATCH route to inject and pass `BackgroundTasks`
- [ ] T067 [US4] Add recurring routes to `backend/app/api/tasks.py`: `POST /tasks/{task_id}/recurring` body `RecurringCreate` → `recurring_service.enable_recurring`; `DELETE /tasks/{task_id}/recurring` → `recurring_service.disable_recurring`

### Frontend — Recurring UI

- [ ] T068 [US4] Add recurring toggle to `frontend/src/components/TaskDetail/TaskDetailModal.tsx`: "Recurring" toggle switch (shadcn/ui `Switch`); when ON, shows "Weekly" label and calls `POST /tasks/{id}/recurring`; when OFF, calls `DELETE /tasks/{id}/recurring`; when a recurring task is marked Done, TanStack Query `onSuccess` invalidates `['board', projectId]` so the new instance appears automatically

**Checkpoint**: Recurring tasks work end-to-end — enable, complete, new instance spawned within 5s (SC-004), disable stops future spawning. User Story 4 independently testable via `quickstart.md` Scenario 5.

---

## Phase 7: User Story 5 — Comments & Activity Audit Trail (Priority: P2)

**Goal**: Every field change on a task is recorded in the unified ActivityFeed with actor, field, old/new values, and timestamp. Users can add comments. Feed is paginated and immutable.

**Independent Test**: Scenario 6 from `quickstart.md` — make 3 field changes + 1 comment → verify all 4 entries appear in feed newest-first → verify pagination works with 50+ entries.

### Backend — Activity Feed

- [ ] T069 [P] [US5] Create `backend/app/models/activity.py`: `ActivityFeed` model (`id` UUID v7, `task_id` FK→tasks CASCADE, `workspace_id` FK→workspaces, `actor_id` FK→users, `entry_type` VARCHAR(30) CHECK IN ('COMMENT','FIELD_CHANGE','TASK_CREATED','BLOCKER_ADDED','BLOCKER_REMOVED','RECURRING_SPAWNED'), `payload` JSONB, `created_at`); add indexes `idx_activity_task_time ON activity_feed(task_id, created_at DESC)` and `idx_activity_workspace_time ON activity_feed(workspace_id, created_at DESC)`
- [ ] T070 [US5] Generate Alembic migration for ActivityFeed: `alembic revision --autogenerate -m "add_activity_feed"` → review → `alembic upgrade head`
- [ ] T071 [P] [US5] Create `backend/app/schemas/activity.py`: `ActivityEntryResponse` (id, entry_type, actor: UserResponse, payload: dict, created_at); `ActivityFeedResponse` (items: list[ActivityEntryResponse], next_cursor: UUID | None); `CommentCreate` (text: str min_length=1)
- [ ] T072 [US5] Create `backend/app/services/activity_service.py`: `log_event(db, task_id, workspace_id, actor_id, entry_type, payload)` → Core-level `INSERT` (not ORM add) for minimal overhead; `log_field_change(db, task, actor_id, field, old_val, new_val)` → calls `log_event` with FIELD_CHANGE payload; `add_comment(db, task_id, workspace_id, actor_id, text)` → log_event with COMMENT payload; `list_activity(db, task_id, before_id, limit)` → keyset query `WHERE task_id=? AND (created_at, id) < (before_created_at, before_id) ORDER BY created_at DESC LIMIT limit`
- [ ] T073 [US5] Ensure all `task_service.py` mutations call `activity_service.log_field_change` for every changed field (status, assignee_id, due_date, title, description, tags, commands); confirm TASK_CREATED, BLOCKER_ADDED/REMOVED, RECURRING_SPAWNED events already wired in previous phases
- [ ] T074 [US5] Add activity routes to `backend/app/api/tasks.py`: `GET /tasks/{task_id}/activity` (query params `before_id`, `limit=50`) → `activity_service.list_activity`; `POST /tasks/{task_id}/comments` body `CommentCreate` → `activity_service.add_comment`; confirm no DELETE/UPDATE routes for activity entries exist

### Frontend — Activity Feed UI

- [ ] T075 [P] [US5] Create `frontend/src/api/activity.ts`: `listActivity(taskId, beforeId?, limit?)` → `GET /tasks/{id}/activity`; `addComment(taskId, text)` → `POST /tasks/{id}/comments`
- [ ] T076 [US5] Create `frontend/src/components/ActivityFeed/ActivityFeed.tsx`: infinite scroll list using TanStack Query `useInfiniteQuery` with `getNextPageParam` returning `next_cursor`; renders each entry as timeline item — COMMENT shows avatar+text+timestamp; FIELD_CHANGE shows `"{actor} changed {field} from '{old}' to '{new}'"` with timestamp; other event types have icon+summary text; add comment form at top with textarea + submit button calling `addComment` mutation; `frontend/src/components/ActivityFeed/ActivityEntry.tsx` renders a single entry

**Checkpoint**: Full activity audit trail — every field change captured, comments added, unified feed paginated, immutable (no delete route). User Story 5 independently testable via `quickstart.md` Scenario 6.

---

## Phase 8: User Story 6 — Search & Filter (Priority: P3)

**Goal**: Filter Kanban board tasks by status, assignee, and/or tags (AND logic). Filters applied as query params; board re-renders without full page reload.

**Independent Test**: Scenario 7 from `quickstart.md` — create 10 tasks with varied attributes, apply each filter dimension independently then combined, verify AND logic and <1s response on 1,000 tasks.

### Backend — Filter Optimization

- [ ] T077 [US6] Verify `backend/app/services/task_service.py` `list_tasks` filter logic: status filter uses `tasks.status.in_(status_list)`; assignee filter uses `tasks.assignee_id.in_(assignee_ids)`; tag filter uses subquery `task_id IN (SELECT task_id FROM task_tags WHERE tag_id IN (...) GROUP BY task_id HAVING count(*) = len(tag_ids))` for AND-all-tags semantics; confirm `idx_tasks_project_status`, `idx_tasks_project_assignee`, and `idx_task_tags_tag` indexes are in the migration; run `EXPLAIN ANALYZE` on a sample query with 1,000 rows to verify index usage

### Frontend — Filter Bar

- [ ] T078 [P] [US6] Create `frontend/src/components/FilterBar/FilterBar.tsx`: row of filter controls above the Kanban board; `StatusFilter` — multi-select checkboxes for TODO/IN_PROGRESS/IN_REVIEW/DONE; `AssigneeFilter` — Combobox with workspace members list; `TagFilter` — multi-select Combobox with workspace tags; "Clear filters" button resets all; filter state stored in `uiStore.filterState`; changes call TanStack Query `refetchQueries(['board', projectId, newFilters])`
- [ ] T079 [US6] Wire filter state into `frontend/src/features/board/KanbanBoard.tsx`: `useQuery` key includes `filterState` so changing filters triggers a new fetch with updated query params; empty state UI — when all columns empty, show "No tasks match your filters" with "Clear filters" button

**Checkpoint**: Filter bar works — each dimension filters correctly, AND logic across dimensions, empty state shown, <1s at 1,000 tasks (verified with quickstart Scenario 7 step 5). User Story 6 independently testable.

---

## Phase 9: User Story 7 — Natural Language Quick Add (Priority: P3)

**Goal**: User types natural language string → GPT-4o-mini parses it into structured task fields → preview shown for review/edit → confirmed task created.

**Independent Test**: Scenario 8 from `quickstart.md` — submit "remind Anusha to review the deck by Friday", verify parsed preview has correct title/assignee/due_date, confirm task creation, test ambiguous and no-date cases.

### Backend — NLP Service

- [ ] T080 [P] [US7] Create `backend/app/services/nlp_service.py`: define `ParsedTask` Pydantic model (`title: str`, `assignee_raw: str | None`, `due_date_raw: str | None`, `tags: list[str]`); define `TaskParseResponse` model (`parsed: {title, assignee, due_date, tags, commands}`, `warnings: list[str]`, `parse_confidence: float`); implement `parse_natural_language(text: str, workspace_members: list[{id,name}]) -> TaskParseResponse` using `AsyncOpenAI` client with `client.beta.chat.completions.parse(model="gpt-4o-mini", response_format=ParsedTask, messages=[...])` decorated with `@retry(wait=wait_random_exponential(min=1,max=20), stop=stop_after_attempt(3), retry=retry_if_exception_type((APITimeoutError, RateLimitError, APIConnectionError)))` from `tenacity`; after LLM parse: resolve `due_date_raw` via `dateparser.parse(raw, settings={"PREFER_DATES_FROM":"future","RETURN_AS_TIMEZONE_AWARE":False})` → ISO date string or None; resolve `assignee_raw` via `rapidfuzz.process.extractOne(raw, member_names, scorer=fuzz.token_set_ratio)` with threshold ≥ 70 → matched member ID or None; build `warnings` list for unresolved fields; compute `parse_confidence` as fraction of key fields resolved
- [ ] T081 [US7] Add `POST /projects/{project_id}/tasks/parse` route to `backend/app/api/tasks.py`: validate user is workspace member; fetch workspace member list (id + name) from WorkspaceMembership; call `nlp_service.parse_natural_language(text, members)`; return `TaskParseResponse`; raise `HTTPException(503)` if LLM service unavailable after retries

### Frontend — Quick Add UI

- [ ] T082 [P] [US7] Create `frontend/src/components/QuickAdd/QuickAddBar.tsx`: fixed input bar at top of `ProjectBoardPage`; text input with placeholder "Add a task... (e.g. 'remind Anusha to review the deck by Friday')"; on Enter or "Parse" button click, calls `POST /tasks/parse`, shows loading state; on success opens `QuickAddPreviewModal`
- [ ] T083 [US7] Create `frontend/src/components/QuickAdd/QuickAddPreviewModal.tsx`: shadcn/ui `Dialog`; displays parsed fields as editable form pre-filled with parsed values (title Input, assignee Combobox, due_date DatePicker, tags multi-select); shows `warnings` as yellow alert banners for unresolved fields; "Confirm & Create" calls `createTask(projectId, editedFields)` → closes modal → board refreshes; "Cancel" dismisses

**Checkpoint**: Natural language quick add works end-to-end — parse → preview → confirm → task on board. Unresolved fields flagged. LLM errors handled gracefully. User Story 7 independently testable via `quickstart.md` Scenario 8.

---

## Phase 10: Real-Time Board Updates (Cross-Cutting)

**Goal**: Board updates push to all connected clients via SSE when any task is created/updated/deleted.

**Independent Test**: Scenario 9 from `quickstart.md` — subscribe SSE in terminal 1, update task in terminal 2, verify event received within 1 second.

- [ ] T084 [P] Create `backend/app/core/pubsub.py`: in-memory async pub/sub using `asyncio.Queue`; `class PubSub` with `dict[str, list[asyncio.Queue]]`; `async def subscribe(channel: str) -> AsyncContextManager[asyncio.Queue]`; `async def publish(channel: str, message: dict)`; mount as app singleton in `backend/app/main.py` lifespan using `app.state.pubsub = PubSub()`
- [ ] T085 [P] Create `backend/app/api/events.py`: `GET /api/v1/projects/{project_id}/events` route returning `EventSourceResponse` (from `sse_starlette`); authenticate via JWT (cannot use cookie-only for SSE, pass token as `?token=` query param or use session); async generator subscribes to `f"project:{project_id}"` channel via `pubsub.subscribe`; yields `data: {json}\n\n` for each message; handles client disconnect; register in `backend/app/main.py`
- [ ] T086 Wire `pubsub.publish` calls into `task_service.py`: after any task create/update/delete, call `await pubsub.publish(f"project:{task.project_id}", {"event":"task_updated","task_id":str(task.id),"changes":{...}})` — also publish `task_created`, `task_deleted`, `recurring_spawned`, `activity_added` events
- [ ] T087 Create `frontend/src/hooks/useSSE.ts`: custom hook wrapping `EventSource` — `useSSE(projectId)` connects to `/api/v1/projects/{id}/events?token={accessToken}`; maps each event type to `queryClient.invalidateQueries` calls (e.g. `task_updated` → `invalidateQueries(['board', projectId])`); handles reconnect on error; cleanup `es.close()` on unmount; call `useSSE(projectId)` in `ProjectBoardPage.tsx`

**Checkpoint**: SSE connection established, board auto-refreshes when any team member moves a card or creates a task. Scenario 9 from quickstart verified.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Final integration, error handling, performance verification, and developer documentation.

- [ ] T088 [P] Add global error handling in `backend/app/main.py`: `@app.exception_handler(RequestValidationError)` → 422 with structured field errors; `@app.exception_handler(HTTPException)` → passthrough; `@app.exception_handler(Exception)` → 500 with generic message (no stack trace in production); configure `structlog` or standard `logging` with request ID middleware
- [ ] T089 [P] Add `frontend/src/components/ErrorBoundary.tsx` React error boundary; add global TanStack Query `onError` handler showing shadcn/ui `Toast` for API errors; add loading skeletons for board columns (`KanbanColumnSkeleton.tsx`) shown during initial fetch
- [ ] T090 [P] Write `backend/README.md`: setup instructions (Python 3.12, pyenv, `pip install -e ".[dev]"`, Alembic setup, env vars); `backend/tests/conftest.py`: async pytest fixtures for `test_db` (SQLite in-memory), `test_client` (HTTPX AsyncClient), `auth_headers` helper; run all existing integration tests to verify pass
- [ ] T091 [P] Write `frontend/README.md`: setup instructions (Node 20, `npm install`, `cp .env.example .env.local`, `npm run dev`); verify `npm run build` succeeds with no TypeScript errors; verify `npm run lint` passes
- [ ] T092 Run `quickstart.md` Scenario 10 (k6 load test): write `backend/tests/load/load-test.js` with 50 VUs × 60s reading board; confirm p95 < 500ms and 0 errors; document results in `specs/001-taskflow-team-manager/quickstart.md` Notes section
- [ ] T093 [P] Add `CONTRIBUTING.md` at repo root with: dev environment setup, Docker compose quickstart (`docker compose up`), running tests (`pytest backend/tests`, `npm test`), branch naming convention, PR checklist referencing `quickstart.md` validation scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately. All tasks [P] after T001 directory creation.
- **Phase 2 (Foundational)**: Depends on Phase 1 completion. Blocks all user story phases.
- **Phase 3 (US1 Workspaces)**: Depends on Phase 2. No other story dependency.
- **Phase 4 (US2 Kanban)**: Depends on Phase 2. No dependency on Phase 3 (tasks have no workspace UI dependency for backend; frontend can stub workspace selection).
- **Phase 5 (US3 Blocking)**: Depends on Phase 4 (tasks must exist).
- **Phase 6 (US4 Recurring)**: Depends on Phase 4 (tasks must exist). Independent of Phase 5.
- **Phase 7 (US5 Activity)**: Depends on Phase 4 (tasks must exist, `log_event` wires into task mutations).
- **Phase 8 (US6 Filter)**: Depends on Phase 4 (task list endpoint must exist).
- **Phase 9 (US7 NLP)**: Depends on Phase 4 (task creation endpoint must exist) and Phase 3 (needs workspace members list).
- **Phase 10 (SSE)**: Depends on Phase 4. Enhances all previous phases with real-time push.
- **Phase 11 (Polish)**: Depends on all desired phases complete.

### User Story Dependencies (Diagram)

```
Phase 1 (Setup)
     │
Phase 2 (Foundational: auth, DB, base models)
     │
     ├──────────────────────────────────────────────────┐
     │                                                  │
Phase 3 (US1: Workspaces)             Phase 4 (US2: Kanban Tasks)  ← Required by all below
                                             │
                         ┌───────────────────┼──────────────────────┐
                         │                   │                      │
                Phase 5 (US3)         Phase 6 (US4)         Phase 7 (US5)
                (Blockers)            (Recurring)            (Activity)
                         │
                Phase 8 (US6: Filter) — parallel with US3,4,5 after Phase 4
                Phase 9 (US7: NLP) — parallel with US3,4,5 after Phase 4
                Phase 10 (SSE) — parallel with any, enhances all
                         │
                Phase 11 (Polish)
```

### Parallel Opportunities Per Phase

**Phase 1**: T002, T003, T004, T005, T006, T007, T008, T009 all parallel after T001
**Phase 2**: T012, T013 parallel; T023, T025, T026, T027, T028 parallel after auth service complete
**Phase 3**: T030, T033, T035, T038 parallel; T030 and T031 same file — sequential
**Phase 4**: T042, T043, T045, T050, T051 parallel; T052, T053 parallel; T054 after T052+T053
**Phase 5**: T056, T057 can be built in parallel (separate methods); T060, T061 parallel
**Phase 6**: T062, T064 parallel; T065 after T062+T063
**Phase 7**: T069, T071, T075 parallel; T073 after T072
**Phase 8**: T077 (backend), T078, T079 parallel
**Phase 9**: T080, T082 parallel; T083 after T080+T082
**Phase 10**: T084, T085 parallel; T087 after T084+T085+T086
**Phase 11**: T088, T089, T090, T091, T092, T093 all parallel

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete **Phase 1** (Setup) — ~1 day
2. Complete **Phase 2** (Foundational: auth + DB) — ~2 days
3. Complete **Phase 3** (US1: Workspace + RBAC) — ~1 day
4. Complete **Phase 4** (US2: Kanban board) — ~2 days
5. **STOP & VALIDATE**: Run `quickstart.md` Scenarios 1–3 end-to-end
6. **MVP is deployable** — working auth, workspace, Kanban board with all task fields

### Incremental Delivery (Full Feature)

| Sprint | Phases | Deliverable |
|--------|--------|-------------|
| 1 | 1 + 2 | Auth + DB foundation |
| 2 | 3 + 4 | Workspace setup + Kanban board (MVP) |
| 3 | 5 + 6 | Task blocking + Recurring tasks |
| 4 | 7 + 10 | Activity trail + Real-time SSE |
| 5 | 8 + 9 | Filter API + NL Quick Add |
| 6 | 11 | Polish, load test, documentation |

### Parallel Team Strategy

With 2 developers after Phase 2 is complete:

- **Dev A**: Phase 3 (Workspaces) → Phase 5 (Blocking) → Phase 9 (NLP)
- **Dev B**: Phase 4 (Kanban) → Phase 6 (Recurring) → Phase 7 (Activity) → Phase 8 (Filter) → Phase 10 (SSE)

---

## Notes

- All `[P]` tasks operate on **different files** and have no dependency on incomplete tasks in the same batch — safe to parallelize
- `[US#]` label maps each task to the user story from `spec.md` for traceability
- **Commit strategy**: commit after each completed task or logical group (model + migration together); do not commit broken states
- **Validate independently**: each phase has a listed checkpoint — stop and run the relevant `quickstart.md` scenario before proceeding
- **Database migrations**: always review autogenerated Alembic scripts before applying; never run `create_all()` in production
- **SSE token**: since SSE `EventSource` cannot set headers, pass the JWT as `?token=` query param on the SSE endpoint; validate it the same way as the `Authorization` header
- **OpenAI key**: set `OPENAI_API_KEY` in `.env`; the NLP service returns a structured 503 if the key is missing or service unreachable — never block task creation on NLP failure

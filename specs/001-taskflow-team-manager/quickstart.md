# Quickstart Validation Guide: TaskFlow Team Task Manager

**Purpose**: End-to-end validation scenarios to confirm the feature works correctly. Use this guide to verify each user story independently after implementation.
**Contracts**: See [contracts/api.md](./contracts/api.md)
**Data Model**: See [data-model.md](./data-model.md)

---

## Prerequisites

### Backend
- Python 3.12+
- PostgreSQL 16 running locally (or use Docker: `docker run -e POSTGRES_DB=taskflow -e POSTGRES_USER=taskflow -e POSTGRES_PASSWORD=secret -p 5432:5432 postgres:16`)
- Environment variables set (see `.env.example`):
  ```
  DATABASE_URL=postgresql+asyncpg://taskflow:secret@localhost:5432/taskflow
  SECRET_KEY=<32-char random string>
  OPENAI_API_KEY=<your key>
  ```
- Database migrations applied: `alembic upgrade head`
- Backend running: `uvicorn app.main:app --reload --port 8000`

### Frontend
- Node 20+
- Frontend running: `npm run dev` (default: `http://localhost:5173`)
- Backend URL configured in `frontend/.env`: `VITE_API_URL=http://localhost:8000`

### Test Client Options
- **`curl`** (shown in examples below)
- **HTTPie** (`http POST localhost:8000/api/v1/auth/token ...`)
- **Browser** (for SSE and UI scenarios)
- **Bruno / Postman** — import `contracts/api.md` examples

---

## Scenario 1: User Registration & Authentication

**Maps to**: FR-001, US-1

```bash
# 1. Register user A (workspace owner)
curl -s -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"anusha@example.com","name":"Anusha","password":"SecurePass123!"}' \
  | jq '{id, email, name}'
# Expected: {"id": "...", "email": "anusha@example.com", "name": "Anusha"}

# 2. Login — access token in body, refresh cookie set automatically
curl -s -c cookies.txt -X POST http://localhost:8000/api/v1/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'username=anusha@example.com&password=SecurePass123!' \
  | jq '{access_token, token_type, expires_in}'
# Expected: {"access_token": "eyJ...", "token_type": "bearer", "expires_in": 900}
# Save: export TOKEN=$(... | jq -r '.access_token')

# 3. Verify token works
curl -s http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .
# Expected: current user object

# 4. Refresh token
curl -s -b cookies.txt -c cookies.txt -X POST \
  http://localhost:8000/api/v1/auth/refresh | jq '{access_token}'
# Expected: new access token issued; old refresh token revoked

# 5. Logout
curl -s -b cookies.txt -X POST http://localhost:8000/api/v1/auth/logout
# Expected: 204 No Content; refresh token cookie cleared
```

---

## Scenario 2: Workspace Setup & Role-Based Access Control

**Maps to**: FR-002–FR-006, FR-007, US-1

```bash
# Setup: Register two additional users (B = admin, C = member)
# ... (register teammate-b@example.com and teammate-c@example.com same as above)
# Login as user A, save token as $TOKEN_A

# 1. Create workspace
WS_ID=$(curl -s -X POST http://localhost:8000/api/v1/workspaces \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"name":"Design Team","description":"Our workspace"}' | jq -r '.id')
echo "Workspace: $WS_ID"
# Expected: workspace object with owner_id = user A's ID

# 2. Invite user B as ADMIN
curl -s -X POST http://localhost:8000/api/v1/workspaces/$WS_ID/invites \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"email":"teammate-b@example.com","role":"ADMIN"}'
# Expected: 201 with invite_id, role=ADMIN

# 3. Invite user C as MEMBER
curl -s -X POST http://localhost:8000/api/v1/workspaces/$WS_ID/invites \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"email":"teammate-c@example.com","role":"MEMBER"}'

# 4. Verify member list
curl -s http://localhost:8000/api/v1/workspaces/$WS_ID/members \
  -H "Authorization: Bearer $TOKEN_A" | jq '.items[] | {name, role}'
# Expected: Anusha=OWNER, User B=ADMIN, User C=MEMBER

# 5. Member (C) attempts to change a role — must be rejected
curl -s -X PATCH http://localhost:8000/api/v1/workspaces/$WS_ID/members/USER_B_ID \
  -H "Authorization: Bearer $TOKEN_C" \
  -H "Content-Type: application/json" \
  -d '{"role":"MEMBER"}'
# Expected: 403 {"code": "INSUFFICIENT_ROLE"}

# 6. Admin (B) creates a project — must succeed
PROJECT_ID=$(curl -s -X POST http://localhost:8000/api/v1/workspaces/$WS_ID/projects \
  -H "Authorization: Bearer $TOKEN_B" \
  -H "Content-Type: application/json" \
  -d '{"name":"Q3 Campaign"}' | jq -r '.id')
# Expected: 201 with project object
```

---

## Scenario 3: Kanban Task Management

**Maps to**: FR-008–FR-010, US-2

```bash
# Prerequisites: workspace + project created (Scenario 2)

# 1. Create a task in TODO
TASK_ID=$(curl -s -X POST http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Review the deck",
    "description": "Check slides 5-12 for accuracy",
    "status": "TODO",
    "due_date": "2026-08-29",
    "assignee_id": "'$USER_A_ID'",
    "tag_ids": [],
    "commands": [{"label":"Open Deck","url":"https://docs.google.com/..."}]
  }' | jq -r '.id')
# Expected: 201 with task in TODO column

# 2. View board — task appears in TODO column
curl -s "http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks?view=board" \
  -H "Authorization: Bearer $TOKEN_A" | jq '.columns.TODO | length'
# Expected: 1

# 3. Move task to IN_PROGRESS
curl -s -X PATCH http://localhost:8000/api/v1/tasks/$TASK_ID \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_PROGRESS"}'
# Expected: 200 with updated task; status = IN_PROGRESS

# 4. Verify activity log records the change
curl -s http://localhost:8000/api/v1/tasks/$TASK_ID/activity \
  -H "Authorization: Bearer $TOKEN_A" | jq '.items[0]'
# Expected: entry_type=FIELD_CHANGE, payload.field=status, from=TODO, to=IN_PROGRESS, actor.name=Anusha
```

---

## Scenario 4: Task Blocking Dependencies

**Maps to**: FR-011–FR-012, US-3

```bash
# 1. Create two tasks: Blocker (Task A) and Blocked (Task B)
TASK_A_ID=$(curl -s -X POST http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login bug","status":"TODO"}' | jq -r '.id')

TASK_B_ID=$(curl -s -X POST http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"title":"Deploy to prod","status":"TODO"}' | jq -r '.id')

# 2. Mark Task A as a blocker for Task B
curl -s -X POST http://localhost:8000/api/v1/tasks/$TASK_B_ID/blockers \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"blocker_id": "'$TASK_A_ID'"}'
# Expected: 201

# 3. Attempt to move Task B to IN_PROGRESS — must be rejected
curl -s -X PATCH http://localhost:8000/api/v1/tasks/$TASK_B_ID \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS"}'
# Expected: 409 {"code": "TASK_BLOCKED", "blockers": [{title: "Fix login bug", ...}]}

# 4. Complete Task A
curl -s -X PATCH http://localhost:8000/api/v1/tasks/$TASK_A_ID \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"status":"DONE"}'
# Expected: 200

# 5. Move Task B to IN_PROGRESS — must now succeed
curl -s -X PATCH http://localhost:8000/api/v1/tasks/$TASK_B_ID \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS"}'
# Expected: 200; is_blocked=false in response

# 6. Verify Task B detail shows blocker history in activity log
curl -s http://localhost:8000/api/v1/tasks/$TASK_B_ID/activity \
  -H "Authorization: Bearer $TOKEN_A" | jq '.items[] | select(.entry_type=="BLOCKER_ADDED")'
# Expected: BLOCKER_ADDED entry when block was set
```

---

## Scenario 5: Recurring Tasks

**Maps to**: FR-013–FR-017, US-4

```bash
# 1. Create a task with a due date
REC_TASK_ID=$(curl -s -X POST http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"title":"Weekly team standup","status":"TODO","due_date":"2026-08-25"}' \
  | jq -r '.id')

# 2. Mark it as recurring weekly
curl -s -X POST http://localhost:8000/api/v1/tasks/$REC_TASK_ID/recurring \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"cadence":"WEEKLY","interval_days":7}'
# Expected: 200; series_id populated in task response

# 3. Mark the task as Done
curl -s -X PATCH http://localhost:8000/api/v1/tasks/$REC_TASK_ID \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"status":"DONE"}'
# Expected: 200; background task spawns new instance

# 4. Wait ~2 seconds, then check board for new instance
sleep 2
curl -s "http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks?view=board" \
  -H "Authorization: Bearer $TOKEN_A" | jq '.columns.TODO[] | select(.title=="Weekly team standup") | {title, due_date, series_id}'
# Expected: new task in TODO with due_date=2026-09-01 (7 days later), same series_id

# 5. Disable recurrence on the new instance
NEW_TASK_ID="<id from step 4>"
curl -s -X DELETE http://localhost:8000/api/v1/tasks/$NEW_TASK_ID/recurring \
  -H "Authorization: Bearer $TOKEN_A"
# Expected: 200; series.is_active=false; no future instances will spawn
```

---

## Scenario 6: Comments & Activity Audit Trail

**Maps to**: FR-018–FR-021, US-5

```bash
# Prerequisites: A task exists at $TASK_ID

# 1. Add a comment
curl -s -X POST http://localhost:8000/api/v1/tasks/$TASK_ID/comments \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"text":"Looks good, merging tomorrow"}'
# Expected: 201; entry_type=COMMENT

# 2. Make field changes
curl -s -X PATCH http://localhost:8000/api/v1/tasks/$TASK_ID \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"assignee_id":"'$USER_B_ID'","due_date":"2026-09-10"}'
# Expected: 200

# 3. Verify unified activity feed shows all entries in time order
curl -s http://localhost:8000/api/v1/tasks/$TASK_ID/activity \
  -H "Authorization: Bearer $TOKEN_A" \
  | jq '[.items[] | {entry_type, "field": .payload.field}]'
# Expected: feed contains COMMENT + FIELD_CHANGE(assignee) + FIELD_CHANGE(due_date), newest first

# 4. Verify feed is immutable — attempt to delete a comment (should fail or not be exposed)
# No DELETE /comments endpoint should exist in the API
# Test: curl -X DELETE http://localhost:8000/api/v1/activity/ENTRY_ID — Expected: 404 or 405

# 5. Pagination test — create 60 activity events, then paginate
# (load test helper or loop of 60 PATCH requests changing due_date)
curl -s "http://localhost:8000/api/v1/tasks/$TASK_ID/activity?limit=50" \
  -H "Authorization: Bearer $TOKEN_A" | jq '{count: (.items | length), next_cursor}'
# Expected: 50 items, next_cursor present
curl -s "http://localhost:8000/api/v1/tasks/$TASK_ID/activity?limit=50&before_id=CURSOR" \
  -H "Authorization: Bearer $TOKEN_A" | jq '.items | length'
# Expected: remaining items ≥ 10
```

---

## Scenario 7: Search & Filter

**Maps to**: FR-022–FR-024, SC-003, US-6

```bash
# Prerequisites: Create 10 tasks with varied statuses, assignees, and tags

# Setup: create tags
TAG_ID=$(curl -s -X POST http://localhost:8000/api/v1/workspaces/$WS_ID/tags \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"name":"urgent","color":"#FF5733"}' | jq -r '.id')

# 1. Filter by status
curl -s "http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks?status=TODO&view=list" \
  -H "Authorization: Bearer $TOKEN_A" | jq '[.items[] | .status] | unique'
# Expected: ["TODO"]

# 2. Filter by assignee
curl -s "http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks?assignee_id=$USER_A_ID&view=list" \
  -H "Authorization: Bearer $TOKEN_A" | jq '[.items[] | .assignee.id] | unique'
# Expected: ["$USER_A_ID"]

# 3. Filter by tag
curl -s "http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks?tag_id=$TAG_ID&view=list" \
  -H "Authorization: Bearer $TOKEN_A" | jq '[.items[] | .tags[] | select(.id=="'$TAG_ID'").name] | unique'
# Expected: ["urgent"]

# 4. Combined filter (AND logic)
curl -s "http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks?status=TODO&assignee_id=$USER_A_ID&tag_id=$TAG_ID&view=list" \
  -H "Authorization: Bearer $TOKEN_A" | jq '.items | length'
# Expected: count of tasks that satisfy ALL three conditions

# 5. Performance check (SC-003: <1 second for 1,000 tasks)
# Use a test script or k6 to create 1,000 tasks in the project, then:
time curl -s "http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks?status=IN_PROGRESS&assignee_id=$USER_A_ID&view=list" \
  -H "Authorization: Bearer $TOKEN_A" > /dev/null
# Expected: real time < 1.0s
```

---

## Scenario 8: Natural Language Quick Add

**Maps to**: FR-025–FR-029, SC-006, US-7

```bash
# 1. Parse a well-formed natural language input
curl -s -X POST http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks/parse \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"text":"remind Anusha to review the deck by Friday"}'
# Expected: {parsed: {title: "Review the deck", assignee: {name: "Anusha"}, due_date: "2026-08-29"}, warnings: [], parse_confidence: 1.0}

# 2. Confirm task creation with parsed data
curl -s -X POST http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"title":"Review the deck","assignee_id":"'$USER_A_ID'","due_date":"2026-08-29","status":"TODO"}'
# Expected: 201 with created task

# 3. Ambiguous assignee — multiple members named "Sam"
curl -s -X POST http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks/parse \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"text":"ask Sam to write tests by Monday"}'
# Expected: {parsed: {assignee: null, due_date: "2026-08-31"}, warnings: ["Assignee 'Sam' matched multiple workspace members..."]}

# 4. No due date in input
curl -s -X POST http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks/parse \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"text":"someone needs to update the README"}'
# Expected: {parsed: {due_date: null}, warnings: ["No due date detected in input"]}
```

---

## Scenario 9: Real-Time Board Updates (SSE)

**Maps to**: SC-002, US-2

```bash
# Terminal 1: Subscribe to project SSE stream
curl -s -N -H "Accept: text/event-stream" \
  -H "Authorization: Bearer $TOKEN_A" \
  "http://localhost:8000/api/v1/projects/$PROJECT_ID/events"
# Leave this running

# Terminal 2: Move a task — Terminal 1 should receive task_updated event within 1 second
curl -s -X PATCH http://localhost:8000/api/v1/tasks/$TASK_ID \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"status":"IN_REVIEW"}'

# Terminal 1 expected output:
# event: task_updated
# data: {"task_id": "...", "changes": {"status": "IN_REVIEW"}}
```

---

## Scenario 10: Concurrent User Load (SC-008)

**Maps to**: SC-008

```bash
# Install k6: brew install k6
# Create k6 load script (see scratch/load-test.js)
k6 run --vus 50 --duration 60s scratch/load-test.js
# Expected: p95 response time < 500ms; no 5xx errors; board reads consistent
```

**Minimal k6 script outline** (`scratch/load-test.js`):
```js
import http from 'k6/http';
export default function () {
  // Rotate through 50 pre-created user tokens
  const token = tokens[__VU % tokens.length];
  http.get(`${BASE_URL}/api/v1/projects/${PROJECT_ID}/tasks?view=board`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}
```

---

## Success Criteria Verification Matrix

| SC | Scenario | Pass Condition |
|----|----------|----------------|
| SC-001 | Scenarios 2–3 | Full onboarding flow (workspace → project → task) completes in < 3 min manually |
| SC-002 | Scenario 9 | SSE event received within 1 second of task update |
| SC-003 | Scenario 7 (step 5) | Filter query on 1,000 tasks returns in < 1 second |
| SC-004 | Scenario 5 (step 4) | New recurring instance visible within 5 seconds of completion |
| SC-005 | Scenario 6 | Activity log entries found for 100% of field changes in test run |
| SC-006 | Scenario 8 | 85%+ of well-formed NL inputs correctly parse assignee and due date |
| SC-007 | Scenario 4 (step 3) | 100% of blocked task transition attempts are rejected with 409 |
| SC-008 | Scenario 10 | 50 VUs sustained for 60s with p95 < 500ms, 0 errors |

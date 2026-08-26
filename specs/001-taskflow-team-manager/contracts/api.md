# API Contracts: TaskFlow Backend

**Type**: REST API (JSON over HTTP)
**Base URL**: `/api/v1`
**Auth**: JWT access token in `Authorization: Bearer <token>` header
**Date format**: ISO 8601 UTC (`2026-09-01T14:30:00Z` for datetimes, `2026-09-01` for dates)
**Pagination**: Keyset cursor via `before_id` query param; default page size 50
**Error format**: `{"detail": "Human-readable message", "code": "MACHINE_CODE"}`

> See [data-model.md](../data-model.md) for entity field definitions.

---

## Authentication

### `POST /api/v1/auth/register`
Register a new user account.

**Request**
```json
{
  "email": "anusha@example.com",
  "name": "Anusha",
  "password": "SecurePass123!"
}
```

**Response** `201 Created`
```json
{
  "id": "uuid",
  "email": "anusha@example.com",
  "name": "Anusha",
  "avatar_url": null,
  "created_at": "2026-08-25T19:00:00Z"
}
```

---

### `POST /api/v1/auth/token`
Login. Returns access token in body; sets refresh token as `httpOnly` cookie.

**Request** (`application/x-www-form-urlencoded` — OAuth2 compatible)
```
username=anusha@example.com&password=SecurePass123!
```

**Response** `200 OK`
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "expires_in": 900
}
```
+ `Set-Cookie: refresh_token=<opaque>; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth/refresh`

---

### `POST /api/v1/auth/refresh`
Exchange refresh token cookie for a new access token.

**Request**: No body. Browser sends `refresh_token` cookie automatically.

**Response** `200 OK`
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "expires_in": 900
}
```

---

### `POST /api/v1/auth/logout`
Revoke the current refresh token.

**Response** `204 No Content` + `Set-Cookie: refresh_token=; Max-Age=0`

---

### `GET /api/v1/auth/me`
Get the current authenticated user.

**Response** `200 OK`
```json
{
  "id": "uuid",
  "email": "anusha@example.com",
  "name": "Anusha",
  "avatar_url": null
}
```

---

## Workspaces

### `POST /api/v1/workspaces`
Create a workspace. Caller becomes OWNER automatically.

**Request**
```json
{
  "name": "Design Team",
  "description": "All design projects"
}
```

**Response** `201 Created`
```json
{
  "id": "uuid",
  "name": "Design Team",
  "description": "All design projects",
  "owner_id": "user-uuid",
  "created_at": "2026-08-25T19:00:00Z"
}
```

---

### `GET /api/v1/workspaces`
List all workspaces the authenticated user belongs to.

**Response** `200 OK`
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Design Team",
      "role": "OWNER",
      "member_count": 4
    }
  ]
}
```

---

### `GET /api/v1/workspaces/{workspace_id}`
Get workspace details. Requires workspace membership.

---

### `PATCH /api/v1/workspaces/{workspace_id}`
Update workspace name/description. Requires ADMIN+.

**Request** (partial update — all fields optional)
```json
{ "name": "New Name", "description": "Updated description" }
```

---

### `DELETE /api/v1/workspaces/{workspace_id}`
Soft-delete workspace. Requires OWNER only.

**Response** `204 No Content`

---

### `GET /api/v1/workspaces/{workspace_id}/members`
List workspace members and their roles. Requires workspace membership.

**Response** `200 OK`
```json
{
  "items": [
    {
      "user_id": "uuid",
      "name": "Anusha",
      "email": "anusha@example.com",
      "avatar_url": null,
      "role": "OWNER",
      "joined_at": "2026-08-25T19:00:00Z"
    }
  ]
}
```

---

### `POST /api/v1/workspaces/{workspace_id}/invites`
Invite a user by email. Requires ADMIN+.

**Request**
```json
{
  "email": "teammate@example.com",
  "role": "MEMBER"
}
```

**Response** `201 Created`
```json
{
  "invite_id": "uuid",
  "email": "teammate@example.com",
  "role": "MEMBER",
  "status": "PENDING"
}
```

---

### `PATCH /api/v1/workspaces/{workspace_id}/members/{user_id}`
Change a member's role. Requires ADMIN+ (OWNER only for OWNER role changes).

**Request**
```json
{ "role": "ADMIN" }
```

---

### `DELETE /api/v1/workspaces/{workspace_id}/members/{user_id}`
Remove a member from the workspace. Requires ADMIN+.

**Response** `204 No Content`

---

### `POST /api/v1/workspaces/{workspace_id}/transfer`
Transfer workspace ownership. Requires OWNER.

**Request**
```json
{ "new_owner_id": "user-uuid" }
```

---

## Projects

### `POST /api/v1/workspaces/{workspace_id}/projects`
Create a project. Requires ADMIN+.

**Request**
```json
{
  "name": "Q3 Campaign",
  "description": "Marketing campaign for Q3"
}
```

**Response** `201 Created`
```json
{
  "id": "uuid",
  "workspace_id": "uuid",
  "name": "Q3 Campaign",
  "description": "...",
  "status": "ACTIVE",
  "created_at": "2026-08-25T19:00:00Z"
}
```

---

### `GET /api/v1/workspaces/{workspace_id}/projects`
List projects in a workspace. Requires membership. Filters: `?status=ACTIVE|ARCHIVED`

---

### `PATCH /api/v1/workspaces/{workspace_id}/projects/{project_id}`
Update or archive a project. Requires ADMIN+.

**Request**
```json
{ "name": "New Name", "status": "ARCHIVED" }
```

---

## Tasks

### `GET /api/v1/projects/{project_id}/tasks`
List tasks with optional filters. Returns tasks grouped for Kanban board or flat list.

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `status` | `TODO\|IN_PROGRESS\|IN_REVIEW\|DONE` | Filter by status (repeatable: `?status=TODO&status=IN_PROGRESS`) |
| `assignee_id` | UUID | Filter by assignee (repeatable) |
| `tag_id` | UUID | Filter by tag (repeatable; AND logic — all specified tags must match) |
| `view` | `board\|list` | `board` returns tasks keyed by status column; `list` returns flat array |
| `before_id` | UUID | Keyset cursor for pagination (list view only) |
| `limit` | integer | Page size, default 50, max 200 |

**Response** `200 OK` (board view)
```json
{
  "columns": {
    "TODO": [ /* task objects */ ],
    "IN_PROGRESS": [ /* task objects */ ],
    "IN_REVIEW": [ /* task objects */ ],
    "DONE": [ /* task objects */ ]
  }
}
```

**Task object schema**:
```json
{
  "id": "uuid",
  "title": "Review the deck",
  "description": "Check slides 5-12",
  "status": "TODO",
  "due_date": "2026-08-29",
  "assignee": {
    "id": "uuid",
    "name": "Anusha",
    "avatar_url": null
  },
  "tags": [
    { "id": "uuid", "name": "urgent", "color": "#FF5733" }
  ],
  "commands": [
    { "label": "Open Deck", "url": "https://docs.google.com/..." }
  ],
  "is_blocked": true,
  "blockers": [
    { "id": "uuid", "title": "Fix login bug", "status": "IN_PROGRESS" }
  ],
  "blocking": [
    { "id": "uuid", "title": "Deploy to prod" }
  ],
  "series_id": null,
  "created_at": "2026-08-25T19:00:00Z",
  "updated_at": "2026-08-25T19:30:00Z"
}
```

---

### `POST /api/v1/projects/{project_id}/tasks`
Create a task. Requires workspace membership.

**Request**
```json
{
  "title": "Review the deck",
  "description": "Check slides 5-12 for accuracy",
  "status": "TODO",
  "due_date": "2026-08-29",
  "assignee_id": "user-uuid",
  "tag_ids": ["tag-uuid-1", "tag-uuid-2"],
  "commands": [
    { "label": "Open Deck", "url": "https://docs.google.com/..." }
  ],
  "blocker_ids": [],
  "series_id": null
}
```

**Response** `201 Created` → task object (see above)

---

### `GET /api/v1/tasks/{task_id}`
Get a single task with full detail including blockers, blocking, and latest activity. Requires workspace membership.

---

### `PATCH /api/v1/tasks/{task_id}`
Update task fields (partial update). Requires workspace membership.
All fields optional. Any changed field is automatically written to `activity_feed`.

**Request**
```json
{
  "title": "Updated title",
  "status": "IN_PROGRESS",
  "assignee_id": "user-uuid",
  "due_date": "2026-09-05",
  "tag_ids": ["tag-uuid-1"],
  "commands": []
}
```

**Error** `409 Conflict` when moving to `IN_PROGRESS` with active blockers:
```json
{
  "detail": "Task is blocked by 1 incomplete task(s)",
  "code": "TASK_BLOCKED",
  "blockers": [
    { "id": "uuid", "title": "Fix login bug", "status": "IN_PROGRESS" }
  ]
}
```

---

### `DELETE /api/v1/tasks/{task_id}`
Delete a task. Requires ADMIN+. Cascades: removes blocker entries, activity log entries, tag associations.

**Response** `204 No Content`

---

### `POST /api/v1/tasks/{task_id}/blockers`
Add a blocking relationship. Task at `{task_id}` will be blocked by `blocker_id`.

**Request**
```json
{ "blocker_id": "task-uuid" }
```

**Error** `409 Conflict` if adding would create a cycle.

---

### `DELETE /api/v1/tasks/{task_id}/blockers/{blocker_id}`
Remove a blocking relationship. Requires workspace membership.

**Response** `204 No Content`

---

### `POST /api/v1/tasks/{task_id}/recurring`
Mark a task as recurring and associate it with a new or existing series.

**Request**
```json
{
  "cadence": "WEEKLY",
  "interval_days": 7
}
```

**Response** `200 OK` → updated task object with `series_id` populated.

---

### `DELETE /api/v1/tasks/{task_id}/recurring`
Disable recurrence. Sets `series.is_active = false`. No future instances will be spawned.

---

## Comments & Activity Feed

### `GET /api/v1/tasks/{task_id}/activity`
Get the unified activity feed for a task (comments + field changes), newest first.

**Query Params**: `before_id` (cursor), `limit` (default 50)

**Response** `200 OK`
```json
{
  "items": [
    {
      "id": "uuid",
      "entry_type": "COMMENT",
      "actor": { "id": "uuid", "name": "Anusha", "avatar_url": null },
      "payload": { "text": "Looks good, merging tomorrow" },
      "created_at": "2026-08-25T20:00:00Z"
    },
    {
      "id": "uuid",
      "entry_type": "FIELD_CHANGE",
      "actor": { "id": "uuid", "name": "Anusha", "avatar_url": null },
      "payload": {
        "field": "status",
        "from": "TODO",
        "to": "IN_PROGRESS"
      },
      "created_at": "2026-08-25T19:45:00Z"
    }
  ],
  "next_cursor": "uuid-of-last-item"
}
```

---

### `POST /api/v1/tasks/{task_id}/comments`
Add a comment to a task's activity feed. Requires workspace membership.

**Request**
```json
{ "text": "Looks good, merging tomorrow" }
```

**Response** `201 Created` → activity feed entry object

---

## Tags

### `GET /api/v1/workspaces/{workspace_id}/tags`
List all tags in a workspace. Supports `?q=search_term` for autocomplete.

**Response** `200 OK`
```json
{
  "items": [
    { "id": "uuid", "name": "urgent", "color": "#FF5733" }
  ]
}
```

---

### `POST /api/v1/workspaces/{workspace_id}/tags`
Create a tag. Requires workspace membership. Idempotent on duplicate name (returns existing tag).

**Request**
```json
{ "name": "urgent", "color": "#FF5733" }
```

---

### `DELETE /api/v1/workspaces/{workspace_id}/tags/{tag_id}`
Delete a tag from the workspace. Requires ADMIN+. Removes tag from all tasks.

---

## Natural Language Quick Add

### `POST /api/v1/projects/{project_id}/tasks/parse`
Parse a natural language string into a structured task preview. Does NOT create the task.

**Request**
```json
{
  "text": "remind Anusha to review the deck by Friday"
}
```

**Response** `200 OK`
```json
{
  "parsed": {
    "title": "Review the deck",
    "assignee": {
      "id": "user-uuid",
      "name": "Anusha",
      "match_confidence": 0.95
    },
    "due_date": "2026-08-29",
    "tags": [],
    "commands": []
  },
  "warnings": [],
  "parse_confidence": 1.0
}
```

**Response with unresolved fields** `200 OK`
```json
{
  "parsed": {
    "title": "Schedule team sync",
    "assignee": null,
    "due_date": null,
    "tags": [],
    "commands": []
  },
  "warnings": [
    "Assignee 'Sam' matched multiple workspace members — please select manually",
    "No due date detected in input"
  ],
  "parse_confidence": 0.33
}
```

**Error** `503 Service Unavailable` if the LLM service is unreachable.

> After reviewing the preview, the user submits `POST /api/v1/projects/{project_id}/tasks` with the (possibly edited) structured fields.

---

## Real-Time Events (Server-Sent Events)

### `GET /api/v1/projects/{project_id}/events`
Subscribe to real-time board updates for a project. Long-lived SSE connection.

**Headers required**: `Accept: text/event-stream`

**Event types emitted**:
```
event: task_created
data: { "task": { /* task object */ } }

event: task_updated
data: { "task_id": "uuid", "changes": { "status": "IN_PROGRESS" } }

event: task_deleted
data: { "task_id": "uuid" }

event: activity_added
data: { "task_id": "uuid", "entry": { /* activity entry */ } }

event: recurring_spawned
data: { "original_task_id": "uuid", "new_task": { /* task object */ } }
```

**Client**: Use `EventSource` API:
```js
const es = new EventSource(`/api/v1/projects/${projectId}/events`, {
  withCredentials: true
});
es.addEventListener('task_updated', (e) => {
  const { task_id, changes } = JSON.parse(e.data);
  queryClient.invalidateQueries(['tasks', task_id]);
});
```

---

## Common Error Codes

| HTTP Status | Code | Meaning |
|-------------|------|---------|
| 400 | `VALIDATION_ERROR` | Invalid request body or params |
| 401 | `NOT_AUTHENTICATED` | Missing or invalid access token |
| 403 | `INSUFFICIENT_ROLE` | Role too low for this action |
| 403 | `NOT_WORKSPACE_MEMBER` | User not in this workspace |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `TASK_BLOCKED` | Status transition blocked by incomplete blockers |
| 409 | `BLOCKER_CYCLE` | Adding blocker would create a dependency cycle |
| 409 | `DUPLICATE_TAG` | Tag with this name already exists in workspace |
| 503 | `LLM_UNAVAILABLE` | NL parse service temporarily unavailable |

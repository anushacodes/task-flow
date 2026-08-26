# Feature Specification: TaskFlow Team Task Manager

**Feature Branch**: `001-taskflow-team-manager`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Help me build a web app called TaskFlow, which is like a team task manager. In this, there are users and workspaces, and a user can belong to multiple workspaces with a role per workspace. It can be an owner, admin, or a member. There are projects, which consist of tasks that live inside the projects inside a workspace. The fields would be: title, description, status, due date, assignee, tags, commands. A task can block another task, and a blocked task can't move to in progress until its blocker is done. There are also recurring tasks that repeat weekly, so this should be like a Kanban-type board. You need to generate new instances on completion for recurring tasks. There's also a comments plus activities log, like an audit trail per task: who changed what and when. This is for the observability part. There should also be a search/filter API by status, assignee, and tags. I also want a quick add entry point where you can just take a natural language string, like 'remind Anusha to review the deck by Friday,' and then it parses it into a structured task using an LM call."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Workspace & Project Setup (Priority: P1)

A workspace owner creates a new workspace, invites teammates, and assigns each one a role (owner, admin, or member). They then create a project within the workspace to organize work. This is the foundational setup that makes all other functionality possible.

**Why this priority**: Without workspaces, projects, and role-based membership, no other feature can be used. This is the mandatory scaffolding.

**Independent Test**: Can be fully tested by creating a workspace, inviting two users with different roles, and creating a project — delivering a functional team workspace ready to accept tasks.

**Acceptance Scenarios**:

1. **Given** a registered user, **When** they create a workspace and name it, **Then** they become the workspace owner and can invite others.
2. **Given** a workspace owner, **When** they invite a user and assign the "admin" role, **Then** that user can manage projects and tasks but cannot delete the workspace.
3. **Given** a workspace owner, **When** they invite a user as "member," **Then** that user can view and update tasks but cannot change roles or workspace settings.
4. **Given** a workspace admin, **When** they create a project inside the workspace, **Then** the project is listed under that workspace and accessible to all workspace members.
5. **Given** a member user, **When** they attempt to change another user's role, **Then** the system rejects the action with a clear permission error.

---

### User Story 2 - Kanban Task Management (Priority: P1)

A team member opens a project and sees a Kanban board with columns representing task statuses. They create tasks with all required fields, drag them across columns to update status, and manage the board day-to-day.

**Why this priority**: The Kanban board is the core value proposition — the primary daily interaction surface for all users.

**Independent Test**: Can be fully tested by creating tasks in a project, moving them across status columns, and verifying fields like assignee, due date, and tags update correctly.

**Acceptance Scenarios**:

1. **Given** a project, **When** a user creates a task with title, description, status, due date, assignee, and tags, **Then** the task appears in the correct Kanban column matching its status.
2. **Given** a task in "To Do" status, **When** a user drags it to the "In Progress" column, **Then** its status updates and the activity log records who moved it and when.
3. **Given** a task, **When** a user updates the assignee, **Then** the new assignee can see the task in their assigned-tasks view and the change is logged in the activity trail.
4. **Given** a task, **When** a user adds tags, **Then** the task is filterable by those tags across the project board.
5. **Given** a completed task, **When** a user views the board, **Then** completed tasks are visible in the "Done" column and can be archived.

---

### User Story 3 - Task Blocking Dependencies (Priority: P2)

A project lead marks Task B as blocked by Task A. Team members trying to move Task B forward are prevented from doing so until Task A is resolved, ensuring correct workflow sequencing.

**Why this priority**: Blocking relationships are critical for enforcing work sequencing and preventing premature progress, but the board is still usable without them for basic workflows.

**Independent Test**: Can be fully tested by creating two tasks, marking one as blocking the other, verifying the blocked task cannot move to "In Progress," and then completing the blocker and confirming the blocked task is now moveable.

**Acceptance Scenarios**:

1. **Given** two tasks, **When** a user sets Task A as a blocker for Task B, **Then** Task B displays a "blocked" indicator and the blocking relationship is visible.
2. **Given** Task B is blocked by Task A, **When** a user attempts to move Task B to "In Progress," **Then** the system prevents the transition and displays a message explaining which task is blocking it.
3. **Given** Task B is blocked by Task A, **When** Task A is marked as "Done," **Then** Task B's blocked status is lifted and it can freely move to "In Progress."
4. **Given** a task, **When** a user views its detail, **Then** they can see both which tasks it blocks and which tasks are blocking it.

---

### User Story 4 - Recurring Tasks (Priority: P2)

A team lead marks a task as recurring on a weekly cadence. When that task is completed, the system automatically generates the next instance one week out with the same configuration, maintaining a continuous workflow without manual re-creation.

**Why this priority**: Recurring tasks reduce operational overhead for repeating work, but are a productivity enhancement rather than a core workflow blocker.

**Independent Test**: Can be fully tested by creating a recurring weekly task, marking it complete, and verifying a new task instance is automatically created with the correct due date one week later.

**Acceptance Scenarios**:

1. **Given** a task marked as "recurring weekly," **When** a user marks it as "Done," **Then** the system automatically creates a new task instance with the same title, description, assignee, and tags, with the due date advanced by 7 days.
2. **Given** a recurring task instance, **When** it is created, **Then** it is placed in the "To Do" column and linked back to the series for traceability.
3. **Given** a recurring task, **When** a user wants to stop recurrence, **Then** they can disable the recurring flag and no further instances are generated after the current one completes.
4. **Given** a recurring task instance, **When** a user edits its fields, **Then** changes apply only to that instance (not retroactively to the series configuration) unless the user explicitly opts to update the series.

---

### User Story 5 - Comments & Activity Audit Trail (Priority: P2)

A team member opens a task and sees a chronological log of all changes made — who changed the status, reassigned the task, updated the due date — alongside a comment thread for discussion.

**Why this priority**: Observability and communication context are essential for async team collaboration and accountability, but teams can begin work before this is in place.

**Independent Test**: Can be fully tested by performing several task updates (change status, reassign, update due date), then viewing the task detail to verify each action is logged with actor, timestamp, and before/after values.

**Acceptance Scenarios**:

1. **Given** any task field change (status, assignee, due date, tags), **When** the change is saved, **Then** the activity log records the actor's name, the field changed, the old value, the new value, and the timestamp.
2. **Given** a task, **When** a user adds a comment, **Then** the comment appears in the activity timeline in chronological order with the author's name and timestamp.
3. **Given** a task's activity log, **When** a user views it, **Then** they see a unified feed of both comments and system-generated activity events ordered newest-first by default.
4. **Given** a task with many activities, **When** a user scrolls the log, **Then** the log supports pagination so performance does not degrade for long-lived tasks.

---

### User Story 6 - Search & Filter (Priority: P3)

A team member needs to find all open tasks assigned to a specific person, or all tasks tagged "urgent" across a project. They use the filter controls to quickly narrow the board view.

**Why this priority**: Filtering is a productivity enhancement. The board is usable without it, but becomes essential as task counts grow.

**Independent Test**: Can be fully tested by creating tasks with varied statuses, assignees, and tags, then using the filter API to query each dimension independently and in combination, verifying only matching tasks are returned.

**Acceptance Scenarios**:

1. **Given** a project with multiple tasks, **When** a user filters by status "In Progress," **Then** only tasks in that status are displayed.
2. **Given** a project with multiple tasks, **When** a user filters by assignee, **Then** only tasks assigned to that person are displayed.
3. **Given** a project with multiple tasks, **When** a user filters by one or more tags, **Then** only tasks containing all specified tags are returned.
4. **Given** filters applied, **When** a user combines status + assignee + tags, **Then** the result is the intersection of all filter conditions.
5. **Given** filter results, **When** there are no matching tasks, **Then** an empty state is displayed with a prompt to clear filters.

---

### User Story 7 - Natural Language Quick Add (Priority: P3)

A user types a natural language string like "remind Anusha to review the deck by Friday" into the quick-add input and the system parses it into a structured task with title, assignee, and due date pre-populated, ready for the user to review and confirm.

**Why this priority**: Quick add is a convenience feature that lowers friction for high-velocity task creation, but the core manual task creation flow covers the same need.

**Independent Test**: Can be fully tested by submitting several natural language strings of varying complexity and verifying the parsed task fields match expected values before confirmation.

**Acceptance Scenarios**:

1. **Given** the quick-add input, **When** a user types "remind Anusha to review the deck by Friday," **Then** the system returns a pre-filled task with title "Review the deck," assignee resolved to the user named Anusha in the workspace, and due date set to the upcoming Friday.
2. **Given** a parsed task preview, **When** the user reviews and confirms, **Then** the task is created exactly as previewed and appears on the Kanban board.
3. **Given** a parsed task preview, **When** the user edits any field before confirming, **Then** the edited values are used for task creation.
4. **Given** an ambiguous natural language input (e.g., assignee name doesn't match any workspace member), **Then** the system flags the unresolved field and prompts the user to clarify before creation.
5. **Given** a natural language input with no recognizable due date, **Then** the task is created with no due date and the user is notified that no date was detected.

---

### Edge Cases

- What happens when a user is removed from a workspace while they are the assignee of open tasks?
- How does the system handle a blocking chain (Task A → Task B → Task C) when Task A is completed but Task B is still in "To Do"?
- What happens when a recurring task's template is deleted — do future instances continue to generate?
- How does quick add behave when multiple workspace members share the same first name?
- What happens when a task's due date passes without it being completed (overdue state)?
- How does the system handle a user who belongs to multiple workspaces attempting to filter tasks across workspace boundaries?
- What happens when a task is both a blocker for another task and is itself blocked?

---

## Requirements *(mandatory)*

### Functional Requirements

#### Users & Workspaces

- **FR-001**: System MUST allow users to register and authenticate to access the platform.
- **FR-002**: System MUST allow authenticated users to create workspaces and become the owner of those workspaces.
- **FR-003**: System MUST allow workspace owners and admins to invite users to a workspace by email.
- **FR-004**: System MUST enforce three workspace roles — Owner, Admin, Member — with distinct permission levels:
  - **Owner**: Full control including workspace deletion and ownership transfer.
  - **Admin**: Can manage projects, tasks, and member roles (but cannot delete the workspace or change the owner).
  - **Member**: Can view and update tasks and comments; cannot manage roles or workspace settings.
- **FR-005**: System MUST allow a single user to belong to multiple workspaces simultaneously, each with an independent role.
- **FR-006**: System MUST allow workspace owners to transfer ownership to another member.

#### Projects & Tasks

- **FR-007**: System MUST allow workspace admins and owners to create, rename, and archive projects within a workspace.
- **FR-008**: System MUST allow tasks to be created within a project with the following fields: title (required), description, status, due date, assignee (a workspace member), tags (multiple), and commands (freeform metadata/action links).
- **FR-009**: System MUST enforce the following task statuses and render them as Kanban board columns: **To Do**, **In Progress**, **In Review**, **Done**.
- **FR-010**: System MUST allow tasks to be moved between status columns; moving a task updates its status and logs the change in the activity trail.
- **FR-011**: System MUST allow a task to be assigned one or more "blocker" tasks. A blocked task MUST NOT be moveable to "In Progress" while any of its blockers remain in a non-"Done" status.
- **FR-012**: System MUST display a clear visual indicator on blocked tasks showing which task(s) are blocking them.

#### Recurring Tasks

- **FR-013**: System MUST allow any task to be marked as "recurring weekly."
- **FR-014**: When a recurring task is marked "Done," the system MUST automatically generate a new task instance with the same title, description, assignee, tags, and commands, with the due date advanced by exactly 7 days from the completed task's due date.
- **FR-015**: If the completed recurring task has no due date, the new instance MUST be created with a due date 7 days from the completion timestamp.
- **FR-016**: System MUST allow users to disable recurrence on a task; disabling stops future instance generation after the current task completes.
- **FR-017**: Edits to a single recurring instance MUST apply only to that instance by default, with an explicit option to propagate changes to the recurrence series configuration.

#### Comments & Activity Log

- **FR-018**: System MUST maintain an activity log per task that records every field change with: actor (user who made the change), field name, old value, new value, and UTC timestamp.
- **FR-019**: System MUST allow workspace members to add comments to any task; each comment records the author and UTC timestamp.
- **FR-020**: System MUST display a unified, chronologically ordered feed of both activity events and comments on the task detail view.
- **FR-021**: The activity log MUST be append-only and immutable; previously logged entries cannot be edited or deleted.

#### Search & Filter

- **FR-022**: System MUST provide a filter capability on the project task view supporting filtering by: status, assignee (single or multiple), and tags (single or multiple).
- **FR-023**: When multiple filter dimensions are combined, results MUST represent the intersection (AND logic) of all applied filters.
- **FR-024**: Filtered views MUST update in near-real-time without requiring a full page reload.

#### Natural Language Quick Add

- **FR-025**: System MUST provide a quick-add input that accepts a natural language string and uses a language model to parse it into structured task fields: title, assignee, due date, and tags (where detectable).
- **FR-026**: The parsed task MUST be presented as a preview for user review and confirmation before being saved.
- **FR-027**: Users MUST be able to edit any parsed field in the preview before confirming task creation.
- **FR-028**: When the parsed assignee name does not uniquely match a workspace member, the system MUST flag the field as unresolved and require the user to select the correct member before confirming.
- **FR-029**: When no due date is detectable from the input, the system MUST create the task without a due date and notify the user.

---

### Key Entities

- **User**: A registered account that can belong to multiple workspaces. Attributes: name, email, avatar.
- **Workspace**: A top-level organizational container. Attributes: name, description, owner. Contains: projects, members with roles.
- **WorkspaceMembership**: The join between a User and a Workspace. Attributes: role (Owner / Admin / Member).
- **Project**: A named collection of tasks within a workspace. Attributes: name, description, status (active / archived).
- **Task**: The core unit of work within a project. Attributes: title, description, status, due date, assignee, tags, commands, recurring flag, blocker references.
- **TaskBlocker**: A directed relationship between two tasks (blocker → blocked). Resolved when the blocking task reaches "Done."
- **RecurringSeries**: The configuration template for recurring tasks. Attributes: cadence (weekly), base fields (title, description, assignee, tags, commands).
- **Comment**: A user-authored text entry attached to a task. Attributes: author, content, timestamp.
- **ActivityEvent**: A system-generated immutable record of a field change. Attributes: actor, field, old value, new value, timestamp.
- **Tag**: A freeform label applied to tasks for categorization. Scoped to the workspace.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a workspace, add a team member, create a project, and add a task — completing the full onboarding flow — in under 3 minutes.
- **SC-002**: Users can move a task between Kanban columns and see the updated board state without a full page reload.
- **SC-003**: Filtering tasks by any combination of status, assignee, and tags returns results within 1 second for projects with up to 1,000 tasks.
- **SC-004**: When a recurring task is marked complete, the next instance appears on the board within 5 seconds without any user action.
- **SC-005**: The activity log captures 100% of field changes on a task — no change goes unrecorded.
- **SC-006**: Natural language quick add correctly parses assignee and due date from at least 85% of well-formed natural language inputs in acceptance testing.
- **SC-007**: Blocked tasks are prevented from moving to "In Progress" in 100% of cases where a blocker is incomplete.
- **SC-008**: The platform supports at least 50 concurrent users per workspace without visible performance degradation.

---

## Assumptions

- Users must be registered and authenticated to access any workspace data; public/anonymous access is out of scope.
- The "commands" field on a task is a freeform list of action links or short text entries (e.g., links to external resources, runbook steps); its exact schema will be refined during planning.
- The Kanban board statuses are fixed at four columns for v1: **To Do**, **In Progress**, **In Review**, **Done**. Custom statuses are out of scope.
- Recurring tasks repeat on a **weekly** cadence only for v1; monthly, daily, or custom cadences are out of scope.
- The natural language parser will resolve assignee names against workspace members by name match; fuzzy matching is assumed for similar names.
- The natural language parser will interpret relative date expressions (e.g., "Friday," "next week," "tomorrow") relative to the server's current UTC date at the time of the request.
- Email notification for task assignments, comments, and due-date reminders is out of scope for v1 but the activity log must support it in a future phase.
- Mobile-native apps are out of scope; the web app should be responsive but is primarily designed for desktop browsers.
- All timestamps are stored and displayed in UTC; timezone localization is out of scope for v1.
- A single user can be removed from a workspace by an owner/admin; their previously assigned tasks remain assigned to them but are flagged for reassignment.

"""Integration tests for Task management, Kanban boards, and tag association."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_task_lifecycle_and_board_view(client: AsyncClient) -> None:
    """Test creating tasks, listing board columns, updating status, and deleting."""
    # 1. Register user
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "tasklead@example.com",
            "name": "Task Lead",
            "password": "password123",
        },
    )
    assert reg_res.status_code == 201
    user_id = reg_res.json()["id"]

    # 2. Login
    login_res = await client.post(
        "/api/v1/auth/token",
        data={
            "username": "tasklead@example.com",
            "password": "password123",
        },
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Create Workspace
    ws_res = await client.post(
        "/api/v1/workspaces",
        json={"name": "Engineering Workspace"},
        headers=headers,
    )
    assert ws_res.status_code == 201
    workspace_id = ws_res.json()["id"]

    # 4. Create Project
    proj_res = await client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        json={"name": "Sprint 42"},
        headers=headers,
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    # 5. Create Tag
    tag_res = await client.post(
        f"/api/v1/workspaces/{workspace_id}/tags",
        json={"name": "Backend", "color": "#6366f1"},
        headers=headers,
    )
    assert tag_res.status_code == 201
    tag_id = tag_res.json()["id"]

    # 6. Create Task 1 (TODO)
    task1_res = await client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={
            "title": "Design Database Schema",
            "description": "SQLAlchemy 2.0 models and Alembic",
            "status": "TODO",
            "assignee_id": user_id,
            "tag_ids": [tag_id],
        },
        headers=headers,
    )
    assert task1_res.status_code == 201
    task1 = task1_res.json()
    assert task1["title"] == "Design Database Schema"
    assert task1["status"] == "TODO"
    assert len(task1["tags"]) == 1
    assert task1["tags"][0]["name"] == "Backend"
    task1_id = task1["id"]

    # 7. Create Task 2 (IN_PROGRESS)
    task2_res = await client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={
            "title": "Implement Auth Endpoints",
            "status": "IN_PROGRESS",
        },
        headers=headers,
    )
    assert task2_res.status_code == 201
    task2_id = task2_res.json()["id"]

    # 8. Fetch Kanban Board View
    board_res = await client.get(
        f"/api/v1/projects/{project_id}/tasks?view=board",
        headers=headers,
    )
    assert board_res.status_code == 200
    board = board_res.json()["columns"]
    assert len(board["TODO"]) == 1
    assert board["TODO"][0]["id"] == task1_id
    assert len(board["IN_PROGRESS"]) == 1
    assert board["IN_PROGRESS"][0]["id"] == task2_id
    assert len(board["IN_REVIEW"]) == 0
    assert len(board["DONE"]) == 0

    # 9. Update Task 1 Status to DONE
    patch_res = await client.patch(
        f"/api/v1/tasks/{task1_id}",
        json={"status": "DONE"},
        headers=headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "DONE"

    # 10. Verify Board View Reflects Update
    board_res2 = await client.get(
        f"/api/v1/projects/{project_id}/tasks?view=board",
        headers=headers,
    )
    assert board_res2.status_code == 200
    board2 = board_res2.json()["columns"]
    assert len(board2["TODO"]) == 0
    assert len(board2["DONE"]) == 1
    assert board2["DONE"][0]["id"] == task1_id

    # 11. Delete Task 2
    del_res = await client.delete(f"/api/v1/tasks/{task2_id}", headers=headers)
    assert del_res.status_code == 204

"""Integration tests for User Story 1: Workspaces, Memberships, Roles, and Projects."""

from __future__ import annotations

from httpx import AsyncClient
import pytest


async def _get_auth_headers(client: AsyncClient, email: str, name: str) -> dict[str, str]:
    """Helper to register and login a user, returning Authorization header."""
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "name": name, "password": "Password123!"},
    )
    login_res = await client.post(
        "/api/v1/auth/token",
        data={"username": email, "password": "Password123!"},
    )
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_workspace_and_project_lifecycle(client: AsyncClient) -> None:
    """Test full workspace creation, member invitation, role verification, and project creation."""
    owner_headers = await _get_auth_headers(client, "owner@example.com", "Workspace Owner")
    admin_headers = await _get_auth_headers(client, "admin@example.com", "Admin User")
    member_headers = await _get_auth_headers(client, "member@example.com", "Member User")

    ws_res = await client.post(
        "/api/v1/workspaces",
        headers=owner_headers,
        json={"name": "Engineering Team", "description": "Core engineering workspace"},
    )
    assert ws_res.status_code == 201
    ws_data = ws_res.json()
    ws_id = ws_data["id"]
    assert ws_data["name"] == "Engineering Team"

    invite_admin_res = await client.post(
        f"/api/v1/workspaces/{ws_id}/invites",
        headers=owner_headers,
        json={"email": "admin@example.com", "role": "ADMIN"},
    )
    assert invite_admin_res.status_code == 201
    admin_user_id = invite_admin_res.json()["user_id"]

    invite_member_res = await client.post(
        f"/api/v1/workspaces/{ws_id}/invites",
        headers=owner_headers,
        json={"email": "member@example.com", "role": "MEMBER"},
    )
    assert invite_member_res.status_code == 201
    member_user_id = invite_member_res.json()["user_id"]

    members_res = await client.get(f"/api/v1/workspaces/{ws_id}/members", headers=owner_headers)
    assert members_res.status_code == 200
    members = members_res.json()
    assert len(members) == 3

    unauthorized_role_change = await client.patch(
        f"/api/v1/workspaces/{ws_id}/members/{admin_user_id}",
        headers=member_headers,
        json={"role": "MEMBER"},
    )
    assert unauthorized_role_change.status_code == 403

    project_res = await client.post(
        f"/api/v1/workspaces/{ws_id}/projects",
        headers=admin_headers,
        json={"name": "Core Platform v2", "description": "Next gen architecture"},
    )
    assert project_res.status_code == 201
    project_data = project_res.json()
    assert project_data["name"] == "Core Platform v2"
    project_id = project_data["id"]

    list_proj_res = await client.get(
        f"/api/v1/workspaces/{ws_id}/projects",
        headers=member_headers,
    )
    assert list_proj_res.status_code == 200
    assert len(list_proj_res.json()) == 1

    archive_res = await client.patch(
        f"/api/v1/workspaces/{ws_id}/projects/{project_id}",
        headers=admin_headers,
        json={"status": "ARCHIVED"},
    )
    assert archive_res.status_code == 200
    assert archive_res.json()["status"] == "ARCHIVED"

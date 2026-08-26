"""Integration tests for user registration, login, and auth token operations."""

from __future__ import annotations

from httpx import AsyncClient
import pytest


@pytest.mark.asyncio
async def test_register_and_login_flow(client: AsyncClient) -> None:
    """Test full user lifecycle: register, login, profile fetch, logout."""
    reg_payload = {
        "email": "anusha@example.com",
        "name": "Anusha",
        "password": "SecurePassword123!",
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    user_data = reg_res.json()
    assert user_data["email"] == "anusha@example.com"
    assert user_data["name"] == "Anusha"

    login_res = await client.post(
        "/api/v1/auth/token",
        data={
            "username": "anusha@example.com",
            "password": "SecurePassword123!",
        },
    )
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    access_token = token_data["access_token"]
    assert "refresh_token" in login_res.cookies

    me_res = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "anusha@example.com"


@pytest.mark.asyncio
async def test_duplicate_registration_rejected(client: AsyncClient) -> None:
    """Test registering an existing email returns 400 error."""
    payload = {
        "email": "duplicate@example.com",
        "name": "First User",
        "password": "Password123!",
    }
    res1 = await client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = await client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 400

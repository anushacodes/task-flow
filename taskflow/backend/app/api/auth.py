"""Authentication API router."""

from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.engine import get_db
from app.models.user import User
from app.schemas.auth import TokenResponse, UserRegisterRequest, UserResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, raw_refresh_token: str, max_age: int) -> None:
    """Set hardened httpOnly refresh token cookie on response."""
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh_token,
        max_age=max_age,
        httponly=True,
        secure=False,
        samesite="lax",
        path="/api/v1/auth",
    )


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user account",
)
async def register(
    req: UserRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Create a new user account with validated credentials."""
    return await auth_service.register_user(db, req)


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Login to obtain access token and refresh cookie",
)
async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate credentials and issue JWT access token plus httpOnly refresh cookie."""
    access_token, raw_refresh, expires_in = await auth_service.login_user(
        db=db,
        email=form_data.username,
        password=form_data.password,
    )
    _set_refresh_cookie(response, raw_refresh, max_age=7 * 24 * 3600)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Exchange refresh token cookie for a new access token",
)
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias="refresh_token"),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Rotate refresh token and issue a fresh access token."""
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token cookie missing",
        )

    access_token, new_raw_refresh, expires_in = await auth_service.refresh_tokens(
        db=db,
        raw_refresh_token=refresh_token,
    )
    _set_refresh_cookie(response, new_raw_refresh, max_age=7 * 24 * 3600)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke refresh token and clear cookie",
)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias="refresh_token"),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Invalidate current refresh session and clear cookie."""
    if refresh_token:
        await auth_service.logout(db, refresh_token)
    response.delete_cookie(key="refresh_token", path="/api/v1/auth")


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get profile of authenticated user",
)
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    """Return currently authenticated user profile."""
    return current_user

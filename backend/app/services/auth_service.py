"""Authentication business logic service."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.token import RefreshToken
from app.models.user import User
from app.schemas.auth import UserRegisterRequest


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Retrieve user entity by email address."""
    stmt = select(User).where(User.email == email.lower().strip())
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    """Retrieve user entity by primary key."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def register_user(db: AsyncSession, req: UserRegisterRequest) -> User:
    """Register a new user account with hashed password."""
    normalized_email = req.email.lower().strip()
    existing = await get_user_by_email(db, normalized_email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

    user = User(
        email=normalized_email,
        name=req.name.strip(),
        password_hash=hash_password(req.password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def login_user(
    db: AsyncSession,
    email: str,
    password: str,
) -> tuple[str, str, int]:
    """Authenticate credentials and issue access + refresh tokens."""
    user = await get_user_by_email(db, email)
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})

    raw_refresh = generate_refresh_token()
    family_id = uuid.uuid4()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    token_record = RefreshToken(
        token_hash=hash_token(raw_refresh),
        user_id=user.id,
        family_id=family_id,
        expires_at=expires_at,
        revoked=False,
    )
    db.add(token_record)
    await db.flush()

    return access_token, raw_refresh, expires_in


async def refresh_tokens(
    db: AsyncSession,
    raw_refresh_token: str,
) -> tuple[str, str, int]:
    """Validate refresh token, rotate it, and return new access + refresh tokens."""
    token_h = hash_token(raw_refresh_token)
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_h)
    result = await db.execute(stmt)
    token_record = result.scalar_one_or_none()

    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    if token_record.revoked:
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == token_record.family_id)
            .values(revoked=True)
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Revoked refresh token reuse detected; session invalidated",
        )

    if token_record.expires_at < datetime.now(timezone.utc):
        token_record.revoked = True
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired",
        )

    token_record.revoked = True

    user = await get_user_by_id(db, token_record.user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    new_access_token = create_access_token(data={"sub": str(user.id), "email": user.email})

    new_raw_refresh = generate_refresh_token()
    new_expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    new_token_record = RefreshToken(
        token_hash=hash_token(new_raw_refresh),
        user_id=user.id,
        family_id=token_record.family_id,
        expires_at=new_expires_at,
        revoked=False,
    )
    db.add(new_token_record)
    await db.flush()

    return new_access_token, new_raw_refresh, expires_in


async def logout(db: AsyncSession, raw_refresh_token: str | None) -> None:
    """Revoke refresh token on user logout."""
    if not raw_refresh_token:
        return

    token_h = hash_token(raw_refresh_token)
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_h)
    result = await db.execute(stmt)
    token_record = result.scalar_one_or_none()
    if token_record:
        token_record.revoked = True
        await db.flush()

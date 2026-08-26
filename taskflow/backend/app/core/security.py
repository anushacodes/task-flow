"""Security utilities for password hashing and JWT management."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Any

import jwt
from pwdlib import PasswordHash

from app.core.config import settings

_pwd_hash = PasswordHash.recommended()
ALGORITHM = "HS256"


def hash_password(plain: str) -> str:
    """Hash plain text password with Argon2id."""
    return _pwd_hash.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify plain password against hashed password."""
    return _pwd_hash.verify(plain, hashed)


def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decode and validate a JWT access token."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None


def generate_refresh_token() -> str:
    """Generate a secure opaque refresh token."""
    return secrets.token_hex(32)


def hash_token(raw_token: str) -> str:
    """Compute SHA-256 hash of an opaque token for DB storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

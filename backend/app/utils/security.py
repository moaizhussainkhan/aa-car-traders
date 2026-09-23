"""
Password hashing + JWT issuing/verification helpers.

Password hashing note
---------------------
bcrypt only looks at the first 72 BYTES of a password (and newer bcrypt
releases raise an error instead of silently truncating). To support
passwords of any length we first reduce the password to a fixed-size
SHA-256 digest (base64, 44 chars) and bcrypt that. New hashes are stored
with a "sha256$" prefix; old plain-bcrypt hashes ("$2b$...") that already
exist in the DB still verify, so no existing account breaks.
"""
import base64
import hashlib
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import jwt, JWTError

from app.config import settings

_PREFIX = "sha256$"


def _prehash(password: str) -> bytes:
    digest = hashlib.sha256(password.encode("utf-8")).digest()
    return base64.b64encode(digest)  # always 44 bytes -> well under bcrypt's 72-byte limit


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(_prehash(password), bcrypt.gensalt())
    return _PREFIX + hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        if hashed.startswith(_PREFIX):
            return bcrypt.checkpw(_prehash(plain), hashed[len(_PREFIX):].encode("utf-8"))
        # Legacy hash (created before the fix): raw bcrypt, 72-byte limit.
        return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(data: dict, expires_minutes: Optional[int] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(
        minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None

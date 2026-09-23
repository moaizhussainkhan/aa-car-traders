"""
Reusable FastAPI dependencies: current-user extraction + strict RBAC guards.
"""
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRole
from app.utils.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Returns the logged-in user, or None for anonymous/guest requests."""
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user or not user.is_active:
        return None
    return user


def can_see_wholesale(user: Optional[User]) -> bool:
    """Admin, or a reseller the admin has approved."""
    if not user:
        return False
    if user.is_admin:
        return True
    return user.role == UserRole.RESELLER and user.is_approved


def require_user(user: Optional[User] = Depends(get_current_user)) -> User:
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required")
    return user


def require_admin(user: User = Depends(require_user)) -> User:
    """
    Hard gate used on every product/category/settings write route.
    Only the single is_admin=True account may pass.
    """
    if not user.is_admin or user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the AA Car Traders admin can perform this action.",
        )
    return user


def require_reseller_or_admin(user: User = Depends(require_user)) -> User:
    if not can_see_wholesale(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An approved reseller account is required.",
        )
    return user

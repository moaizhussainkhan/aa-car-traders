"""
Auth routes.

- /api/auth/login        customers + resellers (the admin account is rejected here)
- /api/auth/admin-login  the ONE admin account only (used by the hidden /admin/login page)
- /api/auth/register     customer or reseller — never admin
- /api/auth/me, /api/auth/change-password

The single admin account is seeded at startup (see app/main.py) and can never be
created or promoted through this API.
"""
import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_user
from app.models import User, UserRole
from app.schemas import ChangePasswordRequest, LoginRequest, Token, UserCreate, UserOut
from app.utils.activity import log_activity
from app.utils.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

# --- tiny in-memory brute-force guard: 8 failed attempts / 10 min per (ip, email) ---
_FAILS: dict[str, list[float]] = defaultdict(list)
_WINDOW, _MAX_FAILS = 600, 8


def _key(request: Request, email: str) -> str:
    ip = request.client.host if request.client else "?"
    return f"{ip}|{email.lower()}"


def _check_not_locked(key: str) -> None:
    now = time.time()
    _FAILS[key] = [t for t in _FAILS[key] if now - t < _WINDOW]
    if len(_FAILS[key]) >= _MAX_FAILS:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please wait 10 minutes and try again.")


def _fail(key: str) -> None:
    _FAILS[key].append(time.time())
    raise HTTPException(status_code=401, detail="Invalid email or password")


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    email = payload.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Strict RBAC: the public register endpoint can only ever create
    # RESELLER or CUSTOMER accounts. Admin is single, seeded, never self-served.
    role = payload.role if payload.role in (UserRole.RESELLER, UserRole.CUSTOMER) else UserRole.CUSTOMER

    user = User(
        name=payload.name,
        email=email,
        hashed_password=hash_password(payload.password),
        role=role,
        is_admin=False,
        is_approved=(role != UserRole.RESELLER),  # resellers wait for admin approval
        phone=payload.phone,
        business_name=payload.business_name,
    )
    db.add(user)
    log_activity(db, "user_registered", f"New {role.value} registered: {payload.name}", "System")
    db.commit()
    db.refresh(user)
    return user


def _issue(user: User) -> Token:
    token = create_access_token({"sub": user.id, "role": user.role.value, "is_admin": user.is_admin})
    return Token(access_token=token, user=user)


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    email = payload.email.lower()
    key = _key(request, email)
    _check_not_locked(key)
    user = db.query(User).filter(User.email == email).first()
    # The admin signs in only through /api/auth/admin-login (hidden admin page).
    if not user or user.is_admin or not verify_password(payload.password, user.hashed_password):
        _fail(key)
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    return _issue(user)


@router.post("/admin-login", response_model=Token)
def admin_login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    email = payload.email.lower()
    key = _key(request, email)
    _check_not_locked(key)
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_admin or not verify_password(payload.password, user.hashed_password):
        _fail(key)
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    return _issue(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(require_user)):
    return user


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, db: Session = Depends(get_db), user: User = Depends(require_user)):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"ok": True}

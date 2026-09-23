"""
Reset the admin login from your .env file.

The admin account is created ONCE (first startup). If you later change ADMIN_EMAIL /
ADMIN_PASSWORD in .env, run this to apply them to the existing account:

    python reset_admin.py
"""
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.migrate import ensure_columns
from app.models import User, UserRole
from app.utils.security import hash_password

Base.metadata.create_all(bind=engine)
ensure_columns()
db = SessionLocal()
try:
    email = settings.ADMIN_EMAIL.lower()
    admin = db.query(User).filter(User.is_admin == True).first()  # noqa: E712
    if admin:
        admin.email = email
        admin.name = settings.ADMIN_NAME
        admin.hashed_password = hash_password(settings.ADMIN_PASSWORD)
        admin.is_active = True
        action = "updated"
    else:
        db.add(User(name=settings.ADMIN_NAME, email=email, hashed_password=hash_password(settings.ADMIN_PASSWORD),
                    role=UserRole.ADMIN, is_admin=True))
        action = "created"
    db.commit()
    print(f"Admin account {action}: {email}  (password taken from ADMIN_PASSWORD in .env)")
finally:
    db.close()

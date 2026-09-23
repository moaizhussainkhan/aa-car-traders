"""
Tiny additive migration helper.

`Base.metadata.create_all()` creates missing TABLES but never adds new COLUMNS to
tables that already exist. So if you already have an aa_car_traders.db from an
older version, we add the new columns here instead of forcing you to delete the DB.
"""
from sqlalchemy import inspect, text

from app.database import engine


def ensure_columns() -> None:
    is_pg = engine.dialect.name == "postgresql"
    true_lit = "TRUE" if is_pg else "1"
    wanted = {
        "products": [
            ("whatsapp_number", "VARCHAR(20)"),
            ("whatsapp_message", "VARCHAR(255)"),
        ],
        "users": [
            ("is_approved", f"BOOLEAN NOT NULL DEFAULT {true_lit}"),
        ],
        "orders": [
            ("courier_tracking_number", "VARCHAR(60)"),
            ("courier_status", "VARCHAR(60)"),
            ("courier_booked_at", "TIMESTAMP" if is_pg else "DATETIME"),
        ],
    }
    insp = inspect(engine)
    with engine.begin() as conn:
        for table, cols in wanted.items():
            if not insp.has_table(table):
                continue
            existing = {c["name"] for c in insp.get_columns(table)}
            for name, ddl in cols:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))

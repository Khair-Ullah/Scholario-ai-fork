"""Copy data from the legacy SQLite database into PostgreSQL.

Run this once after PostgreSQL has been created and migrated:

    docker compose exec backend python -m scripts.migrate_sqlite_to_postgres

Override ``SOURCE_DATABASE_URL`` to point at a different SQLite file. The
target is always ``DATABASE_URL`` and must use a PostgreSQL driver.
"""

import os
from typing import Any

from sqlalchemy import create_engine, inspect, select, text

import app.models  # noqa: F401  (registers every model on Base.metadata)
from app.db.base import Base


def main() -> None:
    source_url = os.getenv("SOURCE_DATABASE_URL", "sqlite:////data/scholario_backup.db")
    target_url = os.getenv("DATABASE_URL", "")
    if not target_url.startswith(("postgresql", "postgres")):
        raise SystemExit("DATABASE_URL must point to PostgreSQL")

    source = create_engine(source_url)
    target = create_engine(target_url)
    inspector = inspect(source)

    available = set(inspector.get_table_names())
    all_tables = list(Base.metadata.sorted_tables)
    tables = [table for table in all_tables if table.name in available]
    missing = sorted(table.name for table in all_tables if table.name not in available)
    if missing:
        print(f"Skipping tables missing from the source database: {', '.join(missing)}")

    names = ", ".join(f'"{table.name}"' for table in reversed(tables))
    if names:
        with target.begin() as connection:
            connection.execute(text(f"TRUNCATE TABLE {names} RESTART IDENTITY CASCADE"))

    copied: dict[str, int] = {}
    with source.connect() as source_connection, target.begin() as target_connection:
        for table in tables:
            source_columns = {column["name"] for column in inspector.get_columns(table.name)}
            columns = [column for column in table.c if column.name in source_columns]
            if not columns:
                copied[table.name] = 0
                continue
            rows: list[dict[str, Any]] = [
                dict(row) for row in source_connection.execute(select(*columns)).mappings()
            ]
            if rows:
                target_connection.execute(table.insert(), rows)
            copied[table.name] = len(rows)

        for table in tables:
            if "id" not in table.c:
                continue
            target_connection.execute(
                text(
                    f"SELECT setval(pg_get_serial_sequence('{table.name}', 'id'), "
                    f"COALESCE((SELECT MAX(id) FROM \"{table.name}\"), 1), "
                    f"EXISTS (SELECT 1 FROM \"{table.name}\"))"
                )
            )

    total = sum(copied.values())
    for name, count in copied.items():
        print(f"{name}: {count} rows")
    print(f"Copied {total} rows from {source_url} to PostgreSQL")


if __name__ == "__main__":
    main()

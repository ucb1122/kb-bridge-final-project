"""SQLite connection and schema initialization; ingestion is a separate workflow."""

from contextlib import closing
from pathlib import Path
import sqlite3


SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def connect_database(db_path: Path) -> sqlite3.Connection:
    """Return a connection with FK checks enabled; caller must close it."""
    connection = sqlite3.connect(db_path)
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect_database(db_path)) as connection:
        with connection:
            connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))

import sqlite3
from contextlib import closing
from pathlib import Path

SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


def init_db(path: Path) -> None:
    """Creates the database from scratch, discarding any data from a previous run."""
    path.parent.mkdir(parents=True, exist_ok=True)
    for leftover in (path, path.with_name(path.name + "-wal"), path.with_name(path.name + "-shm")):
        leftover.unlink(missing_ok=True)
    with closing(connect(path)) as conn:
        conn.executescript(SCHEMA)


def connect(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

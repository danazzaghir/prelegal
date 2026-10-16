import sqlite3
from contextlib import closing

import pytest

from prelegal_backend.database import connect, init_db


def columns(path, table):
    with closing(connect(path)) as conn:
        return {row["name"]: row for row in conn.execute(f"PRAGMA table_info({table})")}


def test_creates_the_file_and_parent_directory(tmp_path):
    path = tmp_path / "nested" / "dir" / "prelegal.db"
    init_db(path)
    assert path.is_file()


def test_creates_a_users_table_for_sign_up_and_sign_in(tmp_path):
    path = tmp_path / "prelegal.db"
    init_db(path)
    cols = columns(path, "users")
    assert set(cols) == {"id", "email", "password_hash", "name", "created_at"}
    assert cols["id"]["pk"] == 1
    assert cols["email"]["notnull"] == 1
    assert cols["password_hash"]["notnull"] == 1


def test_starts_empty(tmp_path):
    path = tmp_path / "prelegal.db"
    init_db(path)
    with closing(connect(path)) as conn:
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0


def test_recreates_the_database_from_scratch(tmp_path):
    path = tmp_path / "prelegal.db"
    init_db(path)
    with closing(connect(path)) as conn, conn:
        conn.execute("INSERT INTO users (email, password_hash) VALUES ('a@example.com', 'x')")
        conn.execute("CREATE TABLE leftover (id INTEGER)")

    init_db(path)

    with closing(connect(path)) as conn:
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert "leftover" not in tables


def test_replaces_a_file_that_is_not_a_database(tmp_path):
    path = tmp_path / "prelegal.db"
    path.write_text("not a database")
    init_db(path)
    with closing(connect(path)) as conn:
        conn.execute("SELECT COUNT(*) FROM users")


def test_emails_are_unique_ignoring_case(tmp_path):
    path = tmp_path / "prelegal.db"
    init_db(path)
    with closing(connect(path)) as conn:
        conn.execute("INSERT INTO users (email, password_hash) VALUES ('Ada@Example.com', 'x')")
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO users (email, password_hash) VALUES ('ada@example.com', 'y')")


def test_sets_created_at_automatically(tmp_path):
    path = tmp_path / "prelegal.db"
    init_db(path)
    with closing(connect(path)) as conn:
        conn.execute("INSERT INTO users (email, password_hash) VALUES ('a@example.com', 'x')")
        row = conn.execute("SELECT created_at FROM users").fetchone()
    assert row["created_at"]

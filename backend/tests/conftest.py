from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from prelegal_backend.config import Settings
from prelegal_backend.main import create_app


@pytest.fixture
def static_dir(tmp_path: Path) -> Path:
    """A stand-in for the exported frontend, laid out like `next build` output."""
    out = tmp_path / "out"
    (out / "documents").mkdir(parents=True)
    (out / "_next").mkdir()
    (out / "index.html").write_text("<h1>login page</h1>")
    (out / "documents" / "index.html").write_text("<h1>documents page</h1>")
    (out / "404.html").write_text("<h1>not found page</h1>")
    (out / "_next" / "app.js").write_text("console.log('app')")
    return out


@pytest.fixture
def settings(tmp_path: Path, static_dir: Path) -> Settings:
    return Settings(database_path=tmp_path / "data" / "prelegal.db", static_dir=static_dir)


@pytest.fixture
def client(settings: Settings):
    with TestClient(create_app(settings)) as c:
        yield c

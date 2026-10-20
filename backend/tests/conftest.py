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
    (out / "documents" / "__next.documents").mkdir()
    (out / "documents" / "__next.documents" / "__PAGE__.txt").write_text("documents page data")
    (out / "404.html").write_text("<h1>not found page</h1>")
    (out / "_next" / "app.js").write_text("console.log('app')")
    return out


@pytest.fixture
def settings(tmp_path: Path, static_dir: Path) -> Settings:
    return Settings(database_path=tmp_path / "data" / "prelegal.db", static_dir=static_dir)


@pytest.fixture
def anon_client(settings: Settings):
    """A client that hasn't signed in."""
    with TestClient(create_app(settings)) as c:
        yield c


def sign_up(client: TestClient, email: str = "ada@example.com", name: str = "Ada Lovelace", password: str = "correct horse"):
    response = client.post("/api/auth/signup", json={"name": name, "email": email, "password": password})
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def client(anon_client: TestClient):
    """A client signed in as a new user, Ada."""
    sign_up(anon_client)
    return anon_client

import os
from contextlib import closing

from fastapi.testclient import TestClient

from prelegal_backend.config import Settings
from prelegal_backend.database import connect
from prelegal_backend.main import create_app


def test_health_reports_the_api_and_database_are_up(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_startup_creates_a_fresh_database(settings):
    settings.database_path.parent.mkdir(parents=True)
    settings.database_path.write_text("stale data from a previous run")

    with TestClient(create_app(settings)):
        with closing(connect(settings.database_path)) as conn:
            assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0


def test_each_startup_discards_previous_users(settings):
    with TestClient(create_app(settings)):
        with closing(connect(settings.database_path)) as conn, conn:
            conn.execute("INSERT INTO users (email, password_hash) VALUES ('a@example.com', 'x')")

    with TestClient(create_app(settings)):
        with closing(connect(settings.database_path)) as conn:
            assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0


def test_serves_the_login_page_at_the_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "login page" in response.text
    assert response.headers["content-type"].startswith("text/html")


def test_serves_the_nda_page(client):
    response = client.get("/nda/")
    assert response.status_code == 200
    assert "nda page" in response.text


def test_redirects_to_add_the_trailing_slash(client):
    response = client.get("/nda", follow_redirects=False)
    assert response.status_code in (301, 307)
    assert response.headers["location"].endswith("/nda/")


def test_serves_static_assets(client):
    response = client.get("/_next/app.js")
    assert response.status_code == 200
    assert "javascript" in response.headers["content-type"]


def test_unknown_pages_get_the_frontend_404_page(client):
    response = client.get("/no-such-page/")
    assert response.status_code == 404
    assert "not found page" in response.text


def test_unknown_api_routes_are_json_404s(client):
    response = client.get("/api/no-such-route")
    assert response.status_code == 404
    assert response.headers["content-type"] == "application/json"


def test_api_works_without_a_built_frontend(tmp_path):
    settings = Settings(database_path=tmp_path / "prelegal.db", static_dir=tmp_path / "missing")
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/").status_code == 404


def test_settings_read_the_environment(monkeypatch, tmp_path):
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "x.db"))
    monkeypatch.setenv("STATIC_DIR", str(tmp_path / "static"))
    monkeypatch.setenv("HOST", "0.0.0.0")
    monkeypatch.setenv("PORT", "9000")
    settings = Settings.from_env()
    assert settings.database_path == tmp_path / "x.db"
    assert settings.static_dir == tmp_path / "static"
    assert (settings.host, settings.port) == ("0.0.0.0", 9000)


def test_settings_default_to_the_repo_layout(monkeypatch):
    for name in ("DATABASE_PATH", "STATIC_DIR", "HOST", "PORT"):
        monkeypatch.delenv(name, raising=False)
    settings = Settings.from_env()
    assert settings.database_path.parts[-3:] == ("backend", "data", "prelegal.db")
    assert settings.static_dir.parts[-2:] == ("frontend", "out")
    assert (settings.host, settings.port) == ("127.0.0.1", 8000)


def test_unknown_api_routes_are_404s_for_every_method(client):
    for method in ("POST", "PUT", "PATCH", "DELETE"):
        response = client.request(method, "/api/no-such-route")
        assert response.status_code == 404, method
        assert response.json() == {"detail": "Not Found"}


def test_settings_load_secrets_from_the_repo_env_file(monkeypatch, tmp_path):
    from prelegal_backend import config

    (tmp_path / ".env").write_text("OPENROUTER_API_KEY=from-dotenv\n")
    monkeypatch.setattr(config, "REPO_DIR", tmp_path)
    # setenv first so monkeypatch restores the original state after the test.
    monkeypatch.setenv("OPENROUTER_API_KEY", "")
    monkeypatch.delenv("OPENROUTER_API_KEY")
    Settings.from_env()
    assert os.environ["OPENROUTER_API_KEY"] == "from-dotenv"


def test_settings_do_not_override_real_environment_variables(monkeypatch, tmp_path):
    from prelegal_backend import config

    (tmp_path / ".env").write_text("OPENROUTER_API_KEY=from-dotenv\n")
    monkeypatch.setattr(config, "REPO_DIR", tmp_path)
    monkeypatch.setenv("OPENROUTER_API_KEY", "from-environment")
    Settings.from_env()
    assert os.environ["OPENROUTER_API_KEY"] == "from-environment"
from contextlib import closing

import pytest
from fastapi.testclient import TestClient

from prelegal_backend.auth import COOKIE, hash_password, verify_password
from prelegal_backend.database import connect
from prelegal_backend.main import create_app

from .conftest import sign_up

ADA = {"name": "Ada Lovelace", "email": "ada@example.com", "password": "correct horse"}


def test_sign_up_creates_the_account_and_signs_in(anon_client):
    response = anon_client.post("/api/auth/signup", json=ADA)
    assert response.status_code == 201
    assert response.json() == {"id": 1, "name": "Ada Lovelace", "email": "ada@example.com"}
    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"{COOKIE}=")
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/" in cookie
    assert anon_client.get("/api/auth/me").json()["email"] == "ada@example.com"


def test_passwords_are_stored_hashed(anon_client, settings):
    anon_client.post("/api/auth/signup", json=ADA)
    with closing(connect(settings.database_path)) as conn:
        stored = conn.execute("SELECT password_hash FROM users").fetchone()[0]
    assert "correct horse" not in stored
    assert stored.startswith("scrypt$")


def test_an_email_can_only_sign_up_once_in_any_case(anon_client):
    anon_client.post("/api/auth/signup", json=ADA)
    response = anon_client.post("/api/auth/signup", json={**ADA, "email": "ADA@example.com"})
    assert response.status_code == 409
    assert response.json()["detail"] == "An account with this email already exists. Sign in instead."


@pytest.mark.parametrize(
    "body",
    [
        {**ADA, "password": "short"},
        {**ADA, "email": "not-an-email"},
        {**ADA, "name": ""},
        {**ADA, "name": "   "},
        {"email": "ada@example.com", "password": "correct horse"},
    ],
)
def test_sign_up_rejects_invalid_details(anon_client, body):
    assert anon_client.post("/api/auth/signup", json=body).status_code == 422


def test_sign_in_with_the_right_password(settings):
    with TestClient(create_app(settings)) as first:
        sign_up(first)
        first.post("/api/auth/signout")
        response = first.post("/api/auth/signin", json={"email": "Ada@Example.com", "password": "correct horse"})
        assert response.status_code == 200
        assert response.json() == {"id": 1, "name": "Ada Lovelace", "email": "ada@example.com"}
        assert first.get("/api/auth/me").status_code == 200


@pytest.mark.parametrize(
    ("email", "password"),
    [("ada@example.com", "wrong password"), ("nobody@example.com", "correct horse")],
)
def test_sign_in_rejects_a_wrong_email_or_password_with_the_same_message(anon_client, email, password):
    sign_up(anon_client)
    anon_client.post("/api/auth/signout")
    response = anon_client.post("/api/auth/signin", json={"email": email, "password": password})
    assert response.status_code == 401
    assert response.json() == {"detail": "Wrong email or password."}
    assert anon_client.get("/api/auth/me").status_code == 401


def test_sign_out_ends_the_session(client):
    token = client.cookies.get(COOKIE)
    response = client.post("/api/auth/signout")
    assert response.status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    # The old token no longer works even if the browser kept it.
    client.cookies.set(COOKIE, token)
    assert client.get("/api/auth/me").status_code == 401


def test_names_are_trimmed(anon_client):
    response = anon_client.post("/api/auth/signup", json={**ADA, "name": "  Ada Lovelace  "})
    assert response.json()["name"] == "Ada Lovelace"


def test_sessions_expire_after_30_days(client, settings):
    with closing(connect(settings.database_path)) as conn, conn:
        conn.execute("UPDATE sessions SET created_at = datetime('now', '-31 days')")
    assert client.get("/api/auth/me").status_code == 401


def test_me_needs_a_valid_session(anon_client):
    assert anon_client.get("/api/auth/me").json() == {"detail": "Please sign in."}
    anon_client.cookies.set(COOKIE, "made-up-token")
    assert anon_client.get("/api/auth/me").status_code == 401


def test_sessions_end_when_the_server_restarts(settings):
    with TestClient(create_app(settings)) as first:
        sign_up(first)
        token = first.cookies.get(COOKIE)
    with TestClient(create_app(settings)) as second:
        second.cookies.set(COOKIE, token)
        assert second.get("/api/auth/me").status_code == 401


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", "/api/chat"),
        ("GET", "/api/documents/CSA"),
        ("GET", "/api/agreements"),
        ("POST", "/api/agreements"),
        ("GET", "/api/agreements/1"),
        ("PUT", "/api/agreements/1"),
        ("DELETE", "/api/agreements/1"),
    ],
)
def test_the_api_requires_sign_in(anon_client, method, path):
    response = anon_client.request(method, path, json={})
    assert response.status_code == 401
    assert response.json() == {"detail": "Please sign in."}


def test_health_and_pages_work_without_signing_in(anon_client):
    assert anon_client.get("/api/health").status_code == 200
    assert anon_client.get("/").status_code == 200


def test_password_hashing_round_trip():
    stored = hash_password("correct horse")
    assert verify_password("correct horse", stored)
    assert not verify_password("Correct horse", stored)
    assert hash_password("correct horse") != stored  # salted
    assert not verify_password("x", "not-a-hash")


def test_concurrent_sign_ups_all_succeed(settings):
    # Requests run on several worker threads; each must get a working connection.
    from concurrent.futures import ThreadPoolExecutor

    with TestClient(create_app(settings)) as client:

        def sign_up_one(i: int) -> int:
            body = {"name": "User", "email": f"user{i}@example.com", "password": "correct horse"}
            return client.post("/api/auth/signup", json=body).status_code

        with ThreadPoolExecutor(max_workers=8) as pool:
            statuses = list(pool.map(sign_up_one, range(16)))
    assert statuses == [201] * 16

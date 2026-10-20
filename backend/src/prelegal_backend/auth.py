"""Sign up, sign in and sign out, with the session kept in an HttpOnly cookie."""

import hashlib
import hmac
import secrets
import sqlite3
from collections.abc import Iterator
from contextlib import closing
from dataclasses import dataclass

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from prelegal_backend.database import connect
from prelegal_backend.models import SignIn, SignUp, UserOut

COOKIE = "prelegal_session"
# Sessions also end when the server restarts, since the database is recreated.
SESSION_DAYS = 30

# scrypt settings (n=2^14, r=8, p=1 is the standard interactive-login choice).
SCRYPT_N, SCRYPT_R, SCRYPT_P = 2**14, 8, 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
    except ValueError:
        return False
    if scheme != "scrypt":
        return False
    candidate = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p))
    return hmac.compare_digest(candidate.hex(), digest)


# Checked even for unknown emails, so sign-in takes the same time either way.
DUMMY_HASH = hash_password(secrets.token_hex(16))


@dataclass(frozen=True)
class User:
    id: int
    name: str
    email: str

    def out(self) -> UserOut:
        return UserOut(id=self.id, name=self.name, email=self.email)


def get_db(request: Request) -> Iterator[sqlite3.Connection]:
    """A database connection for one request."""
    with closing(connect(request.app.state.settings.database_path)) as conn:
        yield conn


Db = Depends(get_db)


def current_user(request: Request, db: sqlite3.Connection = Db) -> User:
    """The signed-in user; a 401 for everyone else."""
    token = request.cookies.get(COOKIE)
    row = token and db.execute(
        "SELECT users.id, users.name, users.email FROM sessions JOIN users ON users.id = sessions.user_id "
        "WHERE sessions.token = ? AND sessions.created_at >= datetime('now', ?)",
        (token, f"-{SESSION_DAYS} days"),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Please sign in.")
    return User(id=row["id"], name=row["name"], email=row["email"])


SignedIn = Depends(current_user)


def start_session(db: sqlite3.Connection, response: Response, user_id: int) -> None:
    token = secrets.token_urlsafe(32)
    with db:
        db.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
    response.set_cookie(
        COOKIE, token, max_age=SESSION_DAYS * 24 * 3600, httponly=True, samesite="lax", path="/"
    )


router = APIRouter(prefix="/api/auth")


@router.post("/signup", response_model=UserOut, status_code=201)
def sign_up(body: SignUp, response: Response, db: sqlite3.Connection = Db) -> UserOut:
    try:
        with db:
            cursor = db.execute(
                "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
                (body.email, hash_password(body.password), body.name),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="An account with this email already exists. Sign in instead.")
    user = User(id=cursor.lastrowid, name=body.name, email=body.email)
    start_session(db, response, user.id)
    return user.out()


@router.post("/signin", response_model=UserOut)
def sign_in(body: SignIn, response: Response, db: sqlite3.Connection = Db) -> UserOut:
    row = db.execute("SELECT id, name, email, password_hash FROM users WHERE email = ?", (body.email,)).fetchone()
    password_ok = verify_password(body.password, row["password_hash"] if row else DUMMY_HASH)
    if row is None or not password_ok:
        raise HTTPException(status_code=401, detail="Wrong email or password.")
    start_session(db, response, row["id"])
    return User(id=row["id"], name=row["name"], email=row["email"]).out()


@router.post("/signout", status_code=204)
def sign_out(request: Request, response: Response, db: sqlite3.Connection = Db) -> None:
    token = request.cookies.get(COOKIE)
    if token:
        with db:
            db.execute("DELETE FROM sessions WHERE token = ?", (token,))
    response.delete_cookie(COOKIE, path="/")


@router.get("/me", response_model=UserOut)
def me(user: User = SignedIn) -> UserOut:
    return user.out()

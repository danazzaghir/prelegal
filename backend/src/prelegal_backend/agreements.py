"""Each user's saved agreements: the chat draft and conversation, saved as they go."""

import json
import sqlite3

from fastapi import APIRouter, HTTPException, Request

from prelegal_backend.auth import Db, SignedIn, User
from prelegal_backend.documents import Document
from prelegal_backend.models import AgreementIn, AgreementOut, AgreementSummary, Draft

UNTITLED = "Untitled agreement"


def agreement_title(draft: Draft, documents: dict[str, Document]) -> str:
    """E.g. "Cloud Service Agreement · Acme Inc & Globex LLC"."""
    doc = documents.get(draft.document_id or "")
    name = doc.name if doc else UNTITLED
    companies = [p.company.strip() for p in (draft.party1, draft.party2) if p.company.strip()]
    return f"{name} · {' & '.join(companies)}" if companies else name


def iso_utc(timestamp: str) -> str:
    """SQLite's "2026-10-20 12:00:00.123" (UTC) as "2026-10-20T12:00:00.123Z"."""
    return timestamp.replace(" ", "T") + "Z"


def summary(row: sqlite3.Row) -> AgreementSummary:
    return AgreementSummary(
        id=row["id"],
        document_id=row["document_id"],
        title=row["title"],
        created_at=iso_utc(row["created_at"]),
        updated_at=iso_utc(row["updated_at"]),
    )


def owned_row(db: sqlite3.Connection, user: User, agreement_id: int) -> sqlite3.Row:
    """The user's agreement; a 404 if it doesn't exist or belongs to someone else."""
    row = db.execute("SELECT * FROM agreements WHERE id = ? AND user_id = ?", (agreement_id, user.id)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Agreement not found.")
    return row


def full(row: sqlite3.Row) -> AgreementOut:
    return AgreementOut(
        **summary(row).model_dump(),
        draft=Draft.model_validate_json(row["draft"]),
        messages=json.loads(row["messages"]),
    )


def stored(body: AgreementIn, documents: dict[str, Document]) -> tuple[str | None, str, str, str]:
    """The columns saved for an agreement: document id, title, draft and messages."""
    draft_json = body.draft.model_dump_json(by_alias=True)
    messages_json = json.dumps([m.model_dump() for m in body.messages])
    return body.draft.document_id, agreement_title(body.draft, documents), draft_json, messages_json


router = APIRouter(prefix="/api/agreements")


@router.get("", response_model=list[AgreementSummary])
def list_agreements(user: User = SignedIn, db: sqlite3.Connection = Db) -> list[AgreementSummary]:
    rows = db.execute(
        "SELECT * FROM agreements WHERE user_id = ? ORDER BY updated_at DESC, id DESC", (user.id,)
    ).fetchall()
    return [summary(r) for r in rows]


@router.post("", response_model=AgreementOut, status_code=201)
def create_agreement(
    body: AgreementIn, request: Request, user: User = SignedIn, db: sqlite3.Connection = Db
) -> AgreementOut:
    with db:
        cursor = db.execute(
            "INSERT INTO agreements (user_id, document_id, title, draft, messages) VALUES (?, ?, ?, ?, ?)",
            (user.id, *stored(body, request.app.state.documents)),
        )
    return full(owned_row(db, user, cursor.lastrowid))


@router.get("/{agreement_id}", response_model=AgreementOut)
def get_agreement(agreement_id: int, user: User = SignedIn, db: sqlite3.Connection = Db) -> AgreementOut:
    return full(owned_row(db, user, agreement_id))


@router.put("/{agreement_id}", response_model=AgreementOut)
def update_agreement(
    agreement_id: int, body: AgreementIn, request: Request, user: User = SignedIn, db: sqlite3.Connection = Db
) -> AgreementOut:
    owned_row(db, user, agreement_id)
    with db:
        db.execute(
            "UPDATE agreements SET document_id = ?, title = ?, draft = ?, messages = ?, "
            "updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = ?",
            (*stored(body, request.app.state.documents), agreement_id),
        )
    return full(owned_row(db, user, agreement_id))


@router.delete("/{agreement_id}", status_code=204)
def delete_agreement(agreement_id: int, user: User = SignedIn, db: sqlite3.Connection = Db) -> None:
    owned_row(db, user, agreement_id)
    with db:
        db.execute("DELETE FROM agreements WHERE id = ?", (agreement_id,))

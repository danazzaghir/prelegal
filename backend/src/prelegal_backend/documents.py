"""The legal documents Prelegal can draft, read from catalog.json and templates/.

Each template marks its fill-in terms with spans such as
<span class="orderform_link">Subscription Period</span>. Those terms become the
document's party roles (Customer, Provider, ...) and key terms.
"""

import json
import re
from dataclasses import dataclass
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from prelegal_backend.auth import SignedIn
from prelegal_backend.models import DocumentOut

NDA_ID = "Mutual-NDA"
# Part of the Mutual NDA (its cover page is built in the frontend), not a document of its own.
SKIPPED_IDS = {"Mutual-NDA-coverpage"}
# In signature-table order: the customer side first, the provider last.
PARTY_ROLES = ("Customer", "Company", "Partner", "Provider")
# Filled in per party in the signature table rather than as a key term.
PARTY_TERMS = {"Notice Address"}

TERM_SPAN = re.compile(r'<span class="[a-z]+_link"[^>]*>(.*?)</span>')
ANY_SPAN = re.compile(r"<span[^>]*>(.*?)</span>")
POSSESSIVE = re.compile(r"['’]s$")


@dataclass(frozen=True)
class Document:
    id: str
    name: str
    description: str
    parties: tuple[str, str]
    terms: tuple[str, ...]
    standard_terms: str  # The template, with its markup


def strip_markup(template: str) -> str:
    """The template as plain Markdown, without its variable spans."""
    return ANY_SPAN.sub(r"\1", template)


def template_terms(template: str) -> list[str]:
    """Distinct variable names, in order of first use, without possessives or plurals."""
    names = list(dict.fromkeys(POSSESSIVE.sub("", m.strip()) for m in TERM_SPAN.findall(template)))
    return [n for n in names if not (n.endswith("s") and n[:-1] in names)]


def parse_document(entry: dict, template: str) -> Document:
    names = template_terms(template)
    roles = [r for r in PARTY_ROLES if r in names]
    parties = (roles[0], roles[1]) if len(roles) == 2 else ("Party 1", "Party 2")
    terms = tuple(n for n in names if n not in PARTY_ROLES and n not in PARTY_TERMS)
    return Document(
        id=Path(entry["filename"]).stem,
        name=entry["name"],
        description=entry["description"],
        parties=parties,
        terms=terms,
        standard_terms=template,
    )


def load_documents(catalog_path: Path, templates_dir: Path) -> dict[str, Document]:
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    documents = {}
    for entry in catalog["templates"]:
        filename = Path(entry["filename"]).name
        if Path(filename).stem in SKIPPED_IDS:
            continue
        doc = parse_document(entry, (templates_dir / filename).read_text(encoding="utf-8"))
        documents[doc.id] = doc
    return documents


router = APIRouter(prefix="/api", dependencies=[SignedIn])


@router.get("/documents/{document_id}", response_model=DocumentOut)
def get_document(document_id: str, request: Request) -> DocumentOut:
    doc: Document | None = request.app.state.documents.get(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Unknown document.")
    return DocumentOut(
        id=doc.id,
        name=doc.name,
        description=doc.description,
        parties=doc.parties,
        terms=list(doc.terms),
        standard_terms=doc.standard_terms,
    )

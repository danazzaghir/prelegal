import json

import pytest

from prelegal_backend.config import REPO_DIR
from prelegal_backend.documents import load_documents, strip_markup, template_terms


@pytest.fixture(scope="module")
def documents():
    return load_documents(REPO_DIR / "catalog.json", REPO_DIR / "templates")


def test_loads_every_catalog_document_except_the_nda_cover_page(documents):
    catalog = json.loads((REPO_DIR / "catalog.json").read_text(encoding="utf-8"))
    assert len(documents) == len(catalog["templates"]) - 1 == 11
    assert "Mutual-NDA-coverpage" not in documents
    assert documents["CSA"].name == "Cloud Service Agreement"
    assert documents["CSA"].description.startswith("Common Paper standard Cloud Service Agreement")


@pytest.mark.parametrize(
    ("doc_id", "parties"),
    [
        ("CSA", ("Customer", "Provider")),
        ("sla", ("Customer", "Provider")),
        ("BAA", ("Company", "Provider")),
        ("design-partner-agreement", ("Partner", "Provider")),
        ("Partnership-Agreement", ("Company", "Partner")),
        ("Mutual-NDA", ("Party 1", "Party 2")),
    ],
)
def test_finds_the_two_parties(documents, doc_id, parties):
    assert documents[doc_id].parties == parties


def test_every_document_has_two_different_parties_and_some_key_terms(documents):
    for doc in documents.values():
        assert len(set(doc.parties)) == 2, doc.id
        assert doc.terms, doc.id


def test_key_terms_leave_out_parties_and_notice_addresses(documents):
    for doc in documents.values():
        assert not {"Customer", "Provider", "Company", "Partner", "Notice Address"} & set(doc.terms), doc.id
    assert documents["Pilot-Agreement"].terms == (
        "Pilot Period",
        "Effective Date",
        "General Cap Amount",
        "Governing Law",
        "Chosen Courts",
    )


def test_term_names_drop_possessives_and_plural_duplicates():
    template = (
        '<span class="coverpage_link">Customer</span> and <span class="coverpage_link">Customer’s</span> '
        "<span class=\"keyterms_link\">Provider's</span> "
        '<span class="orderform_link">Subscription Periods</span> <span class="orderform_link">Subscription Period</span> '
        '<span class="keyterms_link">Fees</span> <span class="header_2">Not a term</span>'
    )
    assert template_terms(template) == ["Customer", "Provider", "Subscription Period", "Fees"]


def test_strip_markup_keeps_the_text_of_every_span(documents):
    text = strip_markup(documents["CSA"].standard_terms)
    assert "<span" not in text
    assert "During the Subscription Period and subject to the terms of this Agreement, Customer may" in text


def test_gets_one_document_with_its_standard_terms(client):
    response = client.get("/api/documents/Pilot-Agreement")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Pilot Agreement"
    assert body["parties"] == ["Customer", "Provider"]
    assert body["terms"] == ["Pilot Period", "Effective Date", "General Cap Amount", "Governing Law", "Chosen Courts"]
    assert body["standardTerms"].startswith("# Pilot Agreement")
    assert '<span class="orderform_link">Pilot Period</span>' in body["standardTerms"]


def test_unknown_documents_are_404s(client):
    response = client.get("/api/documents/employment-contract")
    assert response.status_code == 404
    assert response.json() == {"detail": "Unknown document."}

import time

from fastapi.testclient import TestClient

from prelegal_backend.main import create_app

from .conftest import sign_up

EMPTY_PARTY = {"name": "", "title": "", "company": "", "noticeAddress": ""}
NDA = {
    "purpose": "Evaluating a partnership.",
    "effectiveDate": "",
    "mndaTermType": "expires",
    "mndaTermYears": 1,
    "confidentialityTermType": "years",
    "confidentialityTermYears": 1,
    "governingLaw": "",
    "jurisdiction": "",
    "modifications": "",
}


def body(document_id="sla", company1="", company2="", terms=None, messages=None):
    return {
        "draft": {
            "documentId": document_id,
            "party1": {**EMPTY_PARTY, "company": company1},
            "party2": {**EMPTY_PARTY, "company": company2},
            "nda": NDA,
            "terms": terms or {},
        },
        "messages": messages or [{"role": "assistant", "content": "What do you need?"}, {"role": "user", "content": "An SLA"}],
    }


def test_starts_with_no_agreements(client):
    assert client.get("/api/agreements").json() == []


def test_saves_and_reopens_an_agreement(client):
    saved = body(company1="Acme Inc", terms={"Target Uptime": "99.9%"})
    created = client.post("/api/agreements", json=saved)
    assert created.status_code == 201
    agreement = created.json()
    assert agreement["id"] == 1
    assert agreement["documentId"] == "sla"
    assert agreement["title"] == "Service Level Agreement · Acme Inc"
    assert agreement["createdAt"].endswith("Z") and "T" in agreement["createdAt"]

    reopened = client.get("/api/agreements/1").json()
    assert reopened["draft"] == saved["draft"]
    assert reopened["messages"] == saved["messages"]


def test_titles_name_the_document_and_both_parties(client):
    assert client.post("/api/agreements", json=body(company1="Acme", company2="Globex")).json()["title"] == (
        "Service Level Agreement · Acme & Globex"
    )
    assert client.post("/api/agreements", json=body(document_id="Mutual-NDA")).json()["title"] == (
        "Mutual Non-Disclosure Agreement"
    )
    assert client.post("/api/agreements", json=body(document_id=None)).json()["title"] == "Untitled agreement"


def test_updates_an_agreement_and_lists_the_latest_first(client):
    client.post("/api/agreements", json=body(company1="First"))
    client.post("/api/agreements", json=body(company1="Second"))
    time.sleep(0.01)
    updated = client.put("/api/agreements/1", json=body(document_id="CSA", company1="First", terms={"Order Date": "x"}))
    assert updated.status_code == 200
    assert updated.json()["title"] == "Cloud Service Agreement · First"
    assert updated.json()["draft"]["terms"] == {"Order Date": "x"}

    listed = client.get("/api/agreements").json()
    assert [a["id"] for a in listed] == [1, 2]
    assert set(listed[0]) == {"id", "documentId", "title", "createdAt", "updatedAt"}
    assert listed[0]["updatedAt"] > listed[0]["createdAt"]


def test_deletes_an_agreement(client):
    client.post("/api/agreements", json=body())
    assert client.delete("/api/agreements/1").status_code == 204
    assert client.get("/api/agreements").json() == []
    assert client.get("/api/agreements/1").status_code == 404


def test_users_only_see_their_own_agreements(settings):
    with TestClient(create_app(settings)) as ada, TestClient(ada.app) as alan:
        sign_up(ada)
        sign_up(alan, email="alan@example.com", name="Alan Turing")
        ada.post("/api/agreements", json=body(company1="Ada's Co"))

        assert alan.get("/api/agreements").json() == []
        for method in ("GET", "PUT", "DELETE"):
            response = alan.request(method, "/api/agreements/1", json=body())
            assert response.status_code == 404, method
            assert response.json() == {"detail": "Agreement not found."}
        assert ada.get("/api/agreements/1").json()["title"] == "Service Level Agreement · Ada's Co"


def test_unknown_agreements_are_404s(client):
    assert client.get("/api/agreements/99").status_code == 404
    assert client.put("/api/agreements/99", json=body()).status_code == 404


def test_rejects_an_invalid_draft(client):
    bad = body()
    bad["draft"]["nda"]["effectiveDate"] = "next week"
    assert client.post("/api/agreements", json=bad).status_code == 422
    assert client.post("/api/agreements", json={"draft": body()["draft"], "messages": [{"role": "system", "content": "x"}]}).status_code == 422

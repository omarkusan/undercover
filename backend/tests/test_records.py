import json
from contextlib import closing

from fastapi.testclient import TestClient

from backend import db
from backend.main import app


def test_queue_is_seeded_with_every_claim_waiting(client):
    claims = client.get("/api/claims").json()
    assert len(claims) == 25
    assert {claim["status"] for claim in claims} == {"waiting"}
    assert claims[0]["claim_id"] == "CLM-1001"
    assert claims[0]["customer_name"] == "Maya Patel"
    assert claims[0]["decision"] is None
    submitted = [claim["submitted_on"] for claim in claims]
    assert submitted == sorted(submitted)


def test_get_claim(client):
    claim = client.get("/api/claims/CLM-1001").json()
    assert claim["customer_name"] == "Maya Patel"
    assert claim["status"] == "waiting"
    assert claim["decision"] is None
    assert "Rome" in claim["story"]
    assert len(claim["items"]) == 3
    assert len(claim["documents"]) == 4


def test_get_policy(client):
    policy = client.get("/api/policies/POL-2001").json()
    assert policy["plan"] == "premium"
    assert policy["trip"]["departs_on"] == "2026-06-10"
    assert policy["trip"]["returns_on"] == "2026-06-18"


def test_get_claim_history(client):
    history = client.get("/api/customers/CUS-3001/claims").json()
    assert [claim["claim_id"] for claim in history] == ["CLM-0412"]


def test_list_handlers(client):
    handlers = client.get("/api/handlers").json()
    assert [handler["name"] for handler in handlers] == [
        "Dana Whitfield",
        "Marcus Oyelaran",
        "Priya Raman",
    ]


def test_unknown_ids_are_not_found(client):
    assert client.get("/api/claims/CLM-9999").status_code == 404
    assert client.get("/api/policies/POL-9999").status_code == 404
    assert client.get("/api/customers/CUS-9999/claims").status_code == 404


def test_no_response_holds_customer_contact_details(client):
    responses = [
        client.get("/api/claims").text,
        client.get("/api/handlers").text,
    ]
    for claim in client.get("/api/claims").json():
        full = client.get(f"/api/claims/{claim['claim_id']}").json()
        responses.append(json.dumps(full))
        responses.append(client.get(f"/api/policies/{full['policy_id']}").text)
        responses.append(
            client.get(f"/api/customers/{full['customer_id']}/claims").text
        )
    text = "\n".join(responses)
    for field in ("email", "phone", "date_of_birth", "address"):
        assert f'"{field}"' not in text
    for customer in db.read("customers.json"):
        assert customer["email"] not in text
        assert customer["phone"] not in text


def test_startup_seeds_an_empty_database(tmp_path, monkeypatch):
    monkeypatch.setenv("UNDERCOVER_DB", str(tmp_path / "new.db"))
    with TestClient(app) as client:
        assert len(client.get("/api/claims").json()) == 25


def test_reset_seeds_again(client):
    with closing(db.connect()) as connection, connection:
        connection.execute("UPDATE claims SET status = 'decided'")
    assert db.reset().startswith(
        "Seeded 25 claims, 50 policies, 49 customers and 3 handlers into "
    )
    assert client.get("/api/claims/CLM-1001").json()["status"] == "waiting"

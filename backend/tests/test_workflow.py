from contextlib import closing

import pytest

from backend import db


def start(client, claim_id="CLM-1001", thread_id="thread-1"):
    return client.post(f"/api/claims/{claim_id}/start", json={"thread_id": thread_id})


def decide(client, decision="approve", payout=420.0, claim_id="CLM-1001"):
    return client.post(
        f"/api/claims/{claim_id}/decision",
        json={
            "decision": decision,
            "payout": payout,
            "reasons": "The delay was covered.",
            "policy_section": "Section 3, Trip Delay",
        },
    )


def pay(client, amount, claim_id="CLM-1001"):
    return client.post(f"/api/claims/{claim_id}/payment", json={"amount": amount})


def sign_off(client, handler_id="HND-01", claim_id="CLM-1001"):
    return client.post(
        f"/api/claims/{claim_id}/sign-off", json={"handler_id": handler_id}
    )


def test_start_moves_a_waiting_claim_into_progress(client):
    claim = start(client).json()
    assert claim["status"] == "in_progress"
    assert claim["thread_id"] == "thread-1"


def test_a_claim_in_progress_can_be_started_again(client):
    start(client)
    assert start(client, thread_id="thread-2").json()["thread_id"] == "thread-2"


def test_a_decided_claim_cannot_be_started(client):
    start(client)
    decide(client)
    response = start(client)
    assert response.status_code == 409
    assert response.json()["detail"] == "CLM-1001 is decided, so it can't be started"


def test_steps_come_back_in_order(client):
    for kind, text in [("tool_call", "get_claim"), ("tool_result", "the claim")]:
        response = client.post(
            "/api/claims/CLM-1001/steps",
            json={"thread_id": "thread-1", "kind": kind, "text": text},
        )
        assert response.status_code == 200
    steps = client.get("/api/claims/CLM-1001/steps").json()
    assert [(step["kind"], step["text"]) for step in steps] == [
        ("tool_call", "get_claim"),
        ("tool_result", "the claim"),
    ]
    assert steps[0]["thread_id"] == "thread-1"
    assert steps[0]["created_at"]
    assert client.get("/api/claims/CLM-1002/steps").json() == []


def test_a_step_needs_a_known_kind(client):
    response = client.post(
        "/api/claims/CLM-1001/steps",
        json={"thread_id": "thread-1", "kind": "guess", "text": "hmm"},
    )
    assert response.status_code == 422


def test_approving_within_the_limit_decides_the_claim(client):
    start(client)
    claim = decide(client).json()
    assert claim["status"] == "decided"
    assert claim["decision"] == "approve"
    assert claim["payout"] == 420.0
    assert claim["reasons"] == "The delay was covered."
    assert claim["policy_section"] == "Section 3, Trip Delay"
    assert claim["decided_at"]
    assert claim["paid_amount"] is None


@pytest.mark.parametrize(
    ("payout", "status"),
    [(1000.0, "decided"), (1000.01, "waiting_for_sign_off")],
)
def test_the_approval_limit(client, payout, status):
    start(client)
    assert decide(client, payout=payout).json()["status"] == status


@pytest.mark.parametrize("decision", ["decline", "refer"])
def test_declines_and_referrals_are_decided_with_no_payout(client, decision):
    start(client)
    claim = decide(client, decision=decision, payout=0).json()
    assert claim["status"] == "decided"
    assert claim["payout"] == 0


def test_invalid_decisions_are_refused(client):
    start(client)
    assert decide(client, decision="maybe").status_code == 422
    assert decide(client, decision="decline", payout=50).status_code == 422
    assert decide(client, payout=-1).status_code == 422


def test_only_a_claim_in_progress_can_be_decided(client):
    response = decide(client)
    assert response.status_code == 409
    assert response.json()["detail"] == "CLM-1001 is waiting, so it can't be decided"


def test_paying_an_approved_claim(client):
    start(client)
    decide(client)
    claim = pay(client, 420).json()
    assert claim["paid_amount"] == 420.0
    assert claim["paid_at"]


def test_a_payment_must_be_the_approved_payout(client):
    start(client)
    decide(client)
    response = pay(client, 400)
    assert response.status_code == 409
    assert response.json()["detail"] == (
        "The payment must be the approved payout of $420.00"
    )


def test_a_claim_is_paid_once(client):
    start(client)
    decide(client)
    pay(client, 420)
    response = pay(client, 420)
    assert response.status_code == 409
    assert response.json()["detail"] == "CLM-1001 has already been paid $420.00"


@pytest.mark.parametrize("decision", ["decline", "refer"])
def test_only_approved_claims_are_paid(client, decision):
    start(client)
    decide(client, decision=decision, payout=0)
    response = pay(client, 420)
    assert response.status_code == 409
    assert response.json()["detail"] == "CLM-1001 isn't approved, so it can't be paid"


def test_a_payment_over_the_limit_waits_for_sign_off(client):
    start(client)
    decide(client, payout=1250)
    response = pay(client, 1250)
    assert response.status_code == 409
    assert "needs a handler's sign-off" in response.json()["detail"]
    claim = client.get("/api/claims/CLM-1001").json()
    assert claim["status"] == "waiting_for_sign_off"
    assert claim["paid_amount"] is None


def test_a_sign_off_pays_the_claim(client):
    start(client)
    decide(client, payout=1250)
    claim = sign_off(client).json()
    assert claim["status"] == "decided"
    assert claim["signed_off_by"] == "HND-01"
    assert claim["signed_off_at"]
    assert claim["paid_amount"] == 1250.0
    assert pay(client, 1250).status_code == 409


def test_only_a_claim_waiting_for_sign_off_can_be_signed_off(client):
    start(client)
    decide(client)
    response = sign_off(client)
    assert response.status_code == 409
    assert response.json()["detail"] == (
        "CLM-1001 is decided, so there is nothing to sign off"
    )


def test_an_unknown_handler_cannot_sign_off(client):
    start(client)
    decide(client, payout=1250)
    assert sign_off(client, handler_id="HND-99").status_code == 404


def test_a_handler_without_authority_cannot_sign_off(client):
    with closing(db.connect()) as connection, connection:
        connection.execute(
            "UPDATE handlers SET record = json_set(record,"
            " '$.can_approve_over_limit', json('false')) WHERE handler_id = 'HND-03'"
        )
    start(client)
    decide(client, payout=1250)
    response = sign_off(client, handler_id="HND-03")
    assert response.status_code == 409
    assert response.json()["detail"] == (
        "Priya Raman can't sign off payouts over $1,000.00"
    )


def test_the_queue_shows_the_decision(client):
    start(client)
    decide(client, payout=1250)
    first = client.get("/api/claims").json()[0]
    assert first["status"] == "waiting_for_sign_off"
    assert first["decision"] == "approve"
    assert first["payout"] == 1250.0

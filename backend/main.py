"""The UnderCover backend."""

import json
import sqlite3
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Annotated, Any, Literal, Self

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field, model_validator

from backend import db

Database = Annotated[sqlite3.Connection, Depends(db.database)]
APPROVAL_LIMIT: float = db.read("company.json")["payout_approval_limit"]
STATES = {
    "waiting": "waiting",
    "in_progress": "in progress",
    "waiting_for_sign_off": "waiting for sign-off",
    "decided": "decided",
}

SUMMARY = (
    "claim_id",
    "customer_name",
    "claim_type",
    "summary",
    "submitted_on",
    "amount_claimed",
    "status",
    "decision",
    "payout",
    "paid_amount",
)
HANDLER = ("handler_id", "name", "role", "can_approve_over_limit")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    db.setup()
    yield


app = FastAPI(title="UnderCover", lifespan=lifespan)


def found(row: sqlite3.Row | None, name: str) -> sqlite3.Row:
    """Return the row, or answer 404 if there is none."""
    if row is None:
        raise HTTPException(404, f"{name} not found")
    return row


def claim_from(row: sqlite3.Row) -> dict[str, Any]:
    """Merge a claim's record with where it stands."""
    fields = dict(row)
    return json.loads(fields.pop("record")) | fields


def find_claim(connection: sqlite3.Connection, claim_id: str) -> dict[str, Any]:
    """Return one claim in full."""
    row = connection.execute(
        "SELECT * FROM queue WHERE claim_id = ?", (claim_id,)
    ).fetchone()
    return claim_from(found(row, f"Claim {claim_id}"))


def refuse(message: str) -> HTTPException:
    """An answer for an operation the claim's state doesn't allow."""
    return HTTPException(409, message)


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def money(amount: float) -> str:
    return f"${amount:,.2f}"


def record_payment(connection: sqlite3.Connection, claim_id: str, amount: float):
    connection.execute(
        "UPDATE claims SET paid_amount = ?, paid_at = ? WHERE claim_id = ?",
        (amount, now(), claim_id),
    )


class Start(BaseModel):
    thread_id: str = Field(min_length=1)


class Step(BaseModel):
    thread_id: str = Field(min_length=1)
    kind: Literal["tool_call", "tool_result", "message"]
    text: str


class Decision(BaseModel):
    decision: Literal["approve", "decline", "refer"]
    payout: float = Field(ge=0)
    reasons: str = Field(min_length=1)
    policy_section: str = Field(min_length=1)

    @model_validator(mode="after")
    def only_approvals_pay(self) -> Self:
        if self.decision != "approve" and self.payout != 0:
            raise ValueError("A declined or referred claim has a payout of $0.00")
        return self


class Payment(BaseModel):
    amount: float = Field(gt=0)


class SignOff(BaseModel):
    handler_id: str


@app.get("/api/health", operation_id="health")
def health() -> dict[str, str]:
    """Check that the backend is running."""
    return {"status": "ok"}


@app.get("/api/claims", operation_id="list_claims")
def list_claims(connection: Database) -> list[dict[str, Any]]:
    """List the claims in the queue, oldest first, with where each one stands."""
    rows = connection.execute(
        "SELECT * FROM queue ORDER BY json_extract(record, '$.submitted_on'), claim_id"
    ).fetchall()
    return [{key: claim[key] for key in SUMMARY} for claim in map(claim_from, rows)]


@app.get("/api/claims/{claim_id}", operation_id="get_claim")
def get_claim(claim_id: str, connection: Database) -> dict[str, Any]:
    """Get a claim in full: the story, items, documents and the decision."""
    return find_claim(connection, claim_id)


@app.get("/api/policies/{policy_id}", operation_id="get_policy")
def get_policy(policy_id: str, connection: Database) -> dict[str, Any]:
    """Get a policy: the plan, add-ons, trip dates and travelers."""
    row = connection.execute(
        "SELECT record FROM policies WHERE policy_id = ?", (policy_id,)
    ).fetchone()
    return json.loads(found(row, f"Policy {policy_id}")["record"])


@app.get("/api/customers/{customer_id}/claims", operation_id="get_claim_history")
def get_claim_history(customer_id: str, connection: Database) -> list[dict[str, Any]]:
    """Get a customer's earlier claims."""
    row = connection.execute(
        "SELECT record FROM customers WHERE customer_id = ?", (customer_id,)
    ).fetchone()
    return json.loads(found(row, f"Customer {customer_id}")["record"])[
        "previous_claims"
    ]


@app.get("/api/handlers", operation_id="list_handlers")
def list_handlers(connection: Database) -> list[dict[str, Any]]:
    """List the claims handlers."""
    rows = connection.execute("SELECT record FROM handlers ORDER BY handler_id")
    return [
        {key: handler[key] for key in HANDLER}
        for handler in (json.loads(row["record"]) for row in rows)
    ]


@app.post("/api/claims/{claim_id}/start", operation_id="start_claim")
def start_claim(claim_id: str, start: Start, connection: Database) -> dict[str, Any]:
    """Start work on a claim, under the thread id of the agent's run."""
    claim = find_claim(connection, claim_id)
    if claim["status"] not in {"waiting", "in_progress"}:
        raise refuse(f"{claim_id} is {STATES[claim['status']]}, so it can't be started")
    connection.execute(
        "UPDATE claims SET status = 'in_progress', thread_id = ? WHERE claim_id = ?",
        (start.thread_id, claim_id),
    )
    return find_claim(connection, claim_id)


@app.post("/api/claims/{claim_id}/steps", operation_id="add_step")
def add_step(claim_id: str, step: Step, connection: Database) -> dict[str, Any]:
    """Record a step the agent took on a claim."""
    find_claim(connection, claim_id)
    cursor = connection.execute(
        "INSERT INTO steps (claim_id, thread_id, kind, text, created_at)"
        " VALUES (?, ?, ?, ?, ?)",
        (claim_id, step.thread_id, step.kind, step.text, now()),
    )
    row = connection.execute(
        "SELECT * FROM steps WHERE step_id = ?", (cursor.lastrowid,)
    ).fetchone()
    return dict(row)


@app.get("/api/claims/{claim_id}/steps", operation_id="list_steps")
def list_steps(claim_id: str, connection: Database) -> list[dict[str, Any]]:
    """List the agent's steps on a claim, in order."""
    find_claim(connection, claim_id)
    rows = connection.execute(
        "SELECT * FROM steps WHERE claim_id = ? ORDER BY step_id", (claim_id,)
    )
    return [dict(row) for row in rows]


@app.post("/api/claims/{claim_id}/decision", operation_id="decide_claim")
def decide_claim(
    claim_id: str, decision: Decision, connection: Database
) -> dict[str, Any]:
    """Record the decision on a claim in progress: approve, decline or refer."""
    claim = find_claim(connection, claim_id)
    if claim["status"] != "in_progress":
        raise refuse(f"{claim_id} is {STATES[claim['status']]}, so it can't be decided")
    over_limit = decision.decision == "approve" and decision.payout > APPROVAL_LIMIT
    connection.execute(
        "UPDATE claims SET status = ?, decision = ?, payout = ?, reasons = ?,"
        " policy_section = ?, decided_at = ? WHERE claim_id = ?",
        (
            "waiting_for_sign_off" if over_limit else "decided",
            decision.decision,
            decision.payout,
            decision.reasons,
            decision.policy_section,
            now(),
            claim_id,
        ),
    )
    return find_claim(connection, claim_id)


@app.post("/api/claims/{claim_id}/payment", operation_id="pay_claim")
def pay_claim(claim_id: str, payment: Payment, connection: Database) -> dict[str, Any]:
    """Pay an approved claim its payout, up to the limit a handler must sign off."""
    claim = find_claim(connection, claim_id)
    if claim["decision"] != "approve":
        raise refuse(f"{claim_id} isn't approved, so it can't be paid")
    if claim["paid_amount"] is not None:
        raise refuse(f"{claim_id} has already been paid {money(claim['paid_amount'])}")
    if round(payment.amount, 2) != round(claim["payout"], 2):
        raise refuse(
            f"The payment must be the approved payout of {money(claim['payout'])}"
        )
    if claim["payout"] > APPROVAL_LIMIT:
        raise refuse(
            f"A payment over {money(APPROVAL_LIMIT)} needs a handler's sign-off, "
            f"which releases it. {claim_id} is waiting for sign-off, "
            "and nothing has been paid."
        )
    record_payment(connection, claim_id, payment.amount)
    return find_claim(connection, claim_id)


@app.post("/api/claims/{claim_id}/sign-off", operation_id="sign_off_claim")
def sign_off_claim(
    claim_id: str, sign_off: SignOff, connection: Database
) -> dict[str, Any]:
    """Sign off an approved payout over the approval limit, which pays it."""
    claim = find_claim(connection, claim_id)
    row = connection.execute(
        "SELECT record FROM handlers WHERE handler_id = ?", (sign_off.handler_id,)
    ).fetchone()
    handler = json.loads(found(row, f"Handler {sign_off.handler_id}")["record"])
    if claim["status"] != "waiting_for_sign_off":
        raise refuse(
            f"{claim_id} is {STATES[claim['status']]}, so there is nothing to sign off"
        )
    if not handler["can_approve_over_limit"]:
        raise refuse(
            f"{handler['name']} can't sign off payouts over {money(APPROVAL_LIMIT)}"
        )
    connection.execute(
        "UPDATE claims SET status = 'decided', signed_off_by = ?, signed_off_at = ?"
        " WHERE claim_id = ?",
        (sign_off.handler_id, now(), claim_id),
    )
    record_payment(connection, claim_id, claim["payout"])
    return find_claim(connection, claim_id)

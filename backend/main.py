"""The UnderCover backend."""

import json
import sqlite3
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException

from backend import db

Database = Annotated[sqlite3.Connection, Depends(db.database)]

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

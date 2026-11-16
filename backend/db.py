"""The UnderCover database: SQLite, seeded from the business data in data/."""

import json
import os
import sqlite3
from collections.abc import Iterator
from contextlib import closing
from pathlib import Path
from typing import Any

DATA = Path(__file__).resolve().parent.parent / "data"
DEFAULT_PATH = Path(__file__).resolve().parent / "undercover.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS claims (
    claim_id TEXT PRIMARY KEY,
    record TEXT NOT NULL,
    status TEXT NOT NULL,
    thread_id TEXT,
    decision TEXT,
    payout REAL,
    reasons TEXT,
    policy_section TEXT,
    decided_at TEXT,
    signed_off_by TEXT,
    signed_off_at TEXT,
    paid_amount REAL,
    paid_at TEXT
);
CREATE TABLE IF NOT EXISTS policies (
    policy_id TEXT PRIMARY KEY,
    record TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
    customer_id TEXT PRIMARY KEY,
    record TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS handlers (
    handler_id TEXT PRIMARY KEY,
    record TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS steps (
    step_id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE VIEW IF NOT EXISTS queue AS
SELECT claims.*, json_extract(customers.record, '$.name') AS customer_name
FROM claims
JOIN customers ON customers.customer_id = json_extract(claims.record, '$.customer_id');
"""


def read(name: str) -> Any:
    """Read one of the JSON files in data/."""
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def path() -> Path:
    """Return the database file, from UNDERCOVER_DB if set."""
    return Path(os.getenv("UNDERCOVER_DB", str(DEFAULT_PATH)))


def connect() -> sqlite3.Connection:
    """Open the database, with rows that read like dictionaries."""
    connection = sqlite3.connect(path(), check_same_thread=False)
    connection.row_factory = sqlite3.Row
    return connection


def database() -> Iterator[sqlite3.Connection]:
    """Give a request its own connection, committed when the request succeeds."""
    with closing(connect()) as connection, connection:
        yield connection


def records(rows: list[dict[str, Any]], key: str) -> list[tuple[str, str]]:
    """Pair each record's id with the record as JSON."""
    return [(row[key], json.dumps(row)) for row in rows]


def seed(connection: sqlite3.Connection) -> None:
    """Load the queue, policies, customers and handlers, with every claim waiting."""
    claims = [
        {key: value for key, value in claim.items() if key != "status"}
        for claim in read("claims.json")
    ]
    connection.executemany(
        "INSERT INTO claims (claim_id, record, status) VALUES (?, ?, 'waiting')",
        records(claims, "claim_id"),
    )
    connection.executemany(
        "INSERT INTO policies VALUES (?, ?)",
        records(read("policies.json"), "policy_id"),
    )
    connection.executemany(
        "INSERT INTO customers VALUES (?, ?)",
        records(read("customers.json"), "customer_id"),
    )
    connection.executemany(
        "INSERT INTO handlers VALUES (?, ?)",
        records(read("handlers.json"), "handler_id"),
    )


def setup() -> None:
    """Create the tables, and seed them if the database is empty."""
    with closing(connect()) as connection, connection:
        connection.executescript(SCHEMA)
        if not connection.execute("SELECT 1 FROM claims").fetchone():
            seed(connection)


def reset() -> str:
    """Delete the database and seed it again, and say what was seeded."""
    path().unlink(missing_ok=True)
    setup()
    with closing(connect()) as connection:
        claims, policies, customers, handlers = connection.execute(
            "SELECT (SELECT COUNT(*) FROM claims), (SELECT COUNT(*) FROM policies),"
            " (SELECT COUNT(*) FROM customers), (SELECT COUNT(*) FROM handlers)"
        ).fetchone()
    return (
        f"Seeded {claims} claims, {policies} policies, {customers} customers "
        f"and {handlers} handlers into {path()}"
    )


if __name__ == "__main__":
    print(reset())

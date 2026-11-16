"""Run the UnderCover Agent: uv run -m agent [claim id ...].

With claim ids it decides those claims. Without, it works through every waiting
claim in queue order.
"""

import sys
from typing import Any
from uuid import uuid4

from agent import main as agent


def summary(claim: dict[str, Any]) -> str:
    """One line on where a claim stands."""
    payout = "" if claim["payout"] is None else f"${claim['payout']:,.2f}"
    decision = claim["decision"] or "no decision"
    return f"{claim['claim_id']}  {decision}  {payout}  {claim['status']}"


def waiting_claims() -> list[str]:
    """The ids of the waiting claims, in queue order."""
    with agent.backend() as client:
        claims = client.get("/api/claims").raise_for_status().json()
    return [claim["claim_id"] for claim in claims if claim["status"] == "waiting"]


def decide(claim_id: str) -> None:
    """Run the agent on one claim with a new thread id, and say how it ended."""
    agent.run(claim_id, str(uuid4()))
    with agent.backend() as client:
        claim = client.get(f"/api/claims/{claim_id}").raise_for_status().json()
    print(summary(claim), flush=True)


def main(claim_ids: list[str]) -> None:
    """Decide the claims given, or every waiting claim."""
    for claim_id in claim_ids or waiting_claims():
        decide(claim_id)


if __name__ == "__main__":
    main(sys.argv[1:])

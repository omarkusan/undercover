"""Run the UnderCover Agent on a claim: uv run -m agent CLM-1001."""

import sys
from typing import Any
from uuid import uuid4

from agent import main as agent


def summary(claim: dict[str, Any]) -> str:
    """One line on where a claim stands."""
    payout = "" if claim["payout"] is None else f"${claim['payout']:,.2f}"
    decision = claim["decision"] or "no decision"
    return f"{claim['claim_id']}  {decision}  {payout}  {claim['status']}"


def decide(claim_id: str) -> None:
    """Run the agent on one claim with a new thread id, and say how it ended."""
    reply = agent.run(claim_id, str(uuid4()))
    with agent.backend() as client:
        claim = client.get(f"/api/claims/{claim_id}").raise_for_status().json()
    print(summary(claim))
    print(reply)


if __name__ == "__main__":
    decide(sys.argv[1])

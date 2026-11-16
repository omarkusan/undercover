# Status

The pilot is being built from `docs/PLAN.md`. Done so far: phases 1 to 3, the records, the claim workflow and the payment rule, and the agent.

- `backend/`: FastAPI on SQLite (`backend/db.py`). The database is at `UNDERCOVER_DB`, by default `backend/undercover.db`, and is seeded from `data/` when empty, with every claim waiting. It serves the claims queue, each claim in full, policies, a customer's claim history and the handlers. It never returns a customer's contact details.
- The claim workflow: a claim goes from waiting to in progress (`start_claim`), then to decided or, for an approval over $1,000, waiting for sign-off (`decide_claim`). The agent's steps are recorded with `add_step`. `pay_claim` pays only an approved claim, only its payout, only once, and never over $1,000. That payment is made when a handler signs off (`sign_off_claim`).
- `backend/instructions.md`: the agent's instructions. `get_instructions` returns them followed by `data/policy_wording.md`, which is the agent's whole system prompt.
- `agent/`: the UnderCover Agent, `create_agent` on OpenRouter. The entry point `run(claim_id, thread_id)` fetches the instructions, starts the claim, and reports every tool call, result and reply to the backend as a step. Its tools are `get_claim`, `get_policy`, `get_claim_history`, `decide_claim` and `pay_claim`, all through the backend's API.
- `dashboard/`: still the skeleton, one page that shows whether the backend is up
- `e2e/`: one test of that page

## Running it

- `npm run dev` starts the backend on port 8000 and the dashboard on port 5173.
- `uv run -m agent CLM-1001` runs the agent on one claim, with the backend running. It uses `openai/gpt-6-luna`, or the model in `MODEL_NAME`.
- `npm run reset` deletes the database and seeds it again.
- `npm run check` runs every check.

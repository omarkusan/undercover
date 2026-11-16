# Status

The pilot from `docs/PLAN.md` is built: the backend, the UnderCover Agent and the dashboard.

- `backend/`: FastAPI on SQLite (`backend/db.py`). The database is at `UNDERCOVER_DB`, by default `backend/undercover.db`, and is seeded from `data/` when empty, with every claim waiting. It serves the claims queue, each claim in full, policies, a customer's claim history and the handlers. It never returns a customer's contact details, and no code reaches `data/evals/`.
- The claim workflow: a claim goes from waiting to in progress (`start_claim`), then to decided or, for an approval over $1,000, waiting for sign-off (`decide_claim`). The agent's steps are recorded with `add_step`. `pay_claim` pays only an approved claim, only its payout, only once, and never over $1,000. That payment is made when a handler signs off (`sign_off_claim`).
- `backend/instructions.md`: the agent's instructions. `get_instructions` returns them followed by `data/policy_wording.md`, which is the agent's whole system prompt.
- `agent/`: the UnderCover Agent, `create_agent` on OpenRouter. The entry point `run(claim_id, thread_id)` fetches the instructions, starts the claim, and reports every tool call, result and reply to the backend as a step. Its tools are `get_claim`, `get_policy`, `get_claim_history`, `decide_claim` and `pay_claim`, all through the backend's API.
- `dashboard/`: React in the UnderCover brand, with light and dark mode following the system setting. Pages are addressed by the URL hash. The queue (`#/`) shows the number of claims in each state and every claim with its state, decision and payout. The claim page (`#/claims/<id>`) shows the claim in full, its policy and the customer's earlier claims, the agent's decision and payment, and the agent's steps as they happen. On a claim waiting for sign-off, a handler chooses their name and signs off, which pays it. The instructions page (`#/instructions`) shows the agent's whole system prompt, read only. Pages showing claims refresh every 2 seconds.
- `e2e/`: Playwright tests of the queue, a claim's sign-off and the instructions. They run their own backend on port 8001, with a fresh `e2e/undercover.db`, and their own dashboard on port 5174, so they never touch the dev servers or their data.

## Running it

- `npm run dev` starts the backend on port 8000 and the dashboard on port 5173.
- `npm run agent` works through every waiting claim in queue order, with the backend running, and prints one line per claim. `npm run agent -- CLM-1001` decides one claim. A claim left in progress by a failed run can be run again by its id. The agent uses `openai/gpt-6-luna`, or the model in `MODEL_NAME`.
- `npm run reset` deletes the database and seeds it again, with every claim waiting.
- `npm run check` runs every check.

## Not built yet

- Measuring the agent's accuracy against the handlers' decisions in `data/evals/`.
- The claims manual, sign-in, real payments and messages to customers, as `docs/SPEC.md` says.

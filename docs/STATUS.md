# Status

The pilot is being built from `docs/PLAN.md`. Done so far: phase 1, the records.

- `backend/`: FastAPI on SQLite (`backend/db.py`). The database is at `UNDERCOVER_DB`, by default `backend/undercover.db`, and is seeded from `data/` when empty, with every claim waiting. It serves the claims queue, each claim in full, policies, a customer's claim history and the handlers. It never returns a customer's contact details.
- `agent/`: still the skeleton, the entry point `run(claim_id, thread_id)` with one tool that calls the health route
- `dashboard/`: still the skeleton, one page that shows whether the backend is up
- `e2e/`: one test of that page

## Running it

- `npm run dev` starts the backend on port 8000 and the dashboard on port 5173.
- `npm run reset` deletes the database and seeds it again.
- `npm run check` runs every check.

import { defineConfig } from "@playwright/test";

// The end-to-end tests run their own backend and dashboard, on ports of their
// own and with a database seeded fresh for each run, so they never touch the
// dev servers or their data.
const backend = "http://127.0.0.1:8001";
const dashboard = "http://localhost:5174";

export default defineConfig({
  testDir: "e2e",
  outputDir: "e2e/test-results",
  reporter: "list",
  use: { baseURL: dashboard },
  webServer: [
    {
      command:
        "uv run -m backend.db && uv run -m uvicorn backend.main:app --port 8001",
      url: `${backend}/api/health`,
      env: { UNDERCOVER_DB: "e2e/undercover.db" },
    },
    {
      command: "npx vite dashboard --port 5174 --strictPort",
      url: dashboard,
      env: { BACKEND_URL: backend },
    },
  ],
});

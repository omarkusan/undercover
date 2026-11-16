import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QueuePage } from "./QueuePage";
import { signOffClaim, stubApi, waitingClaim } from "./testing";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("lists each claim with where it stands", async () => {
  stubApi({ "/api/claims": [waitingClaim, signOffClaim] });
  render(<QueuePage />);
  const link = await screen.findByRole("link", { name: "CLM-1001" });
  expect(link.getAttribute("href")).toBe("#/claims/CLM-1001");
  const rows = screen.getAllByRole("row");
  expect(rows).toHaveLength(3);
  const second = within(rows[2]);
  expect(second.getByText("Tom Becker")).toBeDefined();
  expect(second.getByText("Baggage")).toBeDefined();
  expect(second.getByText("Jul 20, 2026")).toBeDefined();
  expect(second.getAllByText("$1,150.00")).toHaveLength(2);
  expect(second.getByText("Waiting for sign-off")).toBeDefined();
  expect(second.getByText("Approve")).toBeDefined();
});

it("counts the claims in each state", async () => {
  stubApi({ "/api/claims": [waitingClaim, signOffClaim, waitingClaim] });
  render(<QueuePage />);
  const tiles = await screen.findByRole("list", { name: "Claims by state" });
  expect(
    within(tiles)
      .getAllByRole("listitem")
      .map((tile) => tile.textContent),
  ).toEqual([
    "2 Waiting",
    "0 In progress",
    "1 Waiting for sign-off",
    "0 Decided",
  ]);
});

it("says so when the backend can't be reached", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<QueuePage />);
  expect((await screen.findByRole("alert")).textContent).toBe(
    "The claims can't be loaded right now. The page keeps trying.",
  );
});

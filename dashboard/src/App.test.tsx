import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";
import { stubApi, waitingClaim } from "./testing";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = "";
});

it("opens on the queue", async () => {
  stubApi({ "/api/claims": [waitingClaim] });
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: "Claims queue" }),
  ).toBeDefined();
  const queue = screen.getByRole("link", { name: "Queue" });
  expect(queue.getAttribute("aria-current")).toBe("page");
});

it("follows the address to a claim and to the instructions", async () => {
  stubApi({ "/api/claims": [waitingClaim] });
  render(<App />);
  act(() => {
    window.location.hash = "#/claims/CLM-1001";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  expect(
    await screen.findByRole("heading", { name: "CLM-1001" }),
  ).toBeDefined();
  act(() => {
    window.location.hash = "#/instructions";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  expect(
    await screen.findByRole("heading", { name: "The agent's instructions" }),
  ).toBeDefined();
  const instructions = screen.getByRole("link", { name: "Instructions" });
  expect(instructions.getAttribute("aria-current")).toBe("page");
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InstructionsPage } from "./InstructionsPage";
import { stubApi } from "./testing";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows the instructions, read only", async () => {
  stubApi({
    "/api/instructions": {
      instructions: "You are the UnderCover Agent.\n\n# Policy Wording",
    },
  });
  render(<InstructionsPage />);
  const text = await screen.findByText(/You are the UnderCover Agent\./);
  expect(text.textContent).toContain("# Policy Wording");
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});

it("says so when the instructions can't be loaded", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<InstructionsPage />);
  expect((await screen.findByRole("alert")).textContent).toBe(
    "The instructions can't be loaded right now.",
  );
});

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Claim } from "./api";
import { ClaimPage } from "./ClaimPage";
import { claimRoutes, fullClaim, steps, stubApi } from "./testing";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function section(name: string) {
  return within(screen.getByRole("region", { name }));
}

it("shows the claim in full with the agent's decision", async () => {
  stubApi(claimRoutes(fullClaim, steps));
  render(<ClaimPage claimId="CLM-1002" />);
  expect(
    await screen.findByRole("heading", { name: "CLM-1002" }),
  ).toBeDefined();
  expect(section("Overview").getByText("Waiting for sign-off")).toBeDefined();
  expect(section("Overview").getByText("Tom Becker")).toBeDefined();
  expect(
    section("The customer's story").getByText(
      "My suitcase never arrived in Prague.",
    ),
  ).toBeDefined();
  expect(section("Items claimed").getByText("Wool suit")).toBeDefined();
  expect(section("Items claimed").getByText("$870.00")).toBeDefined();
  expect(
    section("Documents").getByText(
      "One checked bag, tag NW 771204, not delivered.",
    ),
  ).toBeDefined();

  const decision = section("The agent's decision");
  expect(decision.getByText("Approve")).toBeDefined();
  expect(decision.getByText("$1,150.00", { selector: "dd" })).toBeDefined();
  expect(
    decision.getByText("Section 5, Baggage and Personal Effects"),
  ).toBeDefined();
  expect(decision.getByText(/The bag was lost by the carrier/)).toBeDefined();

  const policy = within(
    await screen.findByRole("region", { name: "Policy POL-2002" }),
  );
  expect(await policy.findByText("Premium")).toBeDefined();
  expect(policy.getByText("Electronics plus")).toBeDefined();
  expect(policy.getByText("Tom Becker")).toBeDefined();
  expect(
    await section("Earlier claims").findByText(
      "Seven hour delay leaving Chicago",
    ),
  ).toBeDefined();
});

it("lists the agent's steps in order and folds long results", async () => {
  stubApi(claimRoutes(fullClaim, steps));
  render(<ClaimPage claimId="CLM-1002" />);
  const list = await screen.findByRole("list");
  const items = within(list).getAllByRole("listitem");
  expect(items).toHaveLength(3);
  expect(within(items[0]).getByText("Tool call")).toBeDefined();
  expect(items[1].querySelector("details")).not.toBeNull();
  expect(
    within(items[2]).getByText("Approved $1,150.00, waiting for sign-off."),
  ).toBeDefined();
});

it("signs off a payout and shows the payment", async () => {
  const paid: Claim = {
    ...fullClaim,
    status: "decided",
    signed_off_by: "HND-01",
    signed_off_at: "2026-11-15T18:05:00+00:00",
    paid_amount: 1150,
    paid_at: "2026-11-15T18:05:00+00:00",
  };
  const fetchMock = stubApi({
    ...claimRoutes(fullClaim, steps),
    "POST /api/claims/CLM-1002/sign-off": paid,
  });
  render(<ClaimPage claimId="CLM-1002" />);
  const handler = await screen.findByLabelText("Handler");
  expect(await within(handler).findByText("Dana Whitfield")).toBeDefined();
  expect(within(handler).queryByText("Marcus Oyelaran")).toBeNull();
  fireEvent.change(handler, { target: { value: "HND-01" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Sign off and pay $1,150.00" }),
  );
  expect(
    await screen.findByText("Signed off by Dana Whitfield."),
  ).toBeDefined();
  expect(screen.getByText(/^Paid/, { selector: ".payment p" })).toBeDefined();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/claims/CLM-1002/sign-off",
    expect.objectContaining({ body: JSON.stringify({ handler_id: "HND-01" }) }),
  );
});

it("says why a sign-off didn't go through", async () => {
  stubApi(claimRoutes(fullClaim, steps));
  render(<ClaimPage claimId="CLM-1002" />);
  const handler = await screen.findByLabelText("Handler");
  await within(handler).findByText("Dana Whitfield");
  fireEvent.change(handler, { target: { value: "HND-01" } });
  fireEvent.click(screen.getByRole("button", { name: /Sign off and pay/ }));
  expect((await screen.findByRole("alert")).textContent).toBe("Not found");
});

it("shows a claim the agent hasn't worked on", async () => {
  const waiting: Claim = {
    ...fullClaim,
    status: "waiting",
    decision: null,
    payout: null,
    reasons: null,
    policy_section: null,
  };
  stubApi({
    ...claimRoutes(waiting, []),
    "/api/customers/CUS-3002/claims": [],
  });
  render(<ClaimPage claimId="CLM-1002" />);
  expect(
    await screen.findByText("The agent hasn't worked on this claim yet."),
  ).toBeDefined();
  expect(screen.getByText("No steps yet.")).toBeDefined();
  expect(await screen.findByText("No earlier claims.")).toBeDefined();
});

it("shows a claim the agent is working on", async () => {
  stubApi(
    claimRoutes(
      { ...fullClaim, status: "in_progress", decision: null, payout: null },
      steps,
    ),
  );
  render(<ClaimPage claimId="CLM-1002" />);
  expect(
    await screen.findByText("The agent is working on this claim."),
  ).toBeDefined();
});

it("shows a payment made without a sign-off", async () => {
  stubApi(
    claimRoutes(
      {
        ...fullClaim,
        status: "decided",
        payout: 420,
        paid_amount: 420,
        paid_at: "2026-11-15T18:05:00+00:00",
      },
      steps,
    ),
  );
  render(<ClaimPage claimId="CLM-1002" />);
  expect(
    await screen.findByText("$420.00", { selector: ".payment span" }),
  ).toBeDefined();
  expect(screen.queryByText(/Signed off by/)).toBeNull();
});

it("says when a decision has no payment", async () => {
  stubApi(
    claimRoutes(
      { ...fullClaim, status: "decided", decision: "decline", payout: 0 },
      steps,
    ),
  );
  render(<ClaimPage claimId="CLM-1002" />);
  expect(await screen.findByText("No payment.")).toBeDefined();
});

it("says when an approved claim isn't paid yet", async () => {
  stubApi(claimRoutes({ ...fullClaim, status: "decided", payout: 420 }, steps));
  render(<ClaimPage claimId="CLM-1002" />);
  expect(await screen.findByText("Not paid yet.")).toBeDefined();
});

it("says so when the claim can't be loaded", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<ClaimPage claimId="CLM-1002" />);
  expect((await screen.findByRole("alert")).textContent).toBe(
    "This claim can't be loaded right now. The page keeps trying.",
  );
});

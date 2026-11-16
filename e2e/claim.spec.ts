import { expect, test } from "@playwright/test";

const claim = "/api/claims/CLM-1002";
const thread = { thread_id: "e2e-claim" };

test("a payout over the limit waits for a handler, who signs it off", async ({
  page,
  request,
}) => {
  await page.goto("/#/claims/CLM-1002");
  await expect(page.getByRole("heading", { name: "CLM-1002" })).toBeVisible();
  await expect(page.getByText("No steps yet.")).toBeVisible();

  expect((await request.post(`${claim}/start`, { data: thread })).ok()).toBe(
    true,
  );
  for (const [kind, text] of [
    ["tool_call", 'get_claim {"claim_id": "CLM-1002"}'],
    ["message", "The bag was lost by the carrier."],
  ]) {
    await request.post(`${claim}/steps`, { data: { ...thread, kind, text } });
  }
  const steps = page.getByRole("region", { name: "The agent's steps" });
  await expect(steps.getByRole("listitem")).toHaveCount(2);
  await expect(steps).toContainText('get_claim {"claim_id": "CLM-1002"}');

  const decided = await request.post(`${claim}/decision`, {
    data: {
      decision: "approve",
      payout: 1150,
      reasons: "The carrier lost the bag. The items are within the limits.",
      policy_section: "Section 5, Baggage and Personal Effects",
    },
  });
  expect(decided.ok()).toBe(true);
  const overview = page.getByRole("region", { name: "Overview" });
  await expect(overview).toContainText("Waiting for sign-off");
  const decision = page.getByRole("region", { name: "The agent's decision" });
  await expect(decision).toContainText("Approve");
  await expect(decision).toContainText("$1,150.00");

  const payment = await request.post(`${claim}/payment`, {
    data: { amount: 1150 },
  });
  expect(payment.status()).toBe(409);

  await page.getByLabel("Handler").selectOption({ label: "Dana Whitfield" });
  await page
    .getByRole("button", { name: "Sign off and pay $1,150.00" })
    .click();
  await expect(overview).toContainText("Decided");
  await expect(decision).toContainText("Paid $1,150.00");
  await expect(decision).toContainText("Signed off by Dana Whitfield.");
});

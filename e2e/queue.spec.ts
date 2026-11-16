import { expect, test } from "@playwright/test";

test("the queue lists every claim with where it stands", async ({ page }) => {
  await page.goto("/");
  const rows = page.getByRole("region", { name: "Claims" }).getByRole("row");
  await expect(rows).toHaveCount(26);
  await expect(rows.nth(1)).toContainText("CLM-1001");
  await expect(rows.nth(1)).toContainText("Maya Patel");
  await expect(rows.nth(1)).toContainText("$420.00");
  await expect(rows.nth(1)).toContainText("Waiting");

  const tiles = page
    .getByRole("list", { name: "Claims by state" })
    .getByRole("listitem");
  const counts = (await tiles.allTextContents()).map((tile) =>
    Number(tile.split(" ")[0]),
  );
  expect(counts.reduce((sum, count) => sum + count, 0)).toBe(25);
  await expect(
    rows.filter({ hasText: "Waiting" }).filter({ hasNotText: "sign-off" }),
  ).toHaveCount(counts[0] ?? -1);

  await page.getByRole("link", { name: "CLM-1001" }).click();
  await expect(page).toHaveURL(/#\/claims\/CLM-1001$/);
  await expect(page.getByRole("heading", { name: "CLM-1001" })).toBeVisible();
});

test("the queue shows the agent starting a claim without a reload", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const row = page.getByRole("row").filter({ hasText: "CLM-1003" });
  await expect(row).toContainText("Waiting");
  const started = await request.post("/api/claims/CLM-1003/start", {
    data: { thread_id: "e2e-queue" },
  });
  expect(started.ok()).toBe(true);
  await expect(row).toContainText("In progress", { timeout: 3000 });
});

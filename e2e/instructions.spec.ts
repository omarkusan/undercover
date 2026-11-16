import { expect, test } from "@playwright/test";

test("the instructions are shown read only", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Instructions" }).click();
  const instructions = page.getByRole("region", { name: "Instructions" });
  await expect(instructions).toContainText("You are the UnderCover Agent.");
  await expect(instructions).toContainText("How we work out your payment");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.locator("input, textarea, [contenteditable]")).toHaveCount(
    0,
  );
});

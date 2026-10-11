import { expect, test } from "@playwright/test";

test("first visit to Home: pick a currency and budget, then add the first expense", async ({ page }) => {
  await page.goto("/history");
  const setup = page.getByRole("dialog", { name: "Welcome! Let's set you up" });
  await expect(setup).toBeVisible();
  await setup.getByRole("radio", { name: "SGD" }).click();
  await setup.getByRole("button", { name: "Next" }).click();

  const budget = page.getByRole("dialog", { name: "A monthly budget?" });
  await budget.getByLabel("Monthly budget").fill("2000");
  await budget.getByRole("button", { name: "Add my first expense" }).click();

  // The demo receipt is gone and the add sheet is ready, in SGD.
  const add = page.getByRole("dialog", { name: "Quick add" });
  await expect(add.getByLabel("Currency")).toHaveValue("SGD");
  await add.getByLabel("Amount", { exact: true }).fill("8.50");
  await add.getByLabel("Expense", { exact: true }).fill("chicken rice");
  await add.getByRole("button", { name: "Add SGD 8.50" }).click();
  await expect(page.getByRole("link", { name: /Chicken Rice/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Ryann Kopitiam/ })).toHaveCount(0);
  await expect(page.getByText(/of SGD 2,000\.00/)).toBeVisible();

  // It doesn't come back.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Spending", level: 1 })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Welcome! Let's set you up" })).toHaveCount(0);
});

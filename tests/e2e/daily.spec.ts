import path from "node:path";

import { addButton, expect, goStep, openMore, paper, test } from "./fixtures";

test("Quick add logs an expense from one line", async ({ page }) => {
  await page.goto("/history");
  await page.getByRole("button", { name: "Quick add" }).first().click();
  await page.getByLabel("Expense", { exact: true }).fill("nasi lemak 12.90 tng #work");
  await expect(page.getByRole("radio", { name: "Food & Drink" })).toHaveAttribute("aria-checked", "true");
  await addButton(page).click();
  await expect(page.getByText(/Added MYR 12\.90 · Food & Drink/)).toBeVisible();

  const row = page.getByRole("link", { name: /Nasi Lemak/ }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText("Touch 'n Go eWallet");
  await expect(row).toContainText("#work");

  // One tap to log the same thing again.
  await page.keyboard.press("Alt+q");
  await page.getByRole("button", { name: /Nasi Lemak\s+12\.90/ }).click();
  await expect(page.getByRole("link", { name: /Nasi Lemak/ })).toHaveCount(2);
});

test("shop names auto-fill from earlier receipts", async ({ page }) => {
  await page.goto("/history");
  await page.getByRole("button", { name: "Quick add" }).first().click();
  await page.getByLabel("Expense", { exact: true }).fill("jaya grocer 88.00 maybank");
  await addButton(page).click();

  await page.goto("/studio");
  await page.getByRole("button", { name: "New receipt" }).click();
  await page.getByRole("button", { name: "Blank receipt" }).click();
  await page.getByLabel("Store name").fill("jaya");
  await page.getByRole("option", { name: /Jaya Grocer/ }).click();
  await expect(page.getByText(/Filled in from your last visit/)).toBeVisible();
  await goStep(page, "Payment");
  await expect(page.getByLabel("Wallet / account")).toHaveValue("Maybank");
  await expect(page.getByLabel("Category")).toHaveValue("Groceries");
});

test("wallet, tags and tax relief are recorded and summarised", async ({ page }) => {
  await page.goto("/studio");
  await goStep(page, "Payment");
  await openMore(page, "Wallet, warranty, tags & photo");
  await page.getByLabel("Wallet / account").fill("CIMB");
  await page.getByLabel("Tags").fill("family");
  await page.getByLabel("Tags").press("Enter");
  await page.getByLabel("Tax relief (LHDN)", { exact: true }).selectOption("lifestyle");

  await page.goto("/history");
  await expect(page.getByRole("heading", { name: /Tax relief/ })).toBeVisible();
  await expect(page.getByText(/Lifestyle \(books/)).toBeVisible();
  await page.getByRole("tab", { name: "Wallet" }).click();
  await page.getByRole("button", { name: /CIMB/ }).first().click();
  await expect(page.getByRole("button", { name: /CIMB/, pressed: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^CIMB\s*Clear filter$/})).toBeVisible(); // filter chip
});

test("recurring expenses add themselves", async ({ page }) => {
  await page.goto("/history");
  // Empty tools start folded under "More tools".
  await page.getByRole("button", { name: /^Recurring/ }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByPlaceholder("e.g. Rent, Unifi, Netflix").fill("Netflix");
  await page.getByLabel(/^Amount/).fill("55");
  // Start a month back so one occurrence is already due.
  const start = new Date(Date.now() - 32 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Starting from").fill(start);
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText(/Added \d+ recurring expense/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Netflix/ }).first()).toBeVisible();
});

test("category budgets show progress", async ({ page }) => {
  await page.goto("/history");
  await page.getByRole("button", { name: "Set category budgets" }).click();
  await page.getByLabel("Food & Drink", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/% of 100\.00/)).toBeVisible();
});

test("scanning a receipt photo creates a receipt (on-device OCR)", async ({ page }, testInfo) => {
  test.slow();
  await page.goto("/studio");
  await expect(paper(page)).toBeVisible();
  // Use RyannReceipt's own PNG export as the "photo".
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /^PNG/ }).click()]);
  const photo = path.join(testInfo.outputDir, "receipt.png");
  await download.saveAs(photo);

  await page.getByRole("button", { name: "Quick add" }).first().click();
  await page.getByRole("button", { name: "Scan a receipt" }).click();
  await page.getByRole("dialog").last().locator("input[type=file]:not([capture])").setInputFiles(photo);
  await expect(page.getByText("Check the details below")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByLabel("Store name").last()).toHaveValue(/Kopitiam/i);
  await page.getByRole("button", { name: "Create receipt" }).click();
  await expect(page.getByText("Receipt created from your photo")).toBeVisible();
  await expect(paper(page)).toContainText(/nasi lemak/i);
});

test("the reminders bell lists what needs attention", async ({ page }) => {
  await page.goto("/studio");
  await goStep(page, "Payment");
  const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  await openMore(page, "Wallet, warranty, tags & photo");
  await page.getByLabel("Warranty until").fill(soon);
  await page.getByRole("button", { name: /^Reminders \(\d+\)/ }).click();
  await expect(page.getByText(/warranty ends in \d+ day/)).toBeVisible();
});

test("amounts keep at most two decimal places", async ({ page }) => {
  await page.goto("/history");
  await page.getByRole("button", { name: "Quick add" }).first().click();
  const amount = page.getByLabel("Amount", { exact: true });
  await amount.pressSequentially("9900.00000");
  await expect(amount).toHaveValue("9900.00");
  await amount.fill("");
  await amount.pressSequentially("2.345");
  await expect(amount).toHaveValue("2.34");
});

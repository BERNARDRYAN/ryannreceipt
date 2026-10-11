import { expect, goStep, openMore, paper, test } from "./fixtures";

// Note: the receipt uppercases text with CSS, so text assertions match case-insensitively.

test.beforeEach(async ({ page }) => {
  await page.goto("/studio");
  await expect(paper(page)).toBeVisible();
});

test("editing the form updates the live receipt", async ({ page }) => {
  await page.getByLabel("Store name").fill("Kedai Test");
  await expect(paper(page)).toContainText(/kedai test/i);

  await openMore(page, "More options: address, logo, receipt no.");
  await page.getByLabel("Cashier").fill("siti");
  await expect(paper(page)).toContainText("CASHIER:");
  await expect(paper(page)).toContainText(/siti/i);
});

test("totals follow MY rules: service charge, SST and 5-sen cash rounding", async ({ page }) => {
  // Sample draft: 23.00 + 10% svc (2.30) + 6% SST (1.52) = 26.82 -> cash 26.80
  await expect(paper(page)).toContainText("SERVICE CHG 10%");
  await expect(paper(page)).toContainText("ROUNDING ADJ");
  await expect(paper(page).getByText("26.80")).toBeVisible();

  await goStep(page, "Payment");
  await page.getByLabel("Payment method").selectOption("CARD");
  await expect(paper(page)).not.toContainText("ROUNDING ADJ");
  await expect(paper(page).getByText("26.82")).toBeVisible();
});

test("the stepper walks through Shop, Items, Payment and Look", async ({ page }) => {
  await expect(page.getByText("Step 1 of 4")).toBeVisible();
  await page.getByRole("button", { name: "Next: Items" }).click();
  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  await page.getByRole("button", { name: "Next: Payment" }).click();
  await page.getByRole("button", { name: "Next: Look" }).click();
  await expect(page.getByText("Step 4 of 4")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByText("Step 3 of 4")).toBeVisible();
});

test("clicking a line on the receipt jumps to that field", async ({ page }) => {
  await paper(page).locator('[data-field="paymentMethod"]').first().click();
  await expect(page.getByText("Step 3 of 4")).toBeVisible();
  await expect(page.getByLabel("Payment method")).toBeFocused();

  const firstItem = paper(page).locator('[data-field^="item-"]').first();
  await firstItem.click();
  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  await expect(page.getByLabel("Item 1 name")).toBeFocused();
});

test("Enter on the last item row adds a new row and focuses it", async ({ page }) => {
  await goStep(page, "Items");
  const names = page.getByPlaceholder("Item name");
  const before = await names.count();
  await page.getByLabel(`Item ${before} unit price`).press("Enter");
  await expect(names).toHaveCount(before + 1);
  await expect(names.nth(before)).toBeFocused();
  await page.keyboard.type("Teh Tarik");
  await page.getByLabel(`Item ${before + 1} unit price`).fill("3.20");
  await expect(paper(page)).toContainText(/teh tarik/i);
});

test("prices are shown with fixed decimals after editing", async ({ page }) => {
  await goStep(page, "Items");
  const price = page.getByLabel("Item 1 unit price");
  await price.fill("3.5");
  await price.blur();
  await expect(price).toHaveValue("3.50");
});

test("items can be reordered from the keyboard", async ({ page }) => {
  await goStep(page, "Items");
  const first = await page.getByLabel("Item 1 name").inputValue();
  await page.getByRole("button", { name: new RegExp(`^Reorder ${first}`) }).press("ArrowDown");
  await expect(page.getByLabel("Item 2 name")).toHaveValue(first);
});

test("undo and redo work from the toolbar and keyboard", async ({ page }) => {
  const name = page.getByLabel("Store name");
  const original = await name.inputValue();
  await name.fill("Changed Shop");
  await expect(paper(page)).toContainText(/changed shop/i);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(name).toHaveValue(original);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(name).toHaveValue("Changed Shop");

  await page.keyboard.press("Control+z");
  await expect(name).toHaveValue(original);
});

test("a look restyles the paper in one step", async ({ page }) => {
  await goStep(page, "Look");
  await page.getByRole("radio", { name: "Vintage" }).click();
  await expect(paper(page)).toHaveAttribute("data-theme", "aged");
  await expect(paper(page)).toHaveAttribute("data-font", "typewriter");
  await page.keyboard.press("Control+z");
  await expect(paper(page)).toHaveAttribute("data-theme", "clean");
});

test("exports a PNG at the chosen resolution and a PDF", async ({ page }) => {
  const [png] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /^PNG/ }).click()]);
  expect(png.suggestedFilename()).toMatch(/^ryannreceipt-.*@2x\.png$/);
  await expect(page.locator(".export-stamp")).toBeVisible();

  await page.getByRole("button", { name: "More export options" }).click();
  await page.getByRole("radio", { name: "4x" }).click();
  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PDF" }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);

  const [png4] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Control+s")]);
  expect(png4.suggestedFilename()).toMatch(/@4x\.png$/);
});

test("drafts persist across reloads; New is undoable and numbers count up", async ({ page }) => {
  await page.getByLabel("Store name").fill("Persisted Shop");
  await page.reload();
  await expect(page.getByLabel("Store name")).toHaveValue("Persisted Shop");

  const receiptNo = await page.getByLabel("Receipt no.", { exact: true }).inputValue();
  await page.getByRole("button", { name: "New receipt" }).click();
  await page.getByRole("button", { name: "Blank receipt" }).click();
  await expect(page.getByLabel("Receipt no.", { exact: true })).toHaveValue("RR-000101");
  // New keeps the merchant.
  await expect(page.getByLabel("Store name")).toHaveValue("Persisted Shop");
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Receipt no.", { exact: true })).toHaveValue(receiptNo);
});

test("templates can be applied from the New menu", async ({ page }) => {
  await page.getByRole("button", { name: "New receipt" }).click();
  await page.getByRole("button", { name: "From a template…" }).click();
  await page.getByRole("button", { name: /^Grocery/ }).click();
  await expect(paper(page)).toContainText(/segar mart/i);
  await expect(paper(page)).toContainText(/tax invoice/i);
});

test("saved shops store and apply the merchant", async ({ page }) => {
  await page.getByLabel("Store name").fill("Preset Cafe");
  await page.getByRole("button", { name: "Saved shops" }).click();
  await page.getByPlaceholder("Name, e.g. Kopitiam KL").fill("My cafe");
  await page.getByRole("button", { name: "Save current" }).click();
  await expect(page.getByText("Shop saved")).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  await page.getByLabel("Store name").fill("Something else");
  await page.getByRole("button", { name: "Saved shops" }).click();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByLabel("Store name")).toHaveValue("Preset Cafe");
});

test("language, theme and shortcuts live in Settings", async ({ page }) => {
  await page.locator("body").press("?");
  await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("radio", { name: "中文" }).click();
  await expect(page.getByRole("link", { name: "首页", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: "首页", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("desktop studio fits the viewport; only the editor panel scrolls", async ({ page }) => {
  // Regression: absolutely positioned sr-only inputs deep in the editor used to
  // stretch the document and make the whole page scroll into empty space.
  await goStep(page, "Look");
  await page.getByText("More options", { exact: true }).click();
  const { scrollHeight, innerHeight } = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  expect(scrollHeight).toBeLessThanOrEqual(innerHeight);
});

test("@mobile switches between Edit and Preview tabs", async ({ page }) => {
  await expect(page.getByRole("tab", { name: "Edit" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Store name")).toBeVisible();
  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByLabel("Store name")).toBeHidden();
  await expect(paper(page)).toBeInViewport();
  // Tapping a line on the paper goes back to the editor at that field.
  await paper(page).locator('[data-field="merchantName"]').click();
  await expect(page.getByLabel("Store name")).toBeFocused();
});

import { expect, test, type Page } from "@playwright/test";

// Note: the receipt uppercases text with CSS, so text assertions match case-insensitively.

const paper = (page: Page) => page.locator(".receipt-paper");

test.beforeEach(async ({ page }) => {
  await page.goto("/studio");
  await expect(paper(page)).toBeVisible();
});

test("editing the form updates the live receipt", async ({ page }) => {
  await page.getByLabel("Store name").fill("Kedai Test");
  await expect(paper(page)).toContainText(/kedai test/i);

  await page.getByLabel("Cashier").fill("siti");
  await expect(paper(page)).toContainText("CASHIER:");
  await expect(paper(page)).toContainText(/siti/i);
});

test("totals follow MY rules: service charge, SST and 5-sen cash rounding", async ({ page }) => {
  // Sample draft: 23.00 + 10% svc (2.30) + 6% SST (1.52) = 26.82 -> cash 26.80
  await expect(paper(page)).toContainText("SERVICE CHG 10%");
  await expect(paper(page)).toContainText("ROUNDING ADJ");
  await expect(paper(page).getByText("26.80")).toBeVisible();

  await page.getByLabel("Payment method").selectOption("CARD");
  await expect(paper(page)).not.toContainText("ROUNDING ADJ");
  await expect(paper(page).getByText("26.82")).toBeVisible();
});

test("Enter on the last item row adds a new row and focuses it", async ({ page }) => {
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
  const price = page.getByLabel("Item 1 unit price");
  await price.fill("3.5");
  await price.blur();
  await expect(price).toHaveValue("3.50");
});

test("items can be reordered from the keyboard", async ({ page }) => {
  const first = await page.getByLabel("Item 1 name").inputValue();
  await page.getByRole("button", { name: new RegExp(`^Reorder ${first}`) }).press("ArrowDown");
  await expect(page.getByLabel("Item 2 name")).toHaveValue(first);
});

test("exports a PNG at the chosen resolution and a PDF", async ({ page }) => {
  const [png] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /^PNG/ }).click()]);
  expect(png.suggestedFilename()).toMatch(/^ryannreceipt-.*@2x\.png$/);
  expect((await png.createReadStream()) !== null).toBe(true);

  await page.getByRole("button", { name: "More export options" }).click();
  await page.getByRole("radio", { name: "4x" }).click();
  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PDF" }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);

  const [png4] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /^PNG/ }).click()]);
  expect(png4.suggestedFilename()).toMatch(/@4x\.png$/);
});

test("drafts persist across reloads and New can be undone", async ({ page }) => {
  await page.getByLabel("Store name").fill("Persisted Shop");
  await page.reload();
  await expect(page.getByLabel("Store name")).toHaveValue("Persisted Shop");

  const receiptNo = await page.getByLabel("Receipt no.", { exact: true }).inputValue();
  await page.getByRole("button", { name: "New receipt" }).click();
  await expect(page.getByLabel("Receipt no.", { exact: true })).not.toHaveValue(receiptNo);
  // New keeps the merchant.
  await expect(page.getByLabel("Store name")).toHaveValue("Persisted Shop");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Receipt no.", { exact: true })).toHaveValue(receiptNo);
});

test("presets save and apply the merchant", async ({ page }) => {
  await page.getByLabel("Store name").fill("Preset Cafe");
  await page.getByRole("button", { name: "Presets" }).click();
  await page.getByLabel("New preset name").fill("My cafe");
  await page.getByRole("button", { name: "Save current" }).click();
  await expect(page.getByText("Preset saved")).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  await page.getByLabel("Store name").fill("Something else");
  await page.getByRole("button", { name: "Presets" }).click();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByLabel("Store name")).toHaveValue("Preset Cafe");
});

test("desktop studio fits the viewport; only the editor panel scrolls", async ({ page }) => {
  // Regression: absolutely positioned sr-only inputs deep in the editor used to
  // stretch the document and make the whole page scroll into empty space.
  const { scrollHeight, innerHeight } = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  expect(scrollHeight).toBeLessThanOrEqual(innerHeight);
  const editorScrolls = await page
    .getByRole("complementary", { name: "Receipt editor" })
    .evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(editorScrolls).toBe(true);
});

test("@mobile switches between Edit and Preview tabs", async ({ page }) => {
  await expect(page.getByRole("tab", { name: "Edit" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Store name")).toBeVisible();
  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByLabel("Store name")).toBeHidden();
  await expect(paper(page)).toBeInViewport();
});

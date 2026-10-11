import { expect, test } from "./fixtures";

async function quickAdd(page: import("@playwright/test").Page, line: string) {
  await page.getByRole("button", { name: "Quick add" }).first().click();
  await page.getByLabel("Expense", { exact: true }).fill(line);
  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByText(/^Added /).last()).toBeVisible();
}

test("split a bill with a friend and track who paid", async ({ page }) => {
  await page.goto("/history");
  await quickAdd(page, "dinner 30.00 card");
  await page.getByRole("button", { name: /^Actions for Dinner/ }).click();
  await page.getByRole("button", { name: "Split bill with friends" }).click();

  const dialog = page.getByRole("dialog", { name: "Split the bill" });
  await dialog.getByPlaceholder("Name, e.g. Ali").fill("Ali");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await dialog.getByRole("button", { name: "Split everything equally" }).click();
  const shares = dialog.locator("li", { hasText: "Ali" }).filter({ hasText: "15.00" });
  await expect(shares).toHaveCount(1);
  await shares.getByRole("button", { name: "Mark paid" }).click();
  await expect(shares.getByRole("button", { name: "Paid" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");

  // History counts only my half as spending.
  await expect(page.getByText("Split 2 · 0 unpaid")).toBeVisible();
});

test("import a bank statement CSV without duplicates", async ({ page }) => {
  const csv = [
    "Transaction Date,Description,Amount",
    "01/10/2026,POS DEBIT 123456 JAYA GROCER,-142.35",
    "02/10/2026,SALARY,5000.00",
    "03/10/2026,GRAB*RIDE 8877,-18.50",
  ].join("\n");
  const file = { name: "statement.csv", mimeType: "text/csv", buffer: Buffer.from(csv) };

  await page.goto("/history");
  await page.getByRole("button", { name: "Import CSV" }).click();
  const dialog = page.getByRole("dialog", { name: "Import a bank or e-wallet statement" });
  await dialog.locator('input[type="file"]').setInputFiles(file);
  await expect(dialog.getByText("Jaya Grocer")).toBeVisible();
  await expect(dialog.getByText("Salary")).toHaveCount(0);
  await dialog.screenshot({ path: "test-results/import-dialog.png" });
  await dialog.getByRole("button", { name: /^Import 2 · MYR 160\.85/ }).click();
  await expect(page.getByText("Imported 2 expense(s); 0 already existed")).toBeVisible();
  await expect(page.getByRole("link", { name: /Jaya Grocer/ })).toHaveCount(1);

  // Same file again: nothing new.
  await page.getByRole("button", { name: "Import CSV" }).click();
  await dialog.locator('input[type="file"]').setInputFiles(file);
  await dialog.getByRole("button", { name: /^Import 2/ }).click();
  await expect(page.getByText("Imported 0 expense(s); 2 already existed")).toBeVisible();
  await expect(page.getByRole("link", { name: /Jaya Grocer/ })).toHaveCount(1);
});

test("year review summarises spending", async ({ page }) => {
  await page.goto("/history");
  await quickAdd(page, "kopi 5.00 cash");
  await quickAdd(page, "kopi 5.00 cash");
  await page.getByRole("button", { name: "Year review" }).click();
  const dialog = page.getByRole("dialog", { name: "Your year in receipts" });
  await expect(dialog.getByText("FAVOURITE SHOPS")).toBeVisible();
  await expect(dialog.getByText("1. Kopi")).toBeVisible();
  await dialog.screenshot({ path: "test-results/year-review.png" });
  await expect(dialog.locator("div", { hasText: /^1. Kopi2×$/ })).toHaveCount(1);
});

test("app lock asks for the PIN after a reload", async ({ page }) => {
  await page.goto("/history");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "App lock" }).click();
  await page.getByLabel("New PIN (4–6 digits)").fill("2580");
  await page.getByLabel("Confirm PIN").fill("2580");
  await page.getByRole("button", { name: "Turn on lock" }).click();

  // A fresh session (new tab) is locked.
  const tab = await page.context().newPage();
  await tab.goto("/history");
  const lock = tab.getByRole("dialog", { name: "RyannReceipt is locked" });
  await expect(lock).toBeVisible();
  for (const d of "1111") await lock.getByRole("button", { name: d, exact: true }).click();
  await expect(lock.getByText("Wrong PIN. Try again.")).toBeVisible();
  for (const d of "2580") await lock.getByRole("button", { name: d, exact: true }).click();
  await expect(lock).toBeHidden();
  await expect(tab.getByRole("heading", { name: "History" })).toBeVisible();
});

test("share links need an account", async ({ page }) => {
  await page.goto("/history");
  await quickAdd(page, "lunch 12.00 cash");
  await page.getByRole("button", { name: /^Actions for Lunch/ }).click();
  await page.getByRole("button", { name: "Share link", exact: true }).click();
  await expect(page.getByText(/Sign in to create share links/)).toBeVisible();
});

test("back up and restore receipts", async ({ page }) => {
  await page.goto("/history");
  await quickAdd(page, "roti canai 3.50 cash");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Backup & restore" }).click();
  const dialog = page.getByRole("dialog", { name: "Backup & restore" });
  const downloading = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download backup" }).click();
  const file = await (await downloading).path();
  await expect(dialog.getByText(/^Last backup: /)).toBeVisible();
  await page.keyboard.press("Escape");

  // Lose the receipt, then bring it back from the file.
  await page.getByRole("button", { name: /^Actions for Roti Canai/ }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("link", { name: /Roti Canai/ })).toHaveCount(0);
  // Wait out the undo window so it's really gone from storage.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("ryannreceipt:draft")?.includes("Roti Canai")), { timeout: 10_000 })
    .toBe(false);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Backup & restore" }).click();
  await dialog.getByLabel("Restore from file").setInputFiles(file);
  await expect(page.getByText(/^Restored: 1 added/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Roti Canai/ })).toHaveCount(1);
});

test("privacy and terms are linked from the home page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  await page.getByRole("link", { name: "Terms" }).first().click();
  await expect(page.getByRole("heading", { name: "Terms of Use" })).toBeVisible();
});

test("@mobile phone tab bar adds spending from the + sheet", async ({ page }) => {
  await page.goto("/history");
  await page.waitForLoadState("networkidle");
  const tabs = page.getByRole("navigation", { name: "Main" });
  await expect(tabs.getByRole("link", { name: "History" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("button", { name: "Add spending" }).click();
  await page.getByRole("dialog", { name: "Add spending" }).getByRole("button", { name: /^Quick add/ }).click();
  await page.getByLabel("Expense", { exact: true }).fill("teh tarik 3.20 cash");
  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Teh Tarik/ })).toBeVisible();
});

test("@mobile swipe a row right to split, left to delete", async ({ page }) => {
  await page.goto("/history");
  await page.waitForLoadState("networkidle");
  const row = page.getByRole("link", { name: /Ryann Kopitiam/ }).locator("..");
  const swipe = async (dx: number) => {
    const box = (await row.boundingBox())!;
    const y = box.y + box.height / 2;
    const x = box.x + box.width / 2;
    const ev = (type: string, clientX: number) =>
      row.dispatchEvent(type, { pointerType: "touch", pointerId: 7, isPrimary: true, clientX, clientY: y, bubbles: true });
    await ev("pointerdown", x);
    for (let i = 1; i <= 6; i++) await ev("pointermove", x + (dx * i) / 6);
    await ev("pointerup", x + dx);
  };

  await swipe(120);
  await expect(page.getByRole("dialog", { name: "Split the bill" })).toBeVisible();
  await page.keyboard.press("Escape");

  await swipe(-120);
  await expect(page.getByText(/^Deleted/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Ryann Kopitiam/ })).toHaveCount(0);
});

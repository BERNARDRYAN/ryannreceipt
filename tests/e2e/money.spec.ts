import { addButton, expect, test } from "./fixtures";

async function quickAdd(page: import("@playwright/test").Page, line: string) {
  await page.getByRole("button", { name: "Quick add" }).first().click();
  await page.getByLabel("Expense", { exact: true }).fill(line);
  await addButton(page).click();
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
  await expect(tab.getByRole("heading", { name: "Spending" })).toBeVisible();
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
  await expect(tabs.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  // One tap: the + opens Add expense directly.
  await tabs.getByRole("button", { name: "Add spending" }).click();
  await page.getByLabel("Expense", { exact: true }).fill("teh tarik 3.20 cash");
  await addButton(page).click();
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

test("saved friends can be forgotten (with undo)", async ({ page }) => {
  await page.goto("/history");
  await quickAdd(page, "dinner 30.00 card");
  await page.getByRole("button", { name: /^Actions for Dinner/ }).click();
  await page.getByRole("button", { name: "Split bill with friends" }).click();
  const dialog = page.getByRole("dialog", { name: "Split the bill" });
  await dialog.getByPlaceholder("Name, e.g. Ali").fill("Akao");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await dialog.getByRole("button", { name: "Remove Akao" }).click();

  // Akao is now a saved suggestion; forget it.
  await expect(dialog.getByRole("button", { name: "+ Akao" })).toBeVisible();
  await dialog.getByRole("button", { name: "Forget Akao" }).click();
  await expect(dialog.getByRole("button", { name: "+ Akao" })).toHaveCount(0);
  await dialog.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(dialog.getByRole("button", { name: "+ Akao" })).toBeVisible();
});

test("add a warranty from Home in a few taps; empty tools fold back", async ({ page }) => {
  await page.goto("/history");
  await quickAdd(page, "laptop 3999 card");

  await page.getByRole("button", { name: /^Warranty tracker/ }).click();
  const tracker = page.locator("section", { has: page.getByRole("heading", { name: "Warranty tracker" }) });
  await tracker.getByRole("button", { name: "Add", exact: true }).click();
  const laptop = await tracker.locator("option", { hasText: "Laptop" }).getAttribute("value");
  await tracker.getByLabel("Which purchase?").selectOption(laptop!);
  await tracker.getByRole("button", { name: "2 years" }).click();
  await tracker.getByRole("button", { name: "Save warranty" }).click();
  await expect(page.getByText(/Warranty for Laptop saved until/)).toBeVisible();
  await expect(tracker.getByText(/\d+ days left/)).toBeVisible();

  // An empty tool opened from More tools can be folded back.
  await page.getByRole("button", { name: /^Recurring/ }).click();
  await expect(page.getByRole("heading", { name: "Recurring" })).toBeVisible();
  await page.getByRole("button", { name: "Fold back into More tools" }).click();
  await expect(page.getByRole("heading", { name: "Recurring" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Recurring/ })).toBeVisible();
});

test("tap an expense to edit it in the simple sheet", async ({ page }) => {
  await page.goto("/history");
  await quickAdd(page, "teh tarik 3.20 cash");
  await page.getByRole("link", { name: /Teh Tarik/ }).click();

  const sheet = page.getByRole("dialog", { name: "Edit expense" });
  await expect(sheet.getByLabel("Expense", { exact: true })).toHaveValue("Teh Tarik");
  await sheet.getByLabel("Amount", { exact: true }).fill("4.50");
  await sheet.getByRole("radio", { name: "Groceries" }).click();
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved")).toBeVisible();
  const row = page.getByRole("link", { name: /Teh Tarik/ });
  await expect(row).toContainText("4.50");
  await expect(row).toContainText("Groceries");
  await expect(page).toHaveURL(/\/history$/);

  // An itemised receipt keeps its amount; items are edited in the receipt maker.
  await page.getByRole("link", { name: /Ryann Kopitiam/ }).click();
  await expect(sheet.getByText(/Itemised receipt/)).toBeVisible();
  await expect(sheet.getByLabel("Amount", { exact: true })).toHaveAttribute("readonly", "");
  await sheet.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("link", { name: /Ryann Kopitiam/ })).toHaveCount(0);
});

test("a bill paid two months in a row is offered as recurring", async ({ page }) => {
  await page.goto("/history");
  const d = new Date();
  const lastMonth = new Date(d.getFullYear(), d.getMonth() - 1, Math.min(d.getDate(), 28));
  const ymd = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  // Last month's bill, dated through "Paid with".
  await page.getByRole("button", { name: "Quick add" }).first().click();
  await page.getByLabel("Expense", { exact: true }).fill("unifi 139 card");
  await page.getByRole("button", { name: /^Paid with/ }).click();
  await page.getByLabel("Date", { exact: true }).fill(ymd(lastMonth));
  await addButton(page).click();
  await quickAdd(page, "unifi 139 card");

  await expect(page.getByText("Unifi looks like a monthly bill")).toBeVisible();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(page.getByText(/Unifi will now log itself each month/)).toBeVisible();
  await expect(page.getByText("Unifi looks like a monthly bill")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Recurring" })).toBeVisible();
});

test("income shows what's left to spend this month", async ({ page }) => {
  await page.goto("/history");
  await page.getByRole("button", { name: /^Income/ }).click();
  const sheet = page.getByRole("dialog", { name: "Add income" });
  await expect(sheet.getByRole("tab", { name: "Income" })).toHaveAttribute("aria-selected", "true");
  await sheet.getByLabel("Amount", { exact: true }).fill("4000");
  await sheet.getByPlaceholder(/Salary/).fill("Salary");
  await expect(sheet.getByRole("radio", { name: "Every month" })).toHaveAttribute("aria-checked", "true");
  await sheet.getByRole("button", { name: "Add MYR 4,000.00" }).click();
  await expect(page.getByText("MYR 4,000.00 will count every month")).toBeVisible();

  // The sample receipt (MYR 26.80) is this month's only spending.
  await expect(page.getByText(/^Left to spend in/)).toBeVisible();
  await expect(page.getByText("MYR 3,973.20")).toBeVisible();
  await expect(page.getByText(/Income MYR 4,000\.00 · 99% kept/)).toBeVisible();

  // Monthly income started this month can be removed outright.
  await page.getByRole("button", { name: "Remove Salary" }).click();
  await expect(page.getByText(/^Left to spend in/)).toHaveCount(0);
});

test("split a quick expense by what each person had, with service charge and SST", async ({ page }) => {
  await page.goto("/history");
  await quickAdd(page, "kopitiam 50 cash");
  await page.getByRole("button", { name: /^Actions for Kopitiam/ }).click();
  await page.getByRole("button", { name: "Split bill with friends" }).click();
  const dialog = page.getByRole("dialog", { name: "Split the bill" });
  await dialog.getByPlaceholder("Name, e.g. Ali").fill("Ali");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByText(/This expense is one amount \(MYR 50\.00\)/)).toBeVisible();

  const who = dialog.getByLabel("Who had it");
  const price = dialog.getByLabel("Price");
  const add = dialog.getByRole("button", { name: "Add to the bill" });
  await who.selectOption({ label: "Ali" });
  await price.fill("12.50");
  await add.click();
  await who.selectOption({ label: "Me" });
  await price.fill("15");
  await add.click();
  await who.selectOption({ label: "Everyone (shared)" });
  await dialog.getByLabel("What (optional)").fill("Teh pot");
  await price.fill("8");
  await add.click();

  await dialog.getByRole("button", { name: "10%" }).click();
  await dialog.getByRole("button", { name: "SST 6%" }).click();

  // Ali: 12.50 + 4.00 shared = 16.50, +10% = 18.15, +6% = 19.24. Bill 41.39, so me 22.15.
  await expect(dialog.getByText("MYR 41.39")).toBeVisible();
  const ali = dialog.locator("li", { hasText: "Ali" }).filter({ hasText: "MYR 19.24" });
  await expect(ali).toHaveCount(1);
  await expect(dialog.locator("li", { hasText: "paid the bill" }).filter({ hasText: "MYR 22.15" })).toHaveCount(1);
  await ali.getByRole("button", { name: "Mark paid" }).click();
  await expect(ali.getByRole("button", { name: "Paid" })).toBeVisible();
});

test("@mobile a very long shop name never makes the page scroll sideways", async ({ page }) => {
  await page.goto("/history");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Add spending" }).click();
  await page.getByLabel("Amount", { exact: true }).fill("48.50");
  await page.getByLabel("Expense", { exact: true }).fill("KKV Business Management SDN.BHD Kuala Lumpur Branch Outlet");
  await addButton(page).click();
  await expect(page.getByRole("link", { name: /KKV/ })).toBeVisible();
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(width);
});

import { expect, goStep, test } from "./fixtures";

test("receipts made in the studio appear in History with summaries", async ({ page }) => {
  await page.goto("/studio");
  await page.getByLabel("Store name").fill("History Mart");
  await goStep(page, "Payment");
  await page.getByLabel("Warranty until").fill("2099-01-31");

  await page.getByRole("link", { name: "History", exact: true }).click();
  await expect(page.getByRole("heading", { name: "History", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /History Mart/ }).first()).toBeVisible();
  await expect(page.getByText("Monthly spend")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Warranty tracker" })).toBeVisible();
  await expect(page.getByText(/days left/)).toBeVisible();

  // Search filters the list.
  await page.getByPlaceholder("Search merchant or no.").fill("no-such-shop");
  await expect(page.getByText("No receipts match these filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("link", { name: /History Mart/ }).first()).toBeVisible();

  // CSV export of the (filtered) list.
  const [csv] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);
});

test("a monthly budget shows progress on the spend tile", async ({ page }) => {
  await page.goto("/studio");
  await page.goto("/history");
  await page.getByRole("button", { name: "Set a monthly budget" }).click();
  await page.getByLabel(/^Budget/).fill("1000");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("meter")).toBeVisible();
  await expect(page.getByText(/% of MYR 1,000.00/)).toBeVisible();
});

test("deleting from History can be undone", async ({ page }) => {
  await page.goto("/studio");
  await page.getByLabel("Store name").fill("Undo Store");
  await page.goto("/history");

  await page.getByRole("button", { name: /^Actions for Undo Store/ }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("link", { name: /Undo Store/ })).toHaveCount(0);
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("link", { name: /Undo Store/ }).first()).toBeVisible();
});

test("landing page leads to the studio", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Receipts that look printed.");
  await expect(page.locator(".receipt-paper")).toContainText(/ryann kopitiam/i);
  await page.getByRole("link", { name: "Make a receipt" }).click();
  await expect(page).toHaveURL(/\/studio$/);
});

test("PWA manifest and service worker are served", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).icons).toHaveLength(3);
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-store");
});

test.describe("BFF security", () => {
  test("receipt APIs require a session", async ({ request, baseURL }) => {
    expect((await request.get("/api/receipts")).status()).toBe(401);
    const res = await request.post("/api/receipts", {
      headers: { Origin: baseURL! },
      data: { receipts: [] },
    });
    expect(res.status()).toBe(401);
  });

  test("cross-site writes are rejected before auth", async ({ request }) => {
    const res = await request.post("/api/receipts", {
      headers: { Origin: "https://evil.example" },
      data: { receipts: [] },
    });
    expect(res.status()).toBe(403);
    const del = await request.delete("/api/account", { headers: { Origin: "https://evil.example" } });
    expect(del.status()).toBe(403);
  });

  test("security headers are present", async ({ request }) => {
    const res = await request.get("/studio");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
  });
});

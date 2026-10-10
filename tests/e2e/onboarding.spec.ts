import { expect, test } from "@playwright/test";

// A brand-new visitor: no stored preferences.

test("first visit: template gallery, then a three-step tour, then never again", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: "Start from a template" })).toBeVisible();
  await page.getByRole("button", { name: /^Electronics/ }).click();
  await expect(page.locator(".receipt-paper")).toContainText(/volt electronics/i);
  await expect(page.locator(".receipt-paper")).toContainText("WARRANTY VALID UNTIL");

  const tour = page.getByRole("dialog", { name: "1. Fill in the details" });
  await expect(tour).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "2. Watch it print" })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "3. Export or keep it" })).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByRole("dialog", { name: /Export or keep it/ })).toHaveCount(0);

  // Afterwards the sign-in value banner explains why to back up.
  await expect(page.getByText(/only saved in this browser/)).toBeVisible();

  await page.reload();
  await expect(page.locator(".receipt-paper")).toContainText(/volt electronics/i);
  await expect(page.getByRole("heading", { name: "Start from a template" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: /Fill in the details/ })).toHaveCount(0);
});

test("the gallery can be skipped to keep the sample receipt", async ({ page }) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: "Keep my current receipt" }).click();
  await expect(page.locator(".receipt-paper")).toContainText(/ryann kopitiam/i);
  await page.getByRole("button", { name: "Skip" }).first().click();
  await expect(page.getByRole("dialog", { name: /Fill in the details/ })).toHaveCount(0);
});

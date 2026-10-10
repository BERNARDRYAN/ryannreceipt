import { test as base, expect, type Page } from "@playwright/test";

/** Preferences of a returning visitor: onboarding done, banner dismissed, English. */
export const RETURNING_PREFS = {
  state: {
    locale: "en",
    theme: "system",
    guideDone: true,
    templatesSeen: true,
    signInBannerDismissed: true,
    budgets: {},
    lastSerial: 0,
  },
  version: 1,
};

/**
 * `test` with a returning visitor's prefs (no template gallery or tour), unless
 * the test already stored its own. Use `@playwright/test` directly for first-visit tests.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addInitScript((prefs) => {
      if (!localStorage.getItem("ryannreceipt:prefs")) {
        localStorage.setItem("ryannreceipt:prefs", JSON.stringify(prefs));
      }
    }, RETURNING_PREFS);
    await provide(page);
  },
});

export { expect };

export const paper = (page: Page) => page.locator(".receipt-paper").first();

/** Jump to an editor step by its label (Shop, Items, Payment, Look). */
export async function goStep(page: Page, label: "Shop" | "Items" | "Payment" | "Look") {
  await page
    .getByRole("navigation", { name: "Receipt editor" })
    .getByRole("button", { name: new RegExp(`${label}$`) })
    .click();
}

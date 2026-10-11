import { test as base, expect, type Page } from "@playwright/test";

/** Preferences of a returning visitor: onboarding done, banner dismissed, English. */
export const RETURNING_PREFS = {
  state: {
    locale: "en",
    theme: "system",
    guideDone: true,
    setupDone: true,
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

/** Open a collapsed "More options" section in the editor by its title. */
export async function openMore(page: Page, title: string) {
  const details = page.locator("details", { has: page.locator("summary", { hasText: title }) });
  if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open))) await details.locator("summary").click();
}

/** The Add expense submit button ("Add expense", or "Add MYR 12.90" once filled in). */
export const addButton = (page: Page) => page.getByRole("button", { name: /^Add (expense|[A-Z]{3} [\d.,]+)$/ });

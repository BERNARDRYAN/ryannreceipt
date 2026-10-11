import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./fixtures";

const PAGES = ["/", "/studio", "/history", "/privacy", "/terms"];

for (const scheme of ["light", "dark"] as const) {
  for (const path of PAGES) {
    test(`no accessibility violations on ${path} (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        // The receipt paper is a deliberate printed-ink look (and is exported as an image).
        .exclude(".receipt-paper")
        .analyze();
      const summary = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.slice(0, 4).map((n) => `${n.target.join(" ")} :: ${n.failureSummary?.split("\n")[1] ?? ""}`),
      }));
      expect(summary).toEqual([]);
    });
  }
}

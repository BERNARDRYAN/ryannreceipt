import { describe, expect, it } from "vitest";

import { incomeInMonth, incomeTotal, leftToSpend } from "@/lib/income";
import { userSettingsSchema, type Income } from "@/lib/validators/receipt-schema";
import { EMPTY_SETTINGS } from "@/lib/store/settings-store";

const inc = (over: Partial<Income>): Income => ({
  id: crypto.randomUUID(),
  name: "Salary",
  amount: 4000,
  currency: "MYR",
  date: "2026-08-25",
  monthly: true,
  until: "",
  ...over,
});

describe("income", () => {
  it("counts monthly income from its start month until it stops, one-offs once", () => {
    const salary = inc({});
    const bonus = inc({ name: "Bonus", amount: 1500, monthly: false, date: "2026-10-03" });
    const oldJob = inc({ name: "Old job", amount: 3000, date: "2026-01-25", until: "2026-07" });
    const list = [salary, bonus, oldJob];
    expect(incomeInMonth(list, "2026-07").map((i) => i.name)).toEqual(["Old job"]);
    expect(incomeInMonth(list, "2026-09").map((i) => i.name)).toEqual(["Salary"]);
    expect(incomeTotal(list, "2026-10", "MYR", null)).toBe(5500);
  });

  it("converts other currencies when rates are known, skips them otherwise", () => {
    const list = [inc({}), inc({ name: "Freelance", amount: 100, currency: "USD", monthly: false, date: "2026-10-01" })];
    expect(incomeTotal(list, "2026-10", "MYR", null)).toBe(4000);
    const fx = { date: "2026-10-10", rates: { EUR: 1, MYR: 5, USD: 1.1 } };
    expect(incomeTotal(list, "2026-10", "MYR", fx)).toBe(4454.55);
  });

  it("works out what's left and the share saved", () => {
    expect(leftToSpend(4000, 3000)).toEqual({ left: 1000, savedPct: 25 });
    expect(leftToSpend(4000, 4500)).toEqual({ left: -500, savedPct: -12 });
    expect(leftToSpend(0, 100)).toBeNull();
  });

  it("older settings without income still load", () => {
    const old: Record<string, unknown> = { ...EMPTY_SETTINGS };
    delete old.income;
    expect(userSettingsSchema.parse(old).income).toEqual([]);
  });
});

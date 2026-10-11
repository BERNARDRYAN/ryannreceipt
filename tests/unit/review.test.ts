import { describe, expect, it } from "vitest";

import type { HistoryEntry } from "@/lib/history/entries";
import { reviewYears, yearReview } from "@/lib/history/review";

const entry = (receiptDate: string, spent: number, merchantName: string, category: HistoryEntry["category"] = "Food & Drink"): HistoryEntry => ({
  id: crypto.randomUUID(),
  title: "Receipt",
  merchantName,
  receiptNo: "",
  receiptDate,
  currency: "MYR",
  total: spent,
  spent,
  split: null,
  category,
  warrantyUntil: "",
  isPinned: false,
  paymentMethod: "CASH",
  wallet: "",
  tags: [],
  taxRelief: "",
  synced: true,
  local: true,
});

const entries = [
  entry("2025-12-30T12:00", 100, "Old Shop"),
  entry("2026-01-05T12:00", 10, "Kopitiam"), // Monday
  entry("2026-01-12T12:00", 12, "kopitiam"), // Monday
  entry("2026-03-07T12:00", 300, "Harvey Norman", "Electronics"), // Saturday
  entry("2026-03-08T12:00", 20.5, "Jaya Grocer", "Groceries"),
];

describe("yearReview", () => {
  it("summarises a year", () => {
    const r = yearReview(entries, "2026", "2026-04-15");
    expect(r.total).toBe(342.5);
    expect(r.count).toBe(4);
    expect(r.months.slice(0, 4)).toEqual([22, 0, 320.5, 0]);
    expect(r.monthlyAvg).toBe(85.63); // 342.5 / 4 months so far
    expect(r.biggestMonth).toEqual({ index: 2, total: 320.5 });
    expect(r.busiestWeekday).toEqual({ day: 1, count: 2 });
    expect(r.topCategories[0]).toEqual({ key: "Electronics", total: 300 });
    expect(r.topShops[0]).toEqual({ name: "Kopitiam", total: 22, count: 2 });
    expect(r.biggestReceipt).toEqual({ name: "Harvey Norman", total: 300, date: "2026-03-07" });
    expect(r.previousTotal).toBe(100);
  });

  it("handles an empty year", () => {
    const r = yearReview(entries, "2024", "2026-04-15");
    expect(r).toMatchObject({ total: 0, count: 0, biggestMonth: null, busiestWeekday: null, biggestReceipt: null, previousTotal: null });
  });

  it("lists years newest first", () => {
    expect(reviewYears(entries)).toEqual(["2026", "2025"]);
  });
});

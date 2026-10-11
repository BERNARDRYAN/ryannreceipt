import { describe, expect, it } from "vitest";

import type { HistoryEntry } from "@/lib/history/entries";
import { pickInsight } from "@/lib/history/insights";

const e = (date: string, spent: number, category: HistoryEntry["category"] = "Food & Drink"): HistoryEntry => ({
  id: crypto.randomUUID(),
  title: "",
  merchantName: "Shop",
  receiptNo: "",
  receiptDate: `${date}T12:00`,
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

describe("pickInsight", () => {
  it("calls out the category that changed most, comparing the same days", () => {
    const entries = [
      e("2026-09-03", 100),
      e("2026-09-05", 50, "Transport"),
      e("2026-09-25", 999), // after 10 Sep: not compared
      e("2026-10-04", 40),
      e("2026-10-06", 50, "Transport"),
    ];
    expect(pickInsight(entries, "2026-10-10")).toEqual({ kind: "category", category: "Food & Drink", pct: 60, direction: "down" });
  });

  it("falls back to the month total when no category stands out", () => {
    const entries = [e("2026-09-02", 50), e("2026-09-03", 50, "Transport"), e("2026-10-02", 60), e("2026-10-03", 60, "Transport")];
    expect(pickInsight(entries, "2026-10-10")).toEqual({ kind: "month", pct: 20, direction: "up" });
  });

  it("celebrates a logging streak when there's nothing to compare", () => {
    const entries = [e("2026-10-08", 5), e("2026-10-09", 5), e("2026-10-10", 5)];
    expect(pickInsight(entries, "2026-10-10")).toEqual({ kind: "streak", days: 3 });
    expect(pickInsight(entries.slice(1), "2026-10-10")).toBeNull();
  });

  it("handles January and short months", () => {
    const entries = [e("2025-12-31", 100), e("2026-01-01", 10)];
    expect(pickInsight(entries, "2026-01-31")).toEqual({ kind: "category", category: "Food & Drink", pct: 90, direction: "down" });
    expect(pickInsight([e("2026-02-28", 100), e("2026-03-30", 50)], "2026-03-31")).toMatchObject({ direction: "down", pct: 50 });
  });
});

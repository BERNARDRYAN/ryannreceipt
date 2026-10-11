import { describe, expect, it } from "vitest";

import type { HistoryEntry } from "@/lib/history/entries";
import { detectRepeats, ruleFromSuggestion } from "@/lib/recurring/detect";
import { dueDates } from "@/lib/recurring/schedule";

const e = (date: string, merchantName: string, spent: number, tags: string[] = []): HistoryEntry => ({
  id: crypto.randomUUID(),
  title: "",
  merchantName,
  receiptNo: "",
  receiptDate: `${date}T12:00`,
  currency: "MYR",
  total: spent,
  spent,
  split: null,
  category: "Utilities",
  warrantyUntil: "",
  isPinned: false,
  paymentMethod: "CARD",
  wallet: "Maybank",
  tags,
  taxRelief: "",
  synced: true,
  local: true,
});

const today = "2026-10-11";

describe("detectRepeats", () => {
  it("finds a bill paid once a month in a row", () => {
    const out = detectRepeats([e("2026-09-05", "TNB Bill", 87.2), e("2026-10-06", "TNB bill", 92.1)], [], today);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: "TNB bill", amount: 89.65, day: 6, lastDate: "2026-10-06", wallet: "Maybank" });
  });

  it("ignores habits, one-offs, gaps and very different amounts", () => {
    const coffee = [e("2026-09-02", "Kopi", 5), e("2026-09-20", "Kopi", 5), e("2026-10-03", "Kopi", 5)];
    const once = [e("2026-10-01", "IKEA", 400)];
    const gap = [e("2026-08-10", "Gym", 120), e("2026-10-10", "Gym", 120)];
    const swing = [e("2026-09-10", "Shopee", 30), e("2026-10-10", "Shopee", 300)];
    expect(detectRepeats([...coffee, ...once, ...gap, ...swing], [], today)).toEqual([]);
  });

  it("skips bills already covered by a rule, logged by one, or dismissed", () => {
    const bills = [e("2026-09-05", "Unifi", 139), e("2026-10-05", "Unifi", 139)];
    const s = detectRepeats(bills, [], today)[0];
    expect(detectRepeats(bills, [ruleFromSuggestion(s, crypto.randomUUID())], today)).toEqual([]);
    expect(detectRepeats(bills, [], today, [s.key])).toEqual([]);
    expect(detectRepeats(bills.map((b) => ({ ...b, tags: ["recurring"] })), [], today)).toEqual([]);
  });

  it("makes a rule that starts after the last bill", () => {
    const [s] = detectRepeats([e("2026-09-05", "Unifi", 139), e("2026-10-05", "Unifi", 139)], [], today);
    const rule = ruleFromSuggestion(s, crypto.randomUUID());
    expect(rule).toMatchObject({ frequency: "monthly", day: 5, startDate: "2026-10-06", amount: 139 });
    // Nothing is logged twice: the next one is due in November.
    expect(dueDates(rule, today)).toEqual([]);
    expect(dueDates(rule, "2026-11-05")).toEqual(["2026-11-05"]);
  });
});

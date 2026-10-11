import { describe, expect, it } from "vitest";

import { createBlankDraft } from "@/lib/receipts/defaults";
import { computeSplit, myShareOf, newSplit, splitEqually, splitSummary } from "@/lib/split/calc";
import { computeTotals } from "@/lib/utils/currency";
import { receiptDraftSchema, type ReceiptDraft, type Split } from "@/lib/validators/receipt-schema";

const ids = { rice: crypto.randomUUID(), teh: crypto.randomUUID(), fried: crypto.randomUUID() };

/** Dinner: Ali's nasi lemak, 2 teh tarik (Ali + Raj), fried rice for all three. */
function dinner(overrides: Partial<ReceiptDraft> = {}): ReceiptDraft {
  return {
    ...createBlankDraft(),
    currency: "MYR",
    serviceChargeRate: 10,
    taxRate: 6,
    roundCash: true,
    paymentMethod: "CASH",
    items: [
      { id: ids.rice, name: "Nasi Lemak", qty: 1, price: 12.9 },
      { id: ids.teh, name: "Teh Tarik", qty: 2, price: 3.2 },
      { id: ids.fried, name: "Fried Rice", qty: 1, price: 15 },
    ],
    ...overrides,
  };
}

const people = [
  { id: "ali", name: "Ali" },
  { id: "raj", name: "Raj" },
];

function assigned(): Split {
  return {
    ...newSplit("Me", people),
    shares: {
      [ids.rice]: { ali: 1 },
      [ids.teh]: { ali: 1, raj: 1 },
      [ids.fried]: { me: 1, ali: 1, raj: 1 },
    },
  };
}

describe("computeSplit", () => {
  it("gives whole units at unit price and shares the rest proportionally", () => {
    const draft = dinner();
    const r = computeSplit(draft, assigned());
    const ali = r.people.find((p) => p.id === "ali")!;
    expect(ali.items.map((i) => [i.name, i.qty, i.price])).toEqual([
      ["Nasi Lemak", 1, 12.9],
      ["Teh Tarik", 1, 3.2],
      ["Fried Rice (1/3)", 1, 5],
    ]);
    // 21.10 + 10% svc 2.11 = 23.21, + 6% SST 1.39 = 24.60
    expect(ali.subtotal).toBe(21.1);
    expect(ali.serviceCharge).toBe(2.11);
    expect(ali.total).toBe(24.6);
  });

  it("always adds up to the bill, with the payer absorbing rounding", () => {
    const draft = dinner();
    const r = computeSplit(draft, assigned());
    const sum = r.people.reduce((s, p) => s + p.total, 0);
    expect(Math.round(sum * 100) / 100).toBe(computeTotals(draft).payable);
    expect(r.people.find((p) => p.id === "me")!.isPayer).toBe(true);
  });

  it("tracks who still owes the payer", () => {
    const draft = dinner();
    const split = { ...assigned(), paid: { ali: "2026-10-12T10:00:00.000Z" } };
    const r = computeSplit(draft, split);
    expect(r.people.find((p) => p.id === "ali")!.paid).toBe(true);
    expect(r.outstanding).toBe(r.people.find((p) => p.id === "raj")!.total);
  });

  it("shares a discount in proportion to what people ordered", () => {
    const draft = dinner({ discountAmount: 10, serviceChargeRate: 0, taxRate: 0, roundCash: false });
    const r = computeSplit(draft, assigned());
    const discounts = r.people.map((p) => p.discount);
    expect(Math.round(discounts.reduce((a, b) => a + b, 0) * 100) / 100).toBeCloseTo(10, 1);
  });

  it("counts unassigned lines on the payer", () => {
    const draft = dinner();
    const r = computeSplit(draft, { ...newSplit("Me", people), shares: { [ids.rice]: { ali: 1 } } });
    expect(r.unassigned.map((i) => i.name)).toEqual(["Teh Tarik", "Fried Rice"]);
    expect(r.people.find((p) => p.id === "me")!.total).toBeGreaterThan(20);
  });

  it("splits everything equally in one go", () => {
    const draft = dinner({ serviceChargeRate: 0, taxRate: 0, roundCash: false });
    const r = computeSplit(draft, splitEqually(draft, newSplit("Me", people)));
    // 34.30 / 3 = 11.43…, payer takes the leftover cent.
    expect(r.people.map((p) => p.total).sort()).toEqual([11.43, 11.43, 11.44]);
  });
});

describe("my spending", () => {
  it("is my share when split, the whole bill otherwise", () => {
    const draft = dinner();
    expect(myShareOf(draft)).toBe(computeTotals(draft).payable);
    const split = { ...draft, split: assigned() };
    expect(myShareOf(split)).toBeLessThan(computeTotals(draft).payable);
    expect(splitSummary(split)!.people).toHaveLength(3);
    expect(receiptDraftSchema.safeParse(split).success).toBe(true);
  });

  it("when a friend paid, I owe them my share", () => {
    const draft = dinner();
    const split = { ...assigned(), payerId: "ali" };
    const r = computeSplit(draft, split);
    const me = r.people.find((p) => p.id === "me")!;
    expect(me.isPayer).toBe(false);
    expect(me.paid).toBe(false);
    expect(r.outstanding).toBeGreaterThan(0);
  });
});

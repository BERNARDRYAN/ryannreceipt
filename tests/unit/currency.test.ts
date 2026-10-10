import { describe, expect, it } from "vitest";

import { computeTotals, formatAmount, formatInputAmount, lineTotal } from "@/lib/utils/currency";

const item = (qty: number, price: number) => ({ id: crypto.randomUUID(), name: "x", qty, price });

const base = {
  currency: "MYR" as const,
  items: [item(2, 2.8), item(1, 4.5), item(1, 12.9)],
  taxRate: 0,
  taxInclusive: false,
  serviceChargeRate: 0,
  discountAmount: 0,
  roundCash: false,
  amountTendered: 0,
  paymentMethod: "CARD" as const,
};

describe("computeTotals", () => {
  it("sums line items without float drift", () => {
    expect(computeTotals({ ...base, items: [item(3, 0.1)] }).subtotal).toBe(0.3);
    expect(computeTotals(base).subtotal).toBe(23);
  });

  it("applies exclusive tax after discount", () => {
    const t = computeTotals({ ...base, taxRate: 6, discountAmount: 3 });
    expect(t.discount).toBe(3);
    expect(t.taxAmount).toBe(1.2);
    expect(t.total).toBe(21.2);
  });

  it("charges service before tax (MY F&B convention)", () => {
    const t = computeTotals({ ...base, serviceChargeRate: 10, taxRate: 6 });
    expect(t.serviceCharge).toBe(2.3);
    expect(t.taxAmount).toBe(1.52); // 6% of 25.30 = 1.518
    expect(t.total).toBe(26.82);
  });

  it("extracts inclusive tax without changing the total", () => {
    const t = computeTotals({ ...base, items: [item(1, 106)], taxRate: 6, taxInclusive: true });
    expect(t.taxAmount).toBe(6);
    expect(t.total).toBe(106);
  });

  it("caps discount at the subtotal", () => {
    const t = computeTotals({ ...base, discountAmount: 999 });
    expect(t.discount).toBe(23);
    expect(t.total).toBe(0);
  });

  it.each([
    [10.01, 10.0],
    [10.02, 10.0],
    [10.03, 10.05],
    [10.04, 10.05],
    [10.06, 10.05],
    [10.07, 10.05],
    [10.08, 10.1],
    [10.09, 10.1],
  ])("rounds cash %s to %s", (price, payable) => {
    const t = computeTotals({ ...base, items: [item(1, price)], paymentMethod: "CASH", roundCash: true });
    expect(t.payable).toBe(payable);
    expect(t.rounding).toBeCloseTo(payable - price, 10);
  });

  it("does not round card payments or zero-decimal currencies", () => {
    expect(computeTotals({ ...base, items: [item(1, 10.03)], roundCash: true }).rounding).toBe(0);
    const jpy = computeTotals({
      ...base,
      currency: "JPY",
      items: [item(1, 1003)],
      paymentMethod: "CASH",
      roundCash: true,
    });
    expect(jpy.rounding).toBe(0);
  });

  it("computes change from tendered cash only", () => {
    const cash = computeTotals({ ...base, paymentMethod: "CASH", amountTendered: 50 });
    expect(cash.change).toBe(27);
    const card = computeTotals({ ...base, amountTendered: 50 });
    expect(card.change).toBe(0);
    expect(card.tendered).toBe(0);
  });
});

describe("formatting", () => {
  it("formats per currency decimals", () => {
    expect(formatAmount(1234.5, "MYR")).toBe("1,234.50");
    expect(formatAmount(1234.5, "JPY")).toBe("1,235");
    expect(formatInputAmount(2.8, "MYR")).toBe("2.80");
    expect(lineTotal({ qty: 3, price: 1.1 }, "MYR")).toBe(3.3);
  });
});

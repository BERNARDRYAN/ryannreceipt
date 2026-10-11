import { describe, expect, it } from "vitest";

import { parseQuickAdd } from "@/lib/quick-add/parse";
import { draftForOccurrence, dueDates, nextDueDate, occurrenceId } from "@/lib/recurring/schedule";
import { parseReceiptText, reconcileItems } from "@/lib/scan/parse-receipt";
import type { RecurringRule } from "@/lib/validators/receipt-schema";
import { receiptDraftSchema } from "@/lib/validators/receipt-schema";

const TODAY = "2026-10-11"; // a Sunday

describe("parseQuickAdd", () => {
  it("reads amount, name, category and e-wallet", () => {
    const p = parseQuickAdd("nasi lemak 12.90 tng", TODAY);
    expect(p.amount).toBe(12.9);
    expect(p.name).toBe("Nasi Lemak");
    expect(p.category).toBe("Food & Drink");
    expect(p.paymentMethod).toBe("E-WALLET");
    expect(p.wallet).toBe("Touch 'n Go eWallet");
    expect(p.date).toBeNull();
  });

  it("handles currency marks, relative dates and tags", () => {
    const p = parseQuickAdd("Grab RM18.50 yesterday #work #claim", TODAY);
    expect(p.amount).toBe(18.5);
    expect(p.date).toBe("2026-10-10");
    expect(p.tags).toEqual(["work", "claim"]);
    expect(p.category).toBe("Transport");
    expect(p.name).toBe("Grab");
  });

  it("understands Malay and Chinese words", () => {
    expect(parseQuickAdd("bil tnb 87.20 semalam", TODAY)).toMatchObject({
      amount: 87.2,
      category: "Utilities",
      date: "2026-10-10",
    });
    expect(parseQuickAdd("奶茶 9.90 现金 昨天", TODAY)).toMatchObject({
      amount: 9.9,
      category: "Food & Drink",
      paymentMethod: "CASH",
      date: "2026-10-10",
    });
  });

  it("parses weekdays (most recent past) and d/m dates", () => {
    expect(parseQuickAdd("lunch 15 fri", TODAY).date).toBe("2026-10-09");
    expect(parseQuickAdd("aeon 120.35 5/10", TODAY)).toMatchObject({ date: "2026-10-05", category: "Groceries" });
  });

  it("names a card bank as the wallet", () => {
    expect(parseQuickAdd("uniqlo 79.90 maybank", TODAY)).toMatchObject({
      paymentMethod: "CARD",
      wallet: "Maybank",
      category: "Shopping",
    });
  });
});

describe("recurring schedule", () => {
  const rule: RecurringRule = {
    id: "8f6a1c2e-7b44-4f0a-9d3e-2a1b3c4d5e6f",
    name: "Rent",
    amount: 1200,
    currency: "MYR",
    category: "Utilities",
    paymentMethod: "BANK TRANSFER",
    wallet: "Maybank",
    frequency: "monthly",
    day: 1,
    startDate: "2026-08-01",
    active: true,
    lastRun: "",
  };

  it("back-fills missed months up to today", () => {
    expect(dueDates(rule, TODAY)).toEqual(["2026-08-01", "2026-09-01", "2026-10-01"]);
    expect(dueDates({ ...rule, lastRun: "2026-10-01" }, TODAY)).toEqual([]);
    expect(dueDates({ ...rule, active: false }, TODAY)).toEqual([]);
  });

  it("supports weekly rules and future start dates", () => {
    const weekly = { ...rule, frequency: "weekly" as const, day: 5, startDate: "2026-09-28" };
    expect(dueDates(weekly, TODAY)).toEqual(["2026-10-02", "2026-10-09"]);
    expect(nextDueDate(weekly, TODAY)).toBe("2026-10-16");
    expect(nextDueDate({ ...rule, startDate: "2027-01-01" }, TODAY)).toBe("2027-01-01");
  });

  it("gives every device the same id for the same occurrence", async () => {
    const a = await occurrenceId(rule.id, "2026-10-01");
    expect(a).toBe(await occurrenceId(rule.id, "2026-10-01"));
    expect(a).not.toBe(await occurrenceId(rule.id, "2026-11-01"));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("builds a schema-valid receipt for an occurrence", () => {
    const draft = draftForOccurrence(rule, "2026-10-01");
    expect(receiptDraftSchema.safeParse(draft).success).toBe(true);
    expect(draft.receiptDate).toBe("2026-10-01T09:00");
    expect(draft.tags).toEqual(["recurring"]);
  });
});

describe("parseReceiptText", () => {
  const SAMPLE = `
    KEDAI RUNCIT AH HOCK
    No 12, Jalan SS2/24
    47300 Petaling Jaya
    Tel: 03-7876 5432
    INVOICE NO: 88123
    Date: 09/10/2026 7:45 PM
    Beras Wangi 5kg        26.90
    2 x 7.65
    Susu Segar 1L          15.30
    Telur Gred A           13.50
    SUBTOTAL               55.70
    TOTAL                  55.70
    CASH                   60.00
    CHANGE                  4.30
  `;

  it("extracts merchant, address, date, total and items", () => {
    const r = parseReceiptText(SAMPLE);
    expect(r.merchantName).toBe("Kedai Runcit Ah Hock");
    expect(r.merchantAddress).toContain("Jalan SS2/24");
    expect(r.merchantPhone).toBe("03-7876 5432");
    expect(r.receiptDate).toBe("2026-10-09T19:45");
    expect(r.total).toBe(55.7);
    expect(r.paymentMethod).toBe("CASH");
    expect(r.items.map((i) => i.name)).toEqual(["Beras Wangi 5kg", "Susu Segar 1L", "Telur Gred A"]);
  });

  it("keeps items when they add up, else falls back to one total line", () => {
    const ok = parseReceiptText(SAMPLE);
    expect(reconcileItems(ok, "Purchase").items).toHaveLength(3);
    const off = { ...ok, total: 99 };
    expect(reconcileItems(off, "Purchase").items).toEqual([{ name: "Purchase", qty: 1, price: 99 }]);
  });

  it("accounts for a detected tax rate", () => {
    const r = parseReceiptText("CAFE MOCHA\nLatte 10.00\nCake 10.00\nSST 6%\nTOTAL 21.20");
    const { items, taxRate } = reconcileItems(r, "Purchase");
    expect(items).toHaveLength(2);
    expect(taxRate).toBe(6);
  });

  it("keeps items on a receipt with service charge, SST and rounding", () => {
    // The layout RyannReceipt itself prints (and exports as PNG).
    const text = [
      "RYANN KOPITIAM",
      "12 Jalan Bukit Bintang, 55100 Kuala Lumpur",
      "KOPI O KOSONG",
      "2 x 2.80 5.60",
      "ROTI BAKAR KAYA",
      "1 x 4.50 4.50",
      "NASI LEMAK AYAM",
      "1 x 12.90 12.90",
      "SUBTOTAL 23.00",
      "SERVICE CHG 10% 2.30",
      "SST 6% 1.52",
      "ROUNDING ADJ -0.02",
      "TOTAL MYR 26.80",
    ].join("\n");
    const r = parseReceiptText(text);
    expect(r.items.map((i) => [i.name, i.qty, i.price])).toEqual([
      ["Kopi O Kosong", 2, 2.8],
      ["Roti Bakar Kaya", 1, 4.5],
      ["Nasi Lemak Ayam", 1, 12.9],
    ]);
    expect(r).toMatchObject({ subtotal: 23, serviceChargeRate: 10, taxRate: 6, total: 26.8 });
    expect(reconcileItems(r, "Purchase")).toMatchObject({ taxRate: 6, serviceChargeRate: 10 });
  });

  it("adds one charges line when only the subtotal matches", () => {
    const r = parseReceiptText("SHOP\nTea 3.00\nCake 7.00\nSUBTOTAL 10.00\nTOTAL 11.50");
    expect(reconcileItems(r, "Purchase", "Tax & charges").items.at(-1)).toEqual({
      name: "Tax & charges",
      qty: 1,
      price: 1.5,
    });
  });

  it("reads named-month dates", () => {
    expect(parseReceiptText("SHOP\n11 Oct 2026 14:05\nTOTAL 5.00").receiptDate).toBe("2026-10-11T14:05");
  });
});

import { describe, expect, it } from "vitest";

import { createSampleDraft } from "@/lib/receipts/defaults";
import {
  dominantCurrency,
  fromLocal,
  lastMonths,
  mergeEntries,
  sortEntries,
  warrantyState,
  type HistoryEntry,
} from "@/lib/history/entries";
import type { LocalReceipt } from "@/lib/store/receipt-store";
import type { CloudSummary } from "@/lib/sync/cloud";

const local = (over: Partial<LocalReceipt> = {}): LocalReceipt => ({
  id: crypto.randomUUID(),
  draft: createSampleDraft(),
  isPinned: false,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
  syncedAt: null,
  ...over,
});

const cloud = (id: string, over: Partial<CloudSummary> = {}): CloudSummary => ({
  id,
  title: "Sales Receipt",
  merchantName: "Cloud Co",
  receiptNo: "RR-1",
  receiptDate: "2026-10-05T10:00",
  currency: "MYR",
  total: 10,
  category: "General",
  paymentMethod: "CARD",
  warrantyUntil: "",
  isPinned: false,
  wallet: "",
  tags: [],
  taxRelief: "",
  updatedAt: "2026-10-05T10:00:00Z",
  ...over,
});

describe("lastMonths", () => {
  it("walks back across a year boundary", () => {
    expect(lastMonths("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("warrantyState", () => {
  it("classifies expired, soon and active", () => {
    expect(warrantyState("2026-10-10", "2026-10-11")).toEqual({ kind: "expired", daysLeft: -1 });
    expect(warrantyState("2026-10-11", "2026-10-11")).toEqual({ kind: "soon", daysLeft: 0 });
    expect(warrantyState("2026-11-10", "2026-10-11").kind).toBe("soon");
    expect(warrantyState("2026-11-11", "2026-10-11").kind).toBe("active");
  });
});

describe("mergeEntries", () => {
  it("overlays unsynced local edits and keeps local-only drafts", () => {
    const synced = local({ syncedAt: "2026-10-02T00:00:00.000Z" });
    const edited = local({ syncedAt: "2026-10-01T00:00:00.000Z" });
    const localOnly = local();
    const merged = mergeEntries(
      [cloud(synced.id), cloud(edited.id, { merchantName: "Old name" })],
      [synced, edited, localOnly],
    );
    const byId = new Map(merged.map((e) => [e.id, e]));
    expect(merged).toHaveLength(3);
    expect(byId.get(synced.id)?.merchantName).toBe("Cloud Co");
    expect(byId.get(synced.id)?.synced).toBe(true);
    expect(byId.get(edited.id)?.merchantName).toBe("Ryann Kopitiam");
    expect(byId.get(edited.id)?.synced).toBe(false);
    expect(byId.get(localOnly.id)?.synced).toBe(false);
  });
});

describe("sorting and currency", () => {
  it("puts pinned first, then newest", () => {
    const a = { ...fromLocal(local()), receiptDate: "2026-10-01T00:00" };
    const b = { ...fromLocal(local()), receiptDate: "2026-10-09T00:00" };
    const p = { ...fromLocal(local()), receiptDate: "2026-01-01T00:00", isPinned: true };
    expect(sortEntries([a, b, p]).map((e) => e.receiptDate)).toEqual([
      "2026-01-01T00:00",
      "2026-10-09T00:00",
      "2026-10-01T00:00",
    ]);
  });

  it("picks the most used currency", () => {
    const e = (currency: HistoryEntry["currency"]) => ({ ...fromLocal(local()), currency });
    expect(dominantCurrency([e("USD"), e("MYR"), e("MYR")])).toBe("MYR");
    expect(dominantCurrency([])).toBeNull();
  });
});

describe("CSV export", () => {
  it("quotes cells and neutralises spreadsheet formulas", async () => {
    const { csvCell, entriesToCsv } = await import("@/lib/history/csv");
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell(-12.5)).toBe("-12.5");
    const csv = entriesToCsv([{ ...fromLocal(local()), merchantName: "Kedai, Ali", receiptDate: "2026-10-11T14:05" }]);
    expect(csv.startsWith("\uFEFFDate,Time,Merchant")).toBe(true);
    expect(csv).toContain('2026-10-11,14:05,"Kedai, Ali"');
  });
});

describe("monthLabel", () => {
  it("formats per locale", async () => {
    const { monthLabel } = await import("@/lib/history/entries");
    expect(monthLabel("2026-10")).toBe("Oct");
    expect(monthLabel("2026-10", true)).toBe("Oct 2026");
    expect(monthLabel("2026-10", true, "zh-CN")).toBe("2026年10月");
  });
});

import { describe, expect, it } from "vitest";

import { createSampleDraft, normalizeDraft } from "@/lib/receipts/defaults";
import { draftToRow, rowToRecord, type ReceiptRow } from "@/lib/receipts/mapping";
import { receiptDraftSchema } from "@/lib/validators/receipt-schema";

describe("receipt row mapping", () => {
  it("round-trips a draft through a database row", () => {
    const draft = createSampleDraft();
    const id = crypto.randomUUID();
    const row = draftToRow(id, crypto.randomUUID(), true, draft);
    const back = rowToRecord({ ...row, created_at: "", updated_at: "2026-10-11T00:00:00Z" } as ReceiptRow);
    expect(back.id).toBe(id);
    expect(back.isPinned).toBe(true);
    expect(back.draft).toEqual(draft);
  });

  it("stores receipt dates as wall-clock time", () => {
    const draft = { ...createSampleDraft(), receiptDate: "2026-10-11T14:05" };
    expect(draftToRow("a", "b", false, draft).receipt_date).toBe("2026-10-11T14:05:00Z");
  });

  it("recomputes totals server-side", () => {
    const row = draftToRow("a", "b", false, createSampleDraft());
    // Sample: 23.00 + 10% svc 2.30 + 6% tax 1.52 = 26.82 -> cash rounded 26.80
    expect(row.subtotal).toBe(23);
    expect(row.total).toBe(26.8);
    expect(row.meta.rounding).toBeCloseTo(-0.02, 10);
  });
});

describe("normalizeDraft", () => {
  it("upgrades v1 drafts to a schema-valid v2 draft", () => {
    const v1 = { merchantName: "Old", taxRate: 6, styleConfig: { width: "58mm" } } as never;
    const draft = normalizeDraft(v1);
    expect(draft.merchantName).toBe("Old");
    expect(draft.styleConfig.width).toBe("58mm");
    expect(draft.styleConfig.logo).toBe("");
    expect(receiptDraftSchema.safeParse(draft).success).toBe(true);
  });
});

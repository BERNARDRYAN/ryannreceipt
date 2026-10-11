import { describe, expect, it } from "vitest";

import { createBackup, mergePresets, mergeReceipts, parseBackup } from "@/lib/backup/backup";
import { createSampleDraft } from "@/lib/receipts/defaults";
import { EMPTY_SETTINGS } from "@/lib/store/settings-store";
import type { LocalReceipt } from "@/lib/store/receipt-store";

const receipt = (updatedAt: string, merchantName = "Shop"): LocalReceipt => ({
  id: crypto.randomUUID(),
  draft: { ...createSampleDraft(), merchantName },
  isPinned: false,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt,
  syncedAt: updatedAt,
});

describe("backup", () => {
  it("round-trips through JSON", () => {
    const r = receipt("2026-10-02T00:00:00.000Z");
    const text = JSON.stringify(createBackup([r], [], EMPTY_SETTINGS));
    const parsed = parseBackup(text);
    expect(parsed?.receipts[0]).toMatchObject({ id: r.id, draft: { merchantName: "Shop" } });
    expect(parsed?.settings).toEqual(EMPTY_SETTINGS);
  });

  it("rejects other files and damaged data", () => {
    expect(parseBackup("not json")).toBeNull();
    expect(parseBackup(JSON.stringify({ app: "other" }))).toBeNull();
    const bad = createBackup([receipt("2026-10-02T00:00:00.000Z")], [], EMPTY_SETTINGS);
    (bad.receipts[0].draft as { items: unknown }).items = "nope";
    expect(parseBackup(JSON.stringify(bad))).toBeNull();
  });

  it("fills fields missing from older backups", () => {
    const b = createBackup([receipt("2026-10-02T00:00:00.000Z")], [], EMPTY_SETTINGS);
    const old = JSON.parse(JSON.stringify(b));
    delete old.receipts[0].draft.split;
    delete old.receipts[0].draft.tags;
    delete old.presets;
    const parsed = parseBackup(JSON.stringify(old));
    expect(parsed?.receipts[0].draft.tags).toEqual([]);
    expect(parsed?.presets).toEqual([]);
  });

  it("adds missing receipts and keeps the newer copy", () => {
    const older = receipt("2026-10-01T00:00:00.000Z", "Old");
    const newer = { ...older, updatedAt: "2026-10-05T00:00:00.000Z", draft: { ...older.draft, merchantName: "New" } };
    const extra = receipt("2026-10-03T00:00:00.000Z", "Extra");

    const restored = mergeReceipts({ [older.id]: older }, [newer, extra]);
    expect(restored).toMatchObject({ added: 1, updated: 1 });
    expect(restored.receipts[older.id].draft.merchantName).toBe("New");
    expect(restored.receipts[older.id].syncedAt).toBeNull();

    const kept = mergeReceipts({ [newer.id]: newer }, [older]);
    expect(kept).toMatchObject({ added: 0, updated: 0 });
    expect(kept.receipts[newer.id].draft.merchantName).toBe("New");
  });

  it("merges presets by name", () => {
    const p = (id: string, name: string) => ({ ...createBackup([], [], EMPTY_SETTINGS), id, name }) as never;
    expect(mergePresets([p("1", "Aeon")], [p("2", "aeon"), p("3", "Tesco")]).map((x: { id: string }) => x.id)).toEqual(["1", "3"]);
  });
});

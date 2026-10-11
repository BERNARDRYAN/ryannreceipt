import { z } from "zod";

import { normalizeDraft } from "@/lib/receipts/defaults";
import type { LocalReceipt } from "@/lib/store/receipt-store";
import { presetInputSchema, receiptDraftSchema, userSettingsSchema, type Preset, type ReceiptDraft, type UserSettings } from "@/lib/validators/receipt-schema";

/**
 * A backup file: every receipt on this device plus synced settings. Device
 * preferences (language, theme, app-lock PIN) are deliberately left out.
 */
const backupSchema = z.object({
  app: z.literal("ryannreceipt"),
  version: z.literal(1),
  exportedAt: z.string(),
  receipts: z
    .array(
      z.object({
        id: z.uuid(),
        // Older backups lack newer fields; fill them before validating.
        draft: z.preprocess((d) => (d && typeof d === "object" ? normalizeDraft(d as Partial<ReceiptDraft>) : d), receiptDraftSchema),
        isPinned: z.boolean(),
        createdAt: z.string().max(40),
        updatedAt: z.string().max(40),
      }),
    )
    .max(5000),
  presets: z.array(presetInputSchema.extend({ id: z.string().max(64) })).max(200).default([]),
  settings: userSettingsSchema.nullable(),
});

export type Backup = z.infer<typeof backupSchema>;

export function createBackup(receipts: LocalReceipt[], presets: Preset[], settings: UserSettings): Backup {
  return {
    app: "ryannreceipt",
    version: 1,
    exportedAt: new Date().toISOString(),
    receipts: receipts.map(({ id, draft, isPinned, createdAt, updatedAt }) => ({ id, draft, isPinned, createdAt, updatedAt })),
    presets,
    settings,
  };
}

/** Parse and validate a backup file; null if it isn't one (or is damaged). */
export function parseBackup(text: string): Backup | null {
  try {
    const result = backupSchema.safeParse(JSON.parse(text));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Merge backed-up receipts into the library: new ones are added, ones that
 * exist are replaced only when the backup's copy is newer. Restored versions
 * count as unsynced so a signed-in user pushes them to the cloud.
 */
export function mergeReceipts(current: Record<string, LocalReceipt>, incoming: Backup["receipts"]) {
  const next = { ...current };
  let added = 0;
  let updated = 0;
  for (const r of incoming) {
    const existing = next[r.id];
    if (existing && existing.updatedAt >= r.updatedAt) continue;
    next[r.id] = { ...r, syncedAt: null };
    if (existing) updated++;
    else added++;
  }
  return { receipts: next, added, updated };
}

/** Add backed-up shop presets whose name isn't saved yet. */
export function mergePresets(current: Preset[], incoming: Preset[]) {
  const names = new Set(current.map((p) => p.name.trim().toLowerCase()));
  return [...current, ...incoming.filter((p) => !names.has(p.name.trim().toLowerCase()))];
}

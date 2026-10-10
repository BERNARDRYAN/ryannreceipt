"use client";

import { create } from "zustand";

import { isDirty, useReceiptStore, type LocalReceipt } from "@/lib/store/receipt-store";
import type { ReceiptDraft } from "@/lib/validators/receipt-schema";

/** Small batches keep each request well under the BFF's body cap (logos are up to ~120 KB). */
const BATCH_SIZE = 10;

type SyncState = {
  saving: boolean;
  error: string | null;
  set: (patch: Partial<Pick<SyncState, "saving" | "error">>) => void;
};

export const useSyncState = create<SyncState>()((set) => ({
  saving: false,
  error: null,
  set: (patch) => set(patch),
}));

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/**
 * Upload receipts and mark exactly the versions we sent as synced. Edits made
 * while a request is in flight keep the receipt dirty, so they are sent next time.
 */
export async function pushReceipts(receipts: LocalReceipt[]) {
  const { markSynced } = useReceiptStore.getState();
  const sync = useSyncState.getState();
  sync.set({ saving: true, error: null });
  try {
    for (let i = 0; i < receipts.length; i += BATCH_SIZE) {
      const batch = receipts.slice(i, i + BATCH_SIZE);
      await request("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipts: batch.map((r) => ({ id: r.id, isPinned: r.isPinned, draft: r.draft })),
        }),
      });
      markSynced(batch.map((r) => ({ id: r.id, updatedAt: r.updatedAt })));
    }
    sync.set({ saving: false });
  } catch (err) {
    sync.set({ saving: false, error: err instanceof Error ? err.message : "Sync failed" });
    throw err;
  }
}

export function dirtyReceipts() {
  return Object.values(useReceiptStore.getState().receipts).filter(isDirty);
}

export type CloudSummary = {
  id: string;
  title: string;
  merchantName: string;
  receiptNo: string;
  receiptDate: string;
  currency: ReceiptDraft["currency"];
  total: number;
  category: ReceiptDraft["category"];
  paymentMethod: string;
  warrantyUntil: string;
  isPinned: boolean;
  updatedAt: string;
};

export const fetchCloudSummaries = () =>
  request<{ receipts: CloudSummary[] }>("/api/receipts").then((r) => r.receipts);

/** Load a full receipt from the cloud into the local library (for the studio). */
export async function pullReceipt(id: string) {
  const { receipt } = await request<{
    receipt: { id: string; isPinned: boolean; draft: ReceiptDraft; updatedAt: string };
  }>(`/api/receipts/${encodeURIComponent(id)}`);
  useReceiptStore.getState().upsertFromCloud(receipt);
  return receipt;
}

export const setCloudPinned = (id: string, isPinned: boolean) =>
  request(`/api/receipts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isPinned }),
  });

export const deleteCloudReceipt = (id: string) =>
  request(`/api/receipts/${encodeURIComponent(id)}`, { method: "DELETE" });

export const deleteAccountData = () =>
  request<{ deleted: { receipts: number; presets: number } }>("/api/account", { method: "DELETE" });

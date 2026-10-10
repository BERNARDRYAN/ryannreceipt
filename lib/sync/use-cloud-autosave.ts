"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/lib/store/auth-store";
import { isDirty, useReceiptStore } from "@/lib/store/receipt-store";
import { pushReceipts, useSyncState } from "@/lib/sync/cloud";

const AUTOSAVE_DELAY_MS = 1500;

export type SaveStatus = "local" | "pending" | "saving" | "saved" | "error";

/** While signed in, save the open receipt to the cloud shortly after each edit. */
export function useCloudAutosave(): SaveStatus {
  const signedIn = useAuthStore((s) => s.status === "signed-in");
  const active = useReceiptStore((s) => s.receipts[s.activeId]);
  const saving = useSyncState((s) => s.saving);
  const error = useSyncState((s) => s.error);
  const dirty = active ? isDirty(active) : false;

  useEffect(() => {
    if (!signedIn || !active || !isDirty(active)) return;
    const timer = window.setTimeout(() => {
      // Errors surface through useSyncState; the next edit retries.
      pushReceipts([active]).catch(() => undefined);
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [signedIn, active]);

  if (!signedIn) return "local";
  if (saving) return "saving";
  if (error) return "error";
  return dirty ? "pending" : "saved";
}

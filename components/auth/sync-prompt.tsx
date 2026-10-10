"use client";

import { CloudUpload, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { buttonStyles, Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/messages";
import { useAuthStore } from "@/lib/store/auth-store";
import { isDirty, useLibraryHydrated, useReceiptStore } from "@/lib/store/receipt-store";
import { toast } from "@/lib/store/toast-store";
import { dirtyReceipts, pushReceipts } from "@/lib/sync/cloud";

const dismissKey = (userId: string) => `ryannreceipt:sync-dismissed:${userId}`;

function readDismissed(userId: string) {
  try {
    return sessionStorage.getItem(dismissKey(userId)) === "1";
  } catch {
    return false;
  }
}

/**
 * After sign-in, offer once per session to upload drafts that only exist on
 * this device (spec §6 "Seamless Cloud Sync").
 */
export function SyncPrompt() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const hydrated = useLibraryHydrated();
  const pending = useReceiptStore((s) => Object.values(s.receipts).filter(isDirty).length);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const dismissed = !!user && (dismissedFor === user.id || readDismissed(user.id));
  const open = !!user && hydrated && pending > 0 && !dismissed;

  function dismiss() {
    if (!user) return;
    try {
      sessionStorage.setItem(dismissKey(user.id), "1");
    } catch {
      // Private mode: fall back to in-memory only.
    }
    setDismissedFor(user.id);
  }

  async function handleSync() {
    const receipts = dirtyReceipts();
    setSyncing(true);
    try {
      await pushReceipts(receipts);
      toast(t("sync.done", { count: receipts.length }), { tone: "success" });
      dismiss();
    } catch {
      toast(t("sync.failed"), { tone: "error" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={dismiss}
      title={t("sync.title")}
      description={t("sync.body", { count: pending })}
      actions={
        <>
          <button type="button" onClick={dismiss} className={buttonStyles.ghost} disabled={syncing}>
            {t("sync.notNow")}
          </button>
          <button type="button" onClick={handleSync} className={buttonStyles.primary} disabled={syncing}>
            {syncing ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <CloudUpload className="size-4" aria-hidden />
            )}
            {t("sync.action", { count: pending })}
          </button>
        </>
      }
    />
  );
}

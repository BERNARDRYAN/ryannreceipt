"use client";

import { Download, LoaderCircle, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { buttonStyles, Dialog } from "@/components/ui/dialog";
import { createBackup, mergePresets, mergeReceipts, parseBackup } from "@/lib/backup/backup";
import { useT } from "@/lib/i18n/messages";
import { useAuthStore } from "@/lib/store/auth-store";
import { usePrefsStore } from "@/lib/store/prefs-store";
import { useReceiptStore } from "@/lib/store/receipt-store";
import { settingsSnapshot, useSettingsStore } from "@/lib/store/settings-store";
import { toast } from "@/lib/store/toast-store";
import { useUiStore } from "@/lib/store/ui-store";
import { pushReceipts } from "@/lib/sync/cloud";

function download() {
  const { receipts, presets } = useReceiptStore.getState();
  const backup = createBackup(Object.values(receipts), presets, settingsSnapshot());
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ryannreceipt-backup-${backup.exportedAt.slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  usePrefsStore.getState().setLastBackupAt(backup.exportedAt);
  return backup.receipts.length;
}

export function BackupDialog() {
  const t = useT();
  const open = useUiStore((s) => s.backupOpen);
  const setOpen = useUiStore((s) => s.setBackupOpen);
  const lastBackupAt = usePrefsStore((s) => s.lastBackupAt);
  const count = useReceiptStore((s) => Object.keys(s.receipts).length);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function restore(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const backup = file.size <= 20 * 1024 * 1024 ? parseBackup(await file.text()) : null;
      if (!backup) {
        toast(t("backup.invalid"), { tone: "error" });
        return;
      }
      const store = useReceiptStore.getState();
      const { receipts, added, updated } = mergeReceipts(store.receipts, backup.receipts);
      useReceiptStore.setState({ receipts, presets: mergePresets(store.presets, backup.presets) });
      // Settings: the newer copy wins, like cloud sync.
      if (backup.settings && backup.settings.updatedAt > useSettingsStore.getState().updatedAt) {
        useSettingsStore.setState(backup.settings);
      }
      if (useAuthStore.getState().status === "signed-in" && added + updated > 0) {
        const changed = backup.receipts.map((r) => receipts[r.id]).filter((r) => r && r.syncedAt === null);
        await pushReceipts(changed).catch(() => undefined);
      }
      toast(t("backup.restored", { added, updated }), { tone: "success" });
      setOpen(false);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t("backup.title")} description={t("backup.subtitle")}>
      <div className="space-y-4">
        <div className="space-y-2 rounded-xl bg-surface-muted p-3 text-sm">
          <p>{t("backup.count", { count })}</p>
          <p className="text-xs text-muted">
            {lastBackupAt ? t("backup.last", { date: lastBackupAt.slice(0, 10) }) : t("backup.never")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonStyles.primary}
            onClick={() => toast(t("backup.saved", { count: download() }), { tone: "success" })}
          >
            <Download className="size-4" aria-hidden />
            {t("backup.download")}
          </button>
          <button type="button" disabled={busy} className={buttonStyles.secondary} onClick={() => fileRef.current?.click()}>
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            {t("backup.restore")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            aria-label={t("backup.restore")}
            onChange={(e) => void restore(e.target.files?.[0])}
          />
        </div>
        <p className="text-xs leading-relaxed text-muted">{t("backup.note")}</p>
      </div>
    </Dialog>
  );
}

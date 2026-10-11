"use client";

import { useEffect } from "react";

import { translate } from "@/lib/i18n/messages";
import { draftForOccurrence, dueDates, occurrenceId } from "@/lib/recurring/schedule";
import { useAuthStore } from "@/lib/store/auth-store";
import { usePrefsHydrated, usePrefsStore } from "@/lib/store/prefs-store";
import { isDirty, useLibraryHydrated, useReceiptStore } from "@/lib/store/receipt-store";
import { useSettingsHydrated, useSettingsStore } from "@/lib/store/settings-store";
import { toast } from "@/lib/store/toast-store";
import { pushReceipts, useSyncState } from "@/lib/sync/cloud";
import { todayKey } from "@/lib/history/entries";

let running = false;

/**
 * Creates receipts for recurring expenses that came due since the last visit.
 * Signed in, it waits for settings to sync first so another device's run (and
 * its `lastRun`) is respected; ids are deterministic either way.
 */
export function useRecurringRunner() {
  const libraryReady = useLibraryHydrated();
  const settingsReady = useSettingsHydrated();
  const prefsReady = usePrefsHydrated();
  const auth = useAuthStore((s) => s.status);
  const settingsChecked = useSyncState((s) => s.settingsChecked);
  const rules = useSettingsStore((s) => s.recurring);

  useEffect(() => {
    if (!libraryReady || !settingsReady || !prefsReady || auth === "loading") return;
    if (auth === "signed-in" && !settingsChecked) return;
    if (running || rules.length === 0) return;

    const today = todayKey();
    const due = rules.flatMap((rule) => dueDates(rule, today).map((date) => ({ rule, date })));
    if (due.length === 0) return;

    running = true;
    (async () => {
      const entries = await Promise.all(
        due.map(async ({ rule, date }) => ({ id: await occurrenceId(rule.id, date), draft: draftForOccurrence(rule, date) })),
      );
      const added = useReceiptStore.getState().addReceipts(entries);
      const settings = useSettingsStore.getState();
      for (const rule of new Set(due.map((d) => d.rule))) settings.markRuleRun(rule.id, today);

      if (added.length) {
        const locale = usePrefsStore.getState().locale;
        toast(translate(locale, "recurring.added", { count: added.length }), { tone: "success" });
        if (useAuthStore.getState().status === "signed-in") {
          const receipts = useReceiptStore.getState().receipts;
          await pushReceipts(added.map((id) => receipts[id]).filter((r) => r && isDirty(r))).catch(() => undefined);
        }
      }
    })().finally(() => {
      running = false;
    });
  }, [libraryReady, settingsReady, prefsReady, auth, settingsChecked, rules]);
}

"use client";

import { Repeat, X } from "lucide-react";

import type { HistoryEntry } from "@/lib/history/entries";
import { useT } from "@/lib/i18n/messages";
import { detectRepeats, ruleFromSuggestion } from "@/lib/recurring/detect";
import { usePrefsStore } from "@/lib/store/prefs-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { toast } from "@/lib/store/toast-store";
import { formatAmount } from "@/lib/utils/currency";

/** "TNB Bill looks monthly. Log it automatically?" — one tap to say yes or no. */
export function RepeatSuggestions({ entries, today }: { entries: HistoryEntry[]; today: string }) {
  const t = useT();
  const rules = useSettingsStore((s) => s.recurring);
  const dismissed = usePrefsStore((s) => s.dismissedRepeats);
  const suggestions = detectRepeats(entries, rules, today, dismissed);
  if (suggestions.length === 0) return null;

  return (
    <section aria-label={t("repeat.title")} className="space-y-2">
      {suggestions.map((s) => (
        <div key={s.key} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-border">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted">
            <Repeat className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t("repeat.title2", { name: s.name })}</p>
            <p className="text-xs text-muted">
              {t("repeat.detail", { amount: `${s.currency} ${formatAmount(s.amount, s.currency)}`, day: s.day })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              useSettingsStore.getState().upsertRule(ruleFromSuggestion(s, crypto.randomUUID()));
              toast(t("repeat.added", { name: s.name }), { tone: "success" });
            }}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast hover:opacity-90"
          >
            {t("repeat.yes")}
          </button>
          <button
            type="button"
            aria-label={t("repeat.no", { name: s.name })}
            title={t("repeat.no", { name: s.name })}
            onClick={() => usePrefsStore.getState().dismissRepeat(s.key)}
            className="shrink-0 rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </section>
  );
}

"use client";

import { Wallet, X } from "lucide-react";

import { incomeInMonth } from "@/lib/income";
import { useT } from "@/lib/i18n/messages";
import { useSettingsStore } from "@/lib/store/settings-store";
import { formatAmount } from "@/lib/utils/currency";

/** This month's money in. Monthly income can be stopped; one-offs removed. */
export function IncomeCard({ month, monthName }: { month: string; monthName: string }) {
  const t = useT();
  const income = useSettingsStore((s) => s.income);
  const rows = incomeInMonth(income, month);
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="income-heading" className="rounded-2xl border border-border bg-surface p-4">
      <h2 id="income-heading" className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <Wallet className="size-4" aria-hidden />
        {t("income.cardTitle", { month: monthName })}
      </h2>
      <ul className="divide-y divide-border">
        {rows.map((i) => {
          // A monthly income started this month can simply be removed.
          const removable = !i.monthly || i.date.slice(0, 7) === month;
          return (
            <li key={i.id} className="flex items-center gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{i.name}</p>
                <p className="text-xs text-muted">{i.monthly ? t("income.monthly") : i.date}</p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-success">
                +{i.currency} {formatAmount(i.amount, i.currency)}
              </span>
              {removable ? (
                <button
                  type="button"
                  aria-label={t("income.remove", { name: i.name })}
                  title={t("income.remove", { name: i.name })}
                  onClick={() => useSettingsStore.getState().removeIncome(i.id)}
                  className="shrink-0 rounded-md p-1 text-muted hover:bg-surface-muted hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => useSettingsStore.getState().endIncome(i.id, month)}
                  title={t("income.stopHint")}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted ring-1 ring-border hover:text-foreground"
                >
                  {t("income.stop")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

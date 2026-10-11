"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { CATEGORY_ICONS } from "@/components/quick-add/category-icons";
import { useT, type MessageKey } from "@/lib/i18n/messages";
import { formatAmount } from "@/lib/utils/currency";
import type { Category, Currency } from "@/lib/validators/receipt-schema";

export type BreakdownMode = "category" | "wallet" | "tag";

type Row = { key: string; total: number; budget?: number };

/**
 * Where the month's money went: by category (with optional per-category
 * budgets), by wallet, or by tag. Single-series bars, values at the tips;
 * rows are buttons that filter the receipt list.
 */
export function Breakdown({
  monthName,
  currency,
  byCategory,
  byWallet,
  byTag,
  active,
  onSelect,
  onEditBudgets,
}: {
  monthName: string;
  currency: Currency;
  byCategory: Row[];
  byWallet: Row[];
  byTag: Row[];
  active: { mode: BreakdownMode; key: string };
  onSelect: (mode: BreakdownMode, key: string) => void;
  onEditBudgets: () => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<BreakdownMode>("category");
  const rows = mode === "category" ? byCategory : mode === "wallet" ? byWallet : byTag;
  const sum = rows.reduce((s, r) => s + r.total, 0);
  const max = Math.max(...rows.map((r) => Math.max(r.total, r.budget ?? 0)), 0);

  const label = (key: string) =>
    mode === "category" ? t(`cat.${key}` as MessageKey) : mode === "tag" ? `#${key}` : key || t("breakdown.noWallet");

  return (
    <figure className="rounded-2xl border border-border bg-surface p-4">
      <figcaption className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{t("breakdown.title")}</p>
          <p className="text-xs text-muted">{t("chart.byCategorySub", { month: monthName, currency })}</p>
        </div>
        <div role="tablist" aria-label={t("breakdown.title")} className="flex rounded-lg bg-surface-muted p-0.5 text-xs">
          {(["category", "wallet", "tag"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                mode === m ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {t(`breakdown.${m}` as MessageKey)}
            </button>
          ))}
        </div>
      </figcaption>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          {mode === "category" ? t("chart.noSpending") : t(`breakdown.empty.${mode}` as MessageKey)}
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => {
            const isActive = active.mode === mode && active.key === row.key;
            const pct = row.budget ? (row.total / row.budget) * 100 : null;
            const tone = pct === null ? "bg-viz-accent" : pct > 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-viz-accent";
            const Icon = mode === "category" ? CATEGORY_ICONS[row.key as Category] : null;
            return (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={() => onSelect(mode, isActive ? "" : row.key)}
                  aria-pressed={isActive}
                  className={`grid w-full grid-cols-[7.5rem_1fr] items-center gap-3 rounded-lg px-1.5 py-1.5 text-left text-xs hover:bg-surface-muted ${
                    isActive ? "bg-surface-muted" : ""
                  }`}
                >
                  <span className={`flex min-w-0 items-center gap-1.5 ${isActive ? "font-semibold" : "text-muted"}`}>
                    {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
                    <span className="truncate">{label(row.key)}</span>
                  </span>
                  <span className="relative flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className={`block h-3 shrink-0 rounded-r-[4px] ${tone}`}
                      style={{ width: `calc((100% - 8rem) * ${max ? row.total / max : 0})` }}
                    />
                    {row.budget ? (
                      // Budget marker: a hairline where the limit sits on the same scale.
                      <span
                        aria-hidden
                        className="absolute top-[-3px] h-[18px] w-px bg-foreground/50"
                        style={{ left: `calc((100% - 8rem) * ${row.budget / max})` }}
                      />
                    ) : null}
                    <span className="shrink-0 whitespace-nowrap tabular-nums">
                      <span className="font-medium text-foreground">{formatAmount(row.total, currency)}</span>
                      <span className="text-muted">
                        {" · "}
                        {pct !== null
                          ? t("breakdown.ofBudget", { pct: Math.round(pct), amount: formatAmount(row.budget!, currency) })
                          : `${sum ? Math.round((row.total / sum) * 100) : 0}%`}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {mode === "category" && (
        <button
          type="button"
          onClick={onEditBudgets}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-muted hover:text-foreground"
        >
          <Pencil className="size-3" aria-hidden />
          {t("breakdown.editBudgets")}
        </button>
      )}
    </figure>
  );
}

"use client";

import { FileDown, Landmark } from "lucide-react";
import { useState } from "react";

import { type HistoryEntry } from "@/lib/history/entries";
import { translate, useT, type MessageKey } from "@/lib/i18n/messages";
import { downloadTaxReport } from "@/lib/reports/pdf";
import { formatAmount } from "@/lib/utils/currency";
import type { Currency } from "@/lib/validators/receipt-schema";

/**
 * Totals per LHDN relief group for a year, to make e-Filing easier. We show
 * spending only; relief limits change yearly, so we link to LHDN instead.
 */
export function TaxReliefCard({ entries, currency, year }: { entries: HistoryEntry[]; currency: Currency; year: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const inYear = entries.filter((e) => e.taxRelief && e.currency === currency && e.receiptDate.startsWith(year));
  const groups = new Map<string, { total: number; count: number }>();
  for (const e of inYear) {
    const g = groups.get(e.taxRelief) ?? { total: 0, count: 0 };
    groups.set(e.taxRelief, { total: g.total + e.spent, count: g.count + 1 });
  }
  const rows = [...groups.entries()].sort((a, b) => b[1].total - a[1].total);
  const relief = (k: string) => t(`relief.${k}` as MessageKey);

  async function download() {
    setBusy(true);
    try {
      await downloadTaxReport(
        inYear,
        currency,
        {
          title: "RyannReceipt - Tax relief summary",
          subtitle: `Year ${year} · ${currency}`,
          total: "Total",
          receipts: "Receipts",
          byCategory: "By relief group",
          byWallet: "By wallet",
          list: "Receipts",
          generated: "Spending only. Check current relief limits at hasil.gov.my.",
          // PDF fonts are Latin-only, so reports are always in English.
          group: (k) => translate("en", `relief.${k}` as MessageKey),
          noWallet: "-",
        },
        `ryannreceipt-tax-relief-${year}.pdf`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="relief-heading" className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 id="relief-heading" className="flex items-center gap-1.5 text-sm font-semibold">
            <Landmark className="size-4" aria-hidden />
            {t("relief.title", { year })}
          </h2>
          <p className="text-xs text-muted">{t("relief.sub")}</p>
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={() => void download()}
            disabled={busy}
            aria-label={t("relief.download")}
            title={t("relief.download")}
            className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
          >
            <FileDown className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-5 text-center text-xs text-muted">
          {t("relief.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {rows.map(([k, v]) => (
            <li key={k} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate">{relief(k)}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-medium">
                  {currency} {formatAmount(v.total, currency)}
                </span>
                <span className="text-xs text-muted"> · {t("chart.receiptCount", { count: v.count })}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

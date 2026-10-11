"use client";

import { CircleAlert, LoaderCircle, Plus, ShieldCheck, ShieldX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { formatWarrantyDate } from "@/components/receipt/receipt-canvas";
import { warrantyState, type HistoryEntry, type WarrantyState } from "@/lib/history/entries";
import { inputClass } from "@/components/receipt/editor/fields";
import { buttonStyles } from "@/components/ui/dialog";
import { useT, type TFunction } from "@/lib/i18n/messages";
import { useAuthStore } from "@/lib/store/auth-store";
import { useReceiptStore } from "@/lib/store/receipt-store";
import { toast } from "@/lib/store/toast-store";
import { pullReceipt, pushReceipts } from "@/lib/sync/cloud";
import { formatAmount } from "@/lib/utils/currency";

const STATE_UI: Record<
  WarrantyState["kind"],
  { icon: typeof ShieldCheck; tone: string; label: (d: number, t: TFunction) => string }
> = {
  soon: {
    icon: CircleAlert,
    tone: "text-warning",
    label: (d, t) => (d === 0 ? t("warranty.today") : t("warranty.soon", { n: d })),
  },
  active: { icon: ShieldCheck, tone: "text-success", label: (d, t) => t("warranty.left", { n: d }) },
  expired: { icon: ShieldX, tone: "text-muted", label: (d, t) => t("warranty.expired", { n: -d }) },
};

const PERIODS = [6, 12, 24, 36] as const;

/** `YYYY-MM-DD` + months, clamped to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonths(day: string, months: number) {
  const [y, m, d] = day.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10);
}

/**
 * Add a warranty without leaving Home: pick the purchase, tap how long it's
 * covered (counted from the purchase date), done.
 */
function WarrantyAdder({ entries, onDone }: { entries: HistoryEntry[]; onDone: () => void }) {
  const t = useT();
  // Purchases without a warranty yet: electronics first, then newest.
  const choices = entries
    .filter((e) => !e.warrantyUntil)
    .sort(
      (a, b) =>
        Number(b.category === "Electronics") - Number(a.category === "Electronics") ||
        b.receiptDate.localeCompare(a.receiptDate),
    )
    .slice(0, 40);
  const [id, setId] = useState(choices[0]?.id ?? "");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const entry = choices.find((e) => e.id === id);
  const bought = entry?.receiptDate.slice(0, 10) ?? "";

  async function save() {
    if (!entry || !until) return;
    setBusy(true);
    try {
      if (!useReceiptStore.getState().receipts[entry.id]) await pullReceipt(entry.id);
      useReceiptStore.getState().patchDraft(entry.id, { warrantyUntil: until });
      if (useAuthStore.getState().status === "signed-in") {
        const r = useReceiptStore.getState().receipts[entry.id];
        if (r) await pushReceipts([r]).catch(() => undefined);
      }
      toast(t("warranty.saved", { name: entry.merchantName || t("list.untitled"), date: formatWarrantyDate(until) }), {
        tone: "success",
      });
      onDone();
    } catch {
      toast(t("history.cloudError"), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (choices.length === 0) return <p className="text-xs text-muted">{t("warranty.noneToAdd")}</p>;

  return (
    <div className="space-y-3 rounded-xl bg-surface-muted/60 p-3">
      <label className="block space-y-1.5">
        <span className="block text-xs font-medium text-muted">{t("warranty.which")}</span>
        <select
          className={inputClass}
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setUntil("");
          }}
        >
          {choices.map((e) => (
            <option key={e.id} value={e.id}>
              {`${e.merchantName || t("list.untitled")} · ${e.receiptDate.slice(0, 10)} · ${formatAmount(e.total, e.currency)}`}
            </option>
          ))}
        </select>
      </label>
      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-muted">{t("warranty.for")}</span>
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((months) => {
            const date = bought ? addMonths(bought, months) : "";
            return (
              <button
                key={months}
                type="button"
                aria-pressed={until === date}
                onClick={() => setUntil(date)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
                  until === date ? "bg-accent text-accent-contrast ring-accent" : "ring-border hover:bg-surface"
                }`}
              >
                {months < 12
                  ? t("warranty.months", { n: months })
                  : months === 12
                    ? t("warranty.year1")
                    : t("warranty.years", { n: months / 12 })}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          <span className="shrink-0">{t("warranty.orUntil")}</span>
          <input
            type="date"
            className={`${inputClass} py-1.5`}
            value={until}
            min={bought}
            onChange={(e) => setUntil(e.target.value)}
          />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className={buttonStyles.ghost}>
          {t("common.cancel")}
        </button>
        <button type="button" disabled={!until || busy} onClick={() => void save()} className={buttonStyles.primary}>
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {t("warranty.save")}
        </button>
      </div>
    </div>
  );
}

/** Warranties sorted by urgency; status always pairs icon + text, never color alone. */
export function WarrantyTracker({ entries, today }: { entries: HistoryEntry[]; today: string }) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const rows = entries
    .filter((e) => e.warrantyUntil)
    .map((e) => ({ entry: e, state: warrantyState(e.warrantyUntil, today) }))
    .sort((a, b) => {
      // Expiring soon first, then active by date, then most recently expired.
      const rank = { soon: 0, active: 1, expired: 2 } as const;
      return rank[a.state.kind] - rank[b.state.kind] || Math.abs(a.state.daysLeft) - Math.abs(b.state.daysLeft);
    });

  return (
    <section aria-labelledby="warranty-heading" className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 id="warranty-heading" className="text-sm font-semibold">
            {t("warranty.title")}
          </h2>
          <p className="text-xs text-muted">{t("warranty.sub")}</p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mr-5 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-border hover:bg-surface-muted"
          >
            <Plus className="size-3.5" aria-hidden />
            {t("warranty.add")}
          </button>
        )}
      </div>
      {adding && (
        <div className="mb-3">
          <WarrantyAdder entries={entries} onDone={() => setAdding(false)} />
        </div>
      )}
      {rows.length === 0 && !adding ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted">
          {t("warranty.empty")}
        </p>
      ) : (
        rows.length > 0 && (
        <ul className="divide-y divide-border">
          {rows.slice(0, 8).map(({ entry, state }) => {
            const ui = STATE_UI[state.kind];
            const Icon = ui.icon;
            return (
              <li key={entry.id}>
                <Link
                  href={`/studio?id=${entry.id}`}
                  className="flex items-center gap-3 rounded-md px-1 py-2.5 hover:bg-surface-muted"
                >
                  <Icon className={`size-4 shrink-0 ${ui.tone}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.merchantName || t("list.untitled")}</p>
                    <p className="truncate text-xs text-muted">
                      {t("warranty.until", { date: formatWarrantyDate(entry.warrantyUntil) })} · {entry.receiptNo}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${state.kind === "expired" ? "text-muted" : ui.tone}`}>
                    {ui.label(state.daysLeft, t)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        )
      )}
    </section>
  );
}

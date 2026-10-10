"use client";

import { CircleAlert, ShieldCheck, ShieldX } from "lucide-react";
import Link from "next/link";

import { formatWarrantyDate } from "@/components/receipt/receipt-canvas";
import { warrantyState, type HistoryEntry, type WarrantyState } from "@/lib/history/entries";

const STATE_UI: Record<WarrantyState["kind"], { icon: typeof ShieldCheck; tone: string; label: (d: number) => string }> = {
  soon: {
    icon: CircleAlert,
    tone: "text-warning",
    label: (d) => (d === 0 ? "Expires today" : `Expires in ${d} day${d === 1 ? "" : "s"}`),
  },
  active: { icon: ShieldCheck, tone: "text-success", label: (d) => `${d} days left` },
  expired: { icon: ShieldX, tone: "text-muted", label: (d) => `Expired ${-d} day${d === -1 ? "" : "s"} ago` },
};

/** Warranties sorted by urgency; status always pairs icon + text, never color alone. */
export function WarrantyTracker({ entries, today }: { entries: HistoryEntry[]; today: string }) {
  const rows = entries
    .filter((e) => e.warrantyUntil)
    .map((e) => ({ entry: e, state: warrantyState(e.warrantyUntil, today) }))
    .sort((a, b) => {
      // Expiring soon first, then active by date, then most recently expired.
      const rank = { soon: 0, active: 1, expired: 2 } as const;
      return rank[a.state.kind] - rank[b.state.kind] || Math.abs(a.state.daysLeft) - Math.abs(b.state.daysLeft);
    });

  return (
    <section aria-labelledby="warranty-heading" className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3">
        <h2 id="warranty-heading" className="text-sm font-semibold">
          Warranty tracker
        </h2>
        <p className="text-xs text-muted">Set a “Warranty until” date on a receipt to track it here.</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted">
          No warranties tracked yet.
        </p>
      ) : (
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
                    <p className="truncate text-sm font-medium">{entry.merchantName || "Untitled receipt"}</p>
                    <p className="truncate text-xs text-muted">
                      Until {formatWarrantyDate(entry.warrantyUntil)} · {entry.receiptNo}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${state.kind === "expired" ? "text-muted" : ui.tone}`}>
                    {ui.label(state.daysLeft)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

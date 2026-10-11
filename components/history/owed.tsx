"use client";

import { ArrowDownLeft, ArrowUpRight, Check, Users } from "lucide-react";
import { useState } from "react";

import type { HistoryEntry } from "@/lib/history/entries";
import { useT } from "@/lib/i18n/messages";
import { formatAmount } from "@/lib/utils/currency";
import { ME, type Currency } from "@/lib/validators/receipt-schema";

type Debt = { entry: HistoryEntry; personId: string; amount: number };
type Balance = { name: string; owesMe: Debt[]; iOwe: Debt[] };

/**
 * Who owes whom across all split bills, grouped by friend name. "Owes me":
 * bills I paid where they haven't paid back. "I owe": bills they paid.
 */
export function friendBalances(entries: HistoryEntry[], currency: Currency) {
  const byName = new Map<string, Balance>();
  const get = (name: string) => {
    const key = name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, { name: name.trim(), owesMe: [], iOwe: [] });
    return byName.get(key)!;
  };
  for (const entry of entries) {
    const split = entry.split;
    if (!split || entry.currency !== currency) continue;
    const payer = split.people.find((p) => p.id === split.payerId);
    if (split.payerId === ME) {
      for (const p of split.people) {
        if (p.id !== ME && !p.paid) get(p.name).owesMe.push({ entry, personId: p.id, amount: p.total });
      }
    } else if (payer) {
      const me = split.people.find((p) => p.id === ME);
      if (me && !me.paid) get(payer.name).iOwe.push({ entry, personId: ME, amount: me.total });
    }
  }
  return [...byName.values()].filter((b) => b.owesMe.length || b.iOwe.length);
}

export function FriendsCard({
  entries,
  currency,
  onMarkPaid,
}: {
  entries: HistoryEntry[];
  currency: Currency;
  onMarkPaid: (entryId: string, personId: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  const balances = friendBalances(entries, currency);
  const money = (n: number) => `${currency} ${formatAmount(n, currency)}`;
  const owedToMe = balances.reduce((s, b) => s + b.owesMe.reduce((x, d) => x + d.amount, 0), 0);
  const iOwe = balances.reduce((s, b) => s + b.iOwe.reduce((x, d) => x + d.amount, 0), 0);

  return (
    <section aria-labelledby="friends-heading" className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3">
        <h2 id="friends-heading" className="flex items-center gap-1.5 text-sm font-semibold">
          <Users className="size-4" aria-hidden />
          {t("owed.title")}
        </h2>
        <p className="text-xs text-muted">
          {balances.length
            ? [owedToMe > 0 && t("owed.toYou", { amount: money(owedToMe) }), iOwe > 0 && t("owed.youOwe", { amount: money(iOwe) })]
                .filter(Boolean)
                .join(" · ")
            : t("owed.sub")}
        </p>
      </div>
      {balances.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-5 text-center text-xs text-muted">
          {t("owed.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {balances.map((b) => {
            const toMe = b.owesMe.reduce((s, d) => s + d.amount, 0);
            const fromMe = b.iOwe.reduce((s, d) => s + d.amount, 0);
            const expanded = open === b.name;
            return (
              <li key={b.name} className="py-1.5">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : b.name)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-surface-muted"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.name}</span>
                  {toMe > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-success tabular-nums">
                      <ArrowDownLeft className="size-3.5" aria-hidden />
                      {t("owed.owesYou", { amount: money(toMe) })}
                    </span>
                  )}
                  {fromMe > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-danger tabular-nums">
                      <ArrowUpRight className="size-3.5" aria-hidden />
                      {t("owed.youOweThem", { amount: money(fromMe) })}
                    </span>
                  )}
                </button>
                {expanded && (
                  <ul className="mt-1 space-y-1 pl-1">
                    {[...b.owesMe, ...b.iOwe].map((d) => (
                      <li key={`${d.entry.id}-${d.personId}`} className="flex items-center gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate text-muted">
                          {d.entry.receiptDate.slice(0, 10)} · {d.entry.merchantName}
                        </span>
                        <span className="shrink-0 tabular-nums">{formatAmount(d.amount, currency)}</span>
                        <button
                          type="button"
                          onClick={() => onMarkPaid(d.entry.id, d.personId)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1 ring-border hover:bg-surface-muted"
                        >
                          <Check className="size-3" aria-hidden />
                          {t("split.markPaid")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

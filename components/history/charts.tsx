"use client";

import { ArrowDownRight, ArrowUpRight, Table2, BarChart3 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { monthLabel } from "@/lib/history/entries";
import { formatAmount } from "@/lib/utils/currency";
import type { Currency } from "@/lib/validators/receipt-schema";

/** Compact money for axis ticks: 950, 1.2K, 34K, 1.5M. */
function compact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** Round the axis max up to a clean 1/2/2.5/5 × 10ⁿ step. */
function niceMax(value: number) {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const n = value / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * exp;
}

export function StatTile({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Signed change vs a named period; for spending, up is bad. */
  delta?: { value: number; label: string; upIsGood?: boolean };
}) {
  const up = delta && delta.value > 0;
  const good = delta && (delta.upIsGood ? up : !up);
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      {delta && delta.value !== 0 && (
        <p className={`mt-1 inline-flex items-center gap-1 text-xs ${good ? "text-success" : "text-danger"}`}>
          {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
          {delta.label}
        </p>
      )}
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

type MonthDatum = { key: string; total: number; count: number };

/**
 * Emphasis column chart: the selected month in the accent, the others as
 * recessive context. Each column slot is a button (hit target > mark) that
 * selects the month; hover/focus shows a tooltip; a table view mirrors it all.
 */
export function MonthlyChart({
  data,
  currency,
  selected,
  onSelect,
}: {
  data: MonthDatum[];
  currency: Currency;
  selected: string;
  onSelect: (key: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = niceMax(Math.max(...data.map((d) => d.total)));
  const ticks = [max, max / 2, 0];

  return (
    <figure className="rounded-xl border border-border bg-surface p-4">
      <figcaption className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Monthly spend</p>
          <p className="text-xs text-muted">Last {data.length} months · {currency} · select a month to filter</p>
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-muted hover:text-foreground"
        >
          {asTable ? <BarChart3 className="size-3.5" aria-hidden /> : <Table2 className="size-3.5" aria-hidden />}
          {asTable ? "Chart" : "Table"}
        </button>
      </figcaption>

      {asTable ? (
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 font-medium">Month</th>
              <th className="py-1 text-right font-medium">Receipts</th>
              <th className="py-1 text-right font-medium">Spent ({currency})</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((d) => (
              <tr key={d.key} className="border-t border-border">
                <td className="py-1.5">
                  <button type="button" onClick={() => onSelect(d.key)} className="hover:underline">
                    {monthLabel(d.key, true)}
                  </button>
                </td>
                <td className="py-1.5 text-right">{d.count}</td>
                <td className={`py-1.5 text-right ${d.key === selected ? "font-semibold" : ""}`}>
                  {formatAmount(d.total, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="grid grid-cols-[2.5rem_1fr] gap-x-2">
          {/* Y axis + hairline grid */}
          <div className="relative h-44 text-right text-[10px] text-muted tabular-nums">
            {ticks.map((t, i) => (
              <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / 2) * 100}%` }}>
                {compact(t)}
              </span>
            ))}
          </div>
          <div className="relative h-44">
            {ticks.map((_, i) => (
              <div
                key={i}
                aria-hidden
                className={`absolute inset-x-0 h-px ${i === 2 ? "bg-viz-context" : "bg-viz-grid"}`}
                style={{ top: `${(i / 2) * 100}%` }}
              />
            ))}
            <div className="absolute inset-0 flex items-end" onPointerLeave={() => setHover(null)}>
              {data.map((d, i) => {
                const isSel = d.key === selected;
                const h = (d.total / max) * 100;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => onSelect(d.key)}
                    onPointerEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    aria-pressed={isSel}
                    aria-label={`${monthLabel(d.key, true)}: ${currency} ${formatAmount(d.total, currency)}, ${d.count} receipts`}
                    className="group relative flex h-full flex-1 items-end justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                  >
                    {isSel && d.total > 0 && (
                      <span
                        className="absolute text-[10px] font-semibold whitespace-nowrap text-foreground tabular-nums"
                        style={{ bottom: `calc(${h}% + 4px)` }}
                      >
                        {compact(d.total)}
                      </span>
                    )}
                    <span
                      aria-hidden
                      className={`block w-full max-w-6 rounded-t-[4px] transition-colors ${
                        isSel ? "bg-viz-accent" : "bg-viz-context group-hover:bg-muted"
                      }`}
                      style={{ height: `${Math.max(h, d.total > 0 ? 1.5 : 0)}%` }}
                    />
                    {hover === i && (
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute z-10 -translate-y-2 rounded-md border border-border bg-surface px-2 py-1 text-left whitespace-nowrap shadow-md"
                        style={{ bottom: `${h}%` }}
                      >
                        <span className="block text-sm font-semibold tabular-nums">
                          {currency} {formatAmount(d.total, currency)}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {monthLabel(d.key, true)} · {d.count} receipt{d.count === 1 ? "" : "s"}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <span />
          <div className="mt-1.5 flex text-[11px] text-muted">
            {data.map((d) => (
              <span
                key={d.key}
                className={`flex-1 text-center ${d.key === selected ? "font-semibold text-foreground" : ""}`}
              >
                {monthLabel(d.key)}
              </span>
            ))}
          </div>
        </div>
      )}
    </figure>
  );
}

/**
 * Single-series horizontal bars, ranked. Every bar carries its value at the
 * tip (≤ 9 categories), so the chart doubles as its own table.
 */
export function CategoryBars({
  data,
  currency,
  monthName,
  activeCategory,
  onSelect,
}: {
  data: { category: string; total: number }[];
  currency: Currency;
  monthName: string;
  activeCategory: string;
  onSelect: (category: string) => void;
}) {
  const sum = data.reduce((s, d) => s + d.total, 0);
  const max = Math.max(...data.map((d) => d.total), 0);

  return (
    <figure className="rounded-xl border border-border bg-surface p-4">
      <figcaption className="mb-4">
        <p className="text-sm font-semibold">By category</p>
        <p className="text-xs text-muted">
          {monthName} · {currency} · select a category to filter
        </p>
      </figcaption>
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No spending this month.</p>
      ) : (
        <ul className="space-y-1">
          {data.map((d) => {
            const active = activeCategory === d.category;
            return (
              <li key={d.category}>
                <button
                  type="button"
                  onClick={() => onSelect(active ? "" : d.category)}
                  aria-pressed={active}
                  className={`grid w-full grid-cols-[6.5rem_1fr] items-center gap-3 rounded-md px-1.5 py-1.5 text-left text-xs hover:bg-surface-muted ${
                    active ? "bg-surface-muted" : ""
                  }`}
                >
                  <span className={`truncate ${active ? "font-semibold" : "text-muted"}`}>{d.category}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="block h-3 shrink-0 rounded-r-[4px] bg-viz-accent"
                      style={{ width: `calc((100% - 7.5rem) * ${max ? d.total / max : 0})` }}
                    />
                    <span className="shrink-0 whitespace-nowrap tabular-nums">
                      <span className="font-medium text-foreground">{formatAmount(d.total, currency)}</span>
                      <span className="text-muted"> · {sum ? Math.round((d.total / sum) * 100) : 0}%</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}

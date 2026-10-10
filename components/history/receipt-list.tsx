"use client";

import { CloudOff, Copy, MoreHorizontal, Pin, PinOff, Search, ShieldCheck, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef } from "react";

import { inputClass } from "@/components/receipt/editor/fields";
import { monthLabel, type HistoryEntry } from "@/lib/history/entries";
import { formatAmount } from "@/lib/utils/currency";
import { CATEGORIES } from "@/lib/validators/receipt-schema";

export type ListFilters = { query: string; category: string; month: string };

function formatDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

function RowMenu({
  entry,
  onPin,
  onDuplicate,
  onDelete,
}: {
  entry: HistoryEntry;
  onPin: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const item = "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-muted";
  const run = (fn: () => void) => () => {
    menuRef.current?.hidePopover();
    fn();
  };

  // Place the popover under its trigger (flipping up near the bottom edge).
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const place = (e: Event) => {
      if ((e as ToggleEvent).newState !== "open" || !triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      const height = menu.offsetHeight || 140;
      const below = r.bottom + 4 + height <= window.innerHeight;
      menu.style.top = `${below ? r.bottom + 4 : r.top - 4 - height}px`;
      menu.style.left = `${Math.max(8, r.right - 192)}px`;
    };
    menu.addEventListener("beforetoggle", place);
    return () => menu.removeEventListener("beforetoggle", place);
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={id}
        aria-label={`Actions for ${entry.merchantName || "receipt"} ${entry.receiptNo}`}
        className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>
      <div
        ref={menuRef}
        id={id}
        popover="auto"
        className="fixed inset-auto m-0 w-48 rounded-lg border border-border bg-surface p-1.5 text-foreground shadow-lg"
      >
        <button type="button" className={item} onClick={run(onPin)}>
          {entry.isPinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
          {entry.isPinned ? "Unpin" : "Pin to top"}
        </button>
        <button type="button" className={item} onClick={run(onDuplicate)}>
          <Copy className="size-4" aria-hidden />
          Duplicate
        </button>
        <button type="button" className={`${item} text-danger`} onClick={run(onDelete)}>
          <Trash2 className="size-4" aria-hidden />
          Delete
        </button>
      </div>
    </>
  );
}

export function ReceiptList({
  entries,
  filters,
  onFiltersChange,
  onPin,
  onDuplicate,
  onDelete,
  showSyncState,
}: {
  entries: HistoryEntry[];
  /** Flag device-only receipts (only meaningful when signed in). */
  showSyncState: boolean;
  filters: ListFilters;
  onFiltersChange: (f: ListFilters) => void;
  onPin: (entry: HistoryEntry) => void;
  onDuplicate: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
}) {
  const q = filters.query.trim().toLowerCase();
  const visible = entries.filter(
    (e) =>
      (!filters.category || e.category === filters.category) &&
      (!filters.month || e.receiptDate.startsWith(filters.month)) &&
      (!q ||
        e.merchantName.toLowerCase().includes(q) ||
        e.receiptNo.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q)),
  );
  const hasFilters = !!(filters.query || filters.category || filters.month);

  return (
    <section aria-labelledby="receipts-heading" className="rounded-xl border border-border bg-surface">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="receipts-heading" className="text-sm font-semibold">
          Receipts <span className="font-normal text-muted">({visible.length})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
            <span className="sr-only">Search receipts</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              placeholder="Search merchant or no."
              value={filters.query}
              onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
              className={`${inputClass} pl-8`}
            />
          </label>
          <label>
            <span className="sr-only">Category</span>
            <select
              value={filters.category}
              onChange={(e) => onFiltersChange({ ...filters, category: e.target.value })}
              className={`${inputClass} w-auto`}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {filters.month && (
            <button
              type="button"
              onClick={() => onFiltersChange({ ...filters, month: "" })}
              className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium"
            >
              {monthLabel(filters.month, true)}
              <X className="size-3" aria-label="Clear month filter" />
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-muted">{hasFilters ? "No receipts match these filters." : "No receipts yet."}</p>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => onFiltersChange({ query: "", category: "", month: "" })}
              className="mt-2 text-sm font-medium underline-offset-2 hover:underline"
            >
              Clear filters
            </button>
          ) : (
            <Link href="/studio" className="mt-2 inline-block text-sm font-medium underline-offset-2 hover:underline">
              Create your first receipt
            </Link>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((e) => (
            <li key={e.id} className="flex items-center gap-2 px-2 sm:px-3">
              <Link
                href={`/studio?id=${e.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-3 hover:bg-surface-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {e.isPinned && <Pin className="size-3.5 shrink-0 text-muted" aria-label="Pinned" />}
                    <span className="truncate">{e.merchantName || "Untitled receipt"}</span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                    <span>{formatDate(e.receiptDate)}</span>
                    <span aria-hidden>·</span>
                    <span className="font-mono">{e.receiptNo}</span>
                    <span aria-hidden>·</span>
                    <span>{e.category}</span>
                    {e.warrantyUntil && (
                      <span className="inline-flex items-center gap-0.5">
                        <ShieldCheck className="size-3" aria-hidden />
                        Warranty
                      </span>
                    )}
                    {showSyncState && !e.synced && (
                      <span className="inline-flex items-center gap-0.5 text-warning">
                        <CloudOff className="size-3" aria-hidden />
                        This device only
                      </span>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  <span className="text-xs font-normal text-muted">{e.currency}</span> {formatAmount(e.total, e.currency)}
                </span>
              </Link>
              <RowMenu
                entry={e}
                onPin={() => onPin(e)}
                onDuplicate={() => onDuplicate(e)}
                onDelete={() => onDelete(e)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";

import { CloudOff, Copy, FileDown, MoreHorizontal, Pin, PinOff, Search, ShieldCheck, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef } from "react";

import { inputClass } from "@/components/receipt/editor/fields";
import { useMonthLabel } from "@/components/history/charts";
import { downloadCsv, entriesToCsv } from "@/lib/history/csv";
import type { HistoryEntry } from "@/lib/history/entries";
import { useT, type MessageKey } from "@/lib/i18n/messages";
import { toast } from "@/lib/store/toast-store";
import { formatAmount } from "@/lib/utils/currency";
import { CATEGORIES } from "@/lib/validators/receipt-schema";

export type ListFilters = { query: string; category: string; month: string; day: string; wallet: string; tag: string };

function formatDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

/** Tiny torn-edge slip with the merchant's initial, as a list thumbnail. */
function ReceiptThumb({ name }: { name: string }) {
  const initial = (name.trim()[0] ?? "R").toUpperCase();
  return (
    <span aria-hidden className="relative flex h-11 w-9 shrink-0 items-start justify-center pt-1.5">
      <svg viewBox="0 0 36 44" className="absolute inset-0 size-full drop-shadow-sm">
        <path
          d="M2 1h32v38l-3.2 3-3.2-3-3.2 3-3.2-3-3.2 3-3.2-3-3.2 3-3.2-3L2 42z"
          fill="#faf9f5"
          stroke="rgba(0,0,0,0.08)"
        />
        <path d="M9 24h18M9 29h18M9 34h11" stroke="#1a1a1a" strokeOpacity=".35" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="relative font-mono text-xs font-bold text-[#1a1a1a]">{initial}</span>
    </span>
  );
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
  const t = useT();
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
        aria-label={t("list.actions", { name: `${entry.merchantName || t("list.untitled")} ${entry.receiptNo}` })}
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
          {entry.isPinned ? t("list.unpin") : t("list.pin")}
        </button>
        <button type="button" className={item} onClick={run(onDuplicate)}>
          <Copy className="size-4" aria-hidden />
          {t("list.duplicate")}
        </button>
        <button type="button" className={`${item} text-danger`} onClick={run(onDelete)}>
          <Trash2 className="size-4" aria-hidden />
          {t("list.delete")}
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
  const t = useT();
  const ml = useMonthLabel();
  const q = filters.query.trim().toLowerCase();
  const visible = entries.filter(
    (e) =>
      (!filters.category || e.category === filters.category) &&
      (!filters.month || e.receiptDate.startsWith(filters.month)) &&
      (!filters.day || e.receiptDate.startsWith(filters.day)) &&
      (!filters.wallet || e.wallet === filters.wallet) &&
      (!filters.tag || e.tags.includes(filters.tag)) &&
      (!q ||
        e.merchantName.toLowerCase().includes(q) ||
        e.receiptNo.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.wallet.toLowerCase().includes(q) ||
        e.tags.some((tag) => tag.includes(q.replace(/^#/, "")))),
  );
  const hasFilters = !!(filters.query || filters.category || filters.month || filters.day || filters.wallet || filters.tag);

  function exportCsv() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(entriesToCsv(visible), `ryannreceipt-${filters.month || "receipts"}-${stamp}.csv`);
    toast(t("list.csvDone", { count: visible.length }), { tone: "success" });
  }

  return (
    <section aria-labelledby="receipts-heading" className="rounded-2xl border border-border bg-surface">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="receipts-heading" className="text-sm font-semibold">
          {t("list.title")} <span className="font-normal text-muted">({visible.length})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
            <span className="sr-only">{t("list.search")}</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              placeholder={t("list.searchPh")}
              value={filters.query}
              onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
              className={`${inputClass} pl-8`}
            />
          </label>
          <label>
            <span className="sr-only">{t("field.category")}</span>
            <select
              value={filters.category}
              onChange={(e) => onFiltersChange({ ...filters, category: e.target.value })}
              className={`${inputClass} w-auto`}
            >
              <option value="">{t("list.allCategories")}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`cat.${c}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ["month", filters.month && ml(filters.month, true)],
              ["day", filters.day],
              ["wallet", filters.wallet],
              ["tag", filters.tag && `#${filters.tag}`],
            ] as const
          ).map(([key, label]) =>
            label ? (
              <button
                key={key}
                type="button"
                onClick={() => onFiltersChange({ ...filters, [key]: "" })}
                className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium"
              >
                {label}
                <X className="size-3" aria-label={t("list.clearFilter")} />
              </button>
            ) : null,
          )}
          <button
            type="button"
            onClick={exportCsv}
            disabled={visible.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-muted ring-1 ring-border hover:bg-surface-muted hover:text-foreground disabled:opacity-40"
          >
            <FileDown className="size-4" aria-hidden />
            {t("list.exportCsv")}
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-muted">{hasFilters ? t("list.noMatch") : t("list.none")}</p>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => onFiltersChange({ query: "", category: "", month: "", day: "", wallet: "", tag: "" })}
              className="mt-2 text-sm font-medium underline-offset-2 hover:underline"
            >
              {t("list.clearFilters")}
            </button>
          ) : (
            <Link href="/studio" className="mt-2 inline-block text-sm font-medium underline-offset-2 hover:underline">
              {t("list.createFirst")}
            </Link>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((e) => (
            <li key={e.id} className="flex items-center gap-2 px-2 sm:px-3">
              <Link
                href={`/studio?id=${e.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-muted"
              >
                <ReceiptThumb name={e.merchantName} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {e.isPinned && <Pin className="size-3.5 shrink-0 text-muted" aria-label={t("list.pinned")} />}
                    <span className="truncate">{e.merchantName || t("list.untitled")}</span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                    <span>{formatDate(e.receiptDate)}</span>
                    <span aria-hidden>·</span>
                    <span className="font-mono">{e.receiptNo}</span>
                    <span aria-hidden>·</span>
                    <span>{t(`cat.${e.category}` as MessageKey)}</span>
                    {e.wallet && <span>{e.wallet}</span>}
                    {e.tags
                      .filter((tag) => tag !== "recurring")
                      .slice(0, 3)
                      .map((tag) => (
                        <span key={tag}>#{tag}</span>
                      ))}
                    {e.warrantyUntil && (
                      <span className="inline-flex items-center gap-0.5">
                        <ShieldCheck className="size-3" aria-hidden />
                        {t("list.warranty")}
                      </span>
                    )}
                    {showSyncState && !e.synced && (
                      <span className="inline-flex items-center gap-0.5 text-warning">
                        <CloudOff className="size-3" aria-hidden />
                        {t("list.deviceOnly")}
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

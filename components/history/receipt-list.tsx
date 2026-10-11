"use client";

import { CloudOff, Copy, FileDown, FileUp, Link2, MoreHorizontal, Pin, PinOff, Search, ShieldCheck, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef } from "react";

import { inputClass } from "@/components/receipt/editor/fields";
import { useMonthLabel } from "@/components/history/charts";
import { SwipeRow } from "@/components/history/swipe-row";
import { CategoryTile } from "@/components/quick-add/category-icons";
import { downloadCsv, entriesToCsv } from "@/lib/history/csv";
import { todayKey, type HistoryEntry } from "@/lib/history/entries";
import { INTL_LOCALE, useLocale, useT, type MessageKey } from "@/lib/i18n/messages";
import { toast } from "@/lib/store/toast-store";
import { useUiStore } from "@/lib/store/ui-store";
import { formatAmount } from "@/lib/utils/currency";
import { CATEGORIES } from "@/lib/validators/receipt-schema";

export type ListFilters = { query: string; category: string; month: string; day: string; wallet: string; tag: string };

type DayGroup = { key: string; label: string; entries: HistoryEntry[]; total: number | null };

/**
 * Pinned receipts first, then one group per day ("Today", "Yesterday",
 * "Fri, 9 Oct") with the day's total when every receipt shares a currency.
 */
function groupByDay(entries: HistoryEntry[], today: string, intlLocale: string, t: ReturnType<typeof useT>): DayGroup[] {
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const groups = new Map<string, DayGroup>();
  const label = (day: string) => {
    if (day === today) return t("list.today");
    if (day === yesterday) return t("list.yesterday");
    const [y, m, d] = day.split("-").map(Number);
    return new Intl.DateTimeFormat(intlLocale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      ...(day.slice(0, 4) !== today.slice(0, 4) && { year: "numeric" }),
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, d)));
  };
  for (const e of entries) {
    const key = e.isPinned ? "pinned" : e.receiptDate.slice(0, 10);
    if (!groups.has(key)) groups.set(key, { key, label: key === "pinned" ? t("list.pinnedGroup") : label(key), entries: [], total: 0 });
    groups.get(key)!.entries.push(e);
  }
  for (const g of groups.values()) {
    const currencies = new Set(g.entries.map((e) => e.currency));
    g.total = g.key !== "pinned" && currencies.size === 1 ? g.entries.reduce((sum, e) => sum + e.spent, 0) : null;
  }
  return [...groups.values()];
}

function RowMenu({
  entry,
  onPin,
  onDuplicate,
  onDelete,
  onSplit,
}: {
  entry: HistoryEntry;
  onPin: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSplit: () => void;
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
        <button type="button" className={item} onClick={run(onSplit)}>
          <Users className="size-4" aria-hidden />
          {t("split.button")}
        </button>
        <button type="button" className={item} onClick={run(() => useUiStore.getState().setShareLinkReceiptId(entry.id))}>
          <Link2 className="size-4" aria-hidden />
          {t("link.title")}
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
  onSplit,
  showSyncState,
  convertTo,
  homeCurrency,
}: {
  /** Travel mode: amount in the home currency for foreign receipts (null = same currency). */
  convertTo?: (entry: HistoryEntry) => number | null;
  homeCurrency?: string;
  entries: HistoryEntry[];
  /** Flag device-only receipts (only meaningful when signed in). */
  showSyncState: boolean;
  filters: ListFilters;
  onFiltersChange: (f: ListFilters) => void;
  onPin: (entry: HistoryEntry) => void;
  onDuplicate: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
  onSplit: (entry: HistoryEntry) => void;
}) {
  const t = useT();
  const ml = useMonthLabel();
  const locale = useLocale();
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
          <label className="relative min-w-0 basis-full sm:w-56 sm:basis-auto sm:flex-none">
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
            onClick={() => useUiStore.getState().setImportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-muted ring-1 ring-border hover:bg-surface-muted hover:text-foreground"
          >
            <FileUp className="size-4" aria-hidden />
            <span className="max-sm:sr-only">{t("import.button")}</span>
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={visible.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-muted ring-1 ring-border hover:bg-surface-muted hover:text-foreground disabled:opacity-40"
          >
            <FileDown className="size-4" aria-hidden />
            <span className="max-sm:sr-only">{t("list.exportCsv")}</span>
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
        <div>
          {groupByDay(visible, todayKey(), INTL_LOCALE[locale], t).map((g) => (
            <section key={g.key} aria-label={g.label}>
              <h3 className="sticky top-0 z-[1] flex items-baseline justify-between border-b border-border bg-surface/95 px-4 pt-3 pb-1.5 text-xs font-semibold text-muted backdrop-blur sm:px-5">
                <span className="tracking-wide uppercase">{g.label}</span>
                {g.total !== null && (
                  <span className="tabular-nums">
                    {g.entries[0].currency} {formatAmount(g.total, g.entries[0].currency)}
                  </span>
                )}
              </h3>
              <ul className="divide-y divide-border">
                {g.entries.map((e) => (
                <SwipeRow
                      key={e.id}
                      className="flex items-center gap-2 px-2 sm:px-3"
                      onSwipeLeft={() => onDelete(e)}
                      onSwipeRight={() => onSplit(e)}
                      leftLabel={t("list.delete")}
                      rightLabel={t("split.button")}
                    >
                  <Link
                    href={`/studio?id=${e.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-muted"
                  >
                    <CategoryTile category={e.category} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {e.isPinned && <Pin className="size-3.5 shrink-0 text-muted" aria-label={t("list.pinned")} />}
                        <span className="truncate">{e.merchantName || t("list.untitled")}</span>
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                        <span>{t(`cat.${e.category}` as MessageKey)}</span>
                        {e.wallet && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{e.wallet}</span>
                          </>
                        )}
                        {e.tags
                          .filter((tag) => tag !== "recurring")
                          .slice(0, 3)
                          .map((tag) => (
                            <span key={tag}>#{tag}</span>
                          ))}
                        {e.split && (
                          <span className="inline-flex items-center gap-0.5">
                            <Users className="size-3" aria-hidden />
                            {t("split.badge", {
                              count: e.split.people.length,
                              unpaid: e.split.people.filter((p) => !p.paid).length,
                            })}
                          </span>
                        )}
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
                    <span className="shrink-0 text-right text-sm font-semibold tabular-nums">
                      <span className="text-xs font-normal text-muted">{e.currency}</span> {formatAmount(e.spent, e.currency)}
                      {convertTo && convertTo(e) !== null && (
                        <span className="block text-[11px] font-normal text-muted">
                          ≈ {homeCurrency} {formatAmount(convertTo(e)!, "MYR")}
                        </span>
                      )}
                      {e.split && e.spent !== e.total && (
                        <span className="block text-[11px] font-normal text-muted">
                          {t("split.ofBill", { total: formatAmount(e.total, e.currency) })}
                        </span>
                      )}
                    </span>
                  </Link>
                  <RowMenu
                    entry={e}
                    onPin={() => onPin(e)}
                    onDuplicate={() => onDuplicate(e)}
                    onDelete={() => onDelete(e)}
                    onSplit={() => onSplit(e)}
                  />
                </SwipeRow>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

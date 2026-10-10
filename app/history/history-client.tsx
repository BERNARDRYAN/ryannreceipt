"use client";

import { CloudUpload, HardDrive, LoaderCircle, Plus, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { CategoryBars, MonthlyChart, StatTile } from "@/components/history/charts";
import { ReceiptList, type ListFilters } from "@/components/history/receipt-list";
import { WarrantyTracker } from "@/components/history/warranty-tracker";
import { buttonStyles } from "@/components/ui/dialog";
import {
  dominantCurrency,
  fromLocal,
  lastMonths,
  mergeEntries,
  monthKey,
  monthLabel,
  sortEntries,
  sumBy,
  todayKey,
  warrantyState,
  type HistoryEntry,
} from "@/lib/history/entries";
import { useAuthStore } from "@/lib/store/auth-store";
import { isDirty, useLibraryHydrated, useReceiptStore } from "@/lib/store/receipt-store";
import { toast } from "@/lib/store/toast-store";
import {
  deleteCloudReceipt,
  dirtyReceipts,
  fetchCloudSummaries,
  pullReceipt,
  pushReceipts,
  setCloudPinned,
  type CloudSummary,
} from "@/lib/sync/cloud";
import { formatAmount } from "@/lib/utils/currency";
import { CURRENCIES, type Currency } from "@/lib/validators/receipt-schema";

const UNDO_MS = 5000;
// Module-level so a pending delete still completes if the user navigates away.
const pendingTimers = new Map<string, number>();

export function HistoryClient() {
  const router = useRouter();
  const hydrated = useLibraryHydrated();
  const authStatus = useAuthStore((s) => s.status);
  const signedIn = authStatus === "signed-in";
  const receipts = useReceiptStore((s) => s.receipts);
  const [cloud, setCloud] = useState<CloudSummary[] | null>(null);
  const [cloudError, setCloudError] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [currencyChoice, setCurrencyChoice] = useState<Currency | null>(null);
  // Empty = "current month"; the date is only read in the browser (prerender must stay deterministic).
  const [monthChoice, setMonthChoice] = useState("");
  const [filters, setFilters] = useState<ListFilters>({ query: "", category: "", month: "" });
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetchCloudSummaries()
      .then((list) => {
        if (!cancelled) {
          setCloud(list);
          setCloudError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setCloudError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const local = useMemo(() => Object.values(receipts), [receipts]);
  const pendingSync = local.filter(isDirty).length;

  const entries: HistoryEntry[] | null = useMemo(() => {
    if (!hydrated || authStatus === "loading") return null;
    // Cloud failed to load: fall back to what this device has.
    const all = signedIn && cloud && !cloudError ? mergeEntries(cloud, local) : local.map(fromLocal);
    return sortEntries(all.filter((e) => !hidden.has(e.id)));
  }, [hydrated, authStatus, signedIn, cloud, cloudError, local, hidden]);

  const loadingCloud = signedIn && !cloud && !cloudError;

  // ---- actions -----------------------------------------------------------

  async function handlePin(entry: HistoryEntry) {
    const pinned = !entry.isPinned;
    const store = useReceiptStore.getState();
    const localCopy = store.receipts[entry.id];
    // Only a copy with no other pending edits may be marked synced after the pin.
    const wasClean = localCopy ? !isDirty(localCopy) : false;
    if (localCopy) store.setPinned(entry.id, pinned);
    if (signedIn && cloud?.some((c) => c.id === entry.id)) {
      setCloud((prev) => prev?.map((c) => (c.id === entry.id ? { ...c, isPinned: pinned } : c)) ?? prev);
      try {
        await setCloudPinned(entry.id, pinned);
        const after = useReceiptStore.getState().receipts[entry.id];
        if (wasClean && after) useReceiptStore.getState().markSynced([{ id: entry.id, updatedAt: after.updatedAt }]);
      } catch {
        toast("Couldn't update the pin. Try again.", { tone: "error" });
      }
    }
  }

  async function handleDuplicate(entry: HistoryEntry) {
    try {
      if (!useReceiptStore.getState().receipts[entry.id]) await pullReceipt(entry.id);
      const copyId = useReceiptStore.getState().duplicateReceipt(entry.id);
      if (copyId) router.push(`/studio?id=${copyId}`);
    } catch {
      toast("Couldn't duplicate that receipt.", { tone: "error" });
    }
  }

  function handleDelete(entry: HistoryEntry) {
    setHidden((prev) => new Set(prev).add(entry.id));
    const inCloud = signedIn && (cloud?.some((c) => c.id === entry.id) ?? false);

    const timer = window.setTimeout(async () => {
      pendingTimers.delete(entry.id);
      useReceiptStore.getState().deleteReceipt(entry.id);
      if (inCloud) {
        try {
          await deleteCloudReceipt(entry.id);
          setCloud((prev) => prev?.filter((c) => c.id !== entry.id) ?? prev);
        } catch {
          toast("Couldn't delete it from your account. Try again.", { tone: "error" });
          setHidden((prev) => {
            const next = new Set(prev);
            next.delete(entry.id);
            return next;
          });
        }
      }
    }, UNDO_MS);
    pendingTimers.set(entry.id, timer);

    toast(`Deleted ${entry.merchantName || "receipt"} ${entry.receiptNo}`.trim(), {
      durationMs: UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => {
          window.clearTimeout(pendingTimers.get(entry.id));
          pendingTimers.delete(entry.id);
          setHidden((prev) => {
            const next = new Set(prev);
            next.delete(entry.id);
            return next;
          });
        },
      },
    });
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await pushReceipts(dirtyReceipts());
      setCloud(await fetchCloudSummaries());
      toast("Everything is synced", { tone: "success" });
    } catch {
      toast("Sync failed. Your drafts are still on this device.", { tone: "error" });
    } finally {
      setSyncing(false);
    }
  }

  // ---- derived stats -----------------------------------------------------

  const today = hydrated ? todayKey() : "";
  const currentMonth = today.slice(0, 7);
  const selectedMonth = monthChoice || currentMonth;
  const currency = currencyChoice ?? (entries && dominantCurrency(entries)) ?? "MYR";
  const inCurrency = entries?.filter((e) => e.currency === currency) ?? [];
  const otherCurrencyCount = (entries?.length ?? 0) - inCurrency.length;
  const usedCurrencies = CURRENCIES.filter((c) => entries?.some((e) => e.currency === c));

  const months = currentMonth ? lastMonths(currentMonth, 6) : [];
  const totalsByMonth = sumBy(inCurrency, (e) => monthKey(e.receiptDate), (e) => e.total);
  const countsByMonth = sumBy(inCurrency, (e) => monthKey(e.receiptDate), () => 1);
  const monthData = months.map((key) => ({
    key,
    total: totalsByMonth.get(key) ?? 0,
    count: countsByMonth.get(key) ?? 0,
  }));
  const selTotal = totalsByMonth.get(selectedMonth) ?? 0;
  const prevKey = selectedMonth ? lastMonths(selectedMonth, 2)[0] : "";
  const prevTotal = totalsByMonth.get(prevKey) ?? 0;
  const categoryData = [
    ...sumBy(
      inCurrency.filter((e) => monthKey(e.receiptDate) === selectedMonth),
      (e) => e.category,
      (e) => e.total,
    ),
  ]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const warranties = entries?.filter((e) => e.warrantyUntil) ?? [];
  const soon = warranties.filter((e) => warrantyState(e.warrantyUntil, today).kind === "soon").length;
  const activeWarranties = warranties.filter((e) => warrantyState(e.warrantyUntil, today).kind !== "expired").length;

  function selectMonth(key: string) {
    setMonthChoice(key);
    setFilters((f) => ({ ...f, month: f.month === key ? "" : key }));
  }

  // ---- render ------------------------------------------------------------

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader section="history" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">History</h1>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted">
              {signedIn ? (
                cloudError ? (
                  "Couldn't reach your account, so this shows receipts on this device."
                ) : (
                  "Receipts synced with your account."
                )
              ) : (
                <>
                  <HardDrive className="size-3.5" aria-hidden />
                  Saved on this device. Sign in to back them up and sync.
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {usedCurrencies.length > 1 && (
              <label className="text-sm">
                <span className="sr-only">Currency for charts</span>
                <select
                  value={currency}
                  onChange={(e) => setCurrencyChoice(e.target.value as Currency)}
                  className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm"
                >
                  {usedCurrencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            )}
            {signedIn && pendingSync > 0 && (
              <button type="button" onClick={handleSync} disabled={syncing} className={buttonStyles.secondary}>
                {syncing ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  <CloudUpload className="size-4" aria-hidden />
                )}
                Sync {pendingSync}
              </button>
            )}
            <Link href="/studio" className={buttonStyles.primary}>
              <Plus className="size-4" aria-hidden />
              New receipt
            </Link>
          </div>
        </div>

        {!entries || loadingCloud ? (
          <div aria-busy className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-surface" />
            ))}
            <div className="h-72 animate-pulse rounded-xl bg-surface sm:col-span-3" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
            <ReceiptText className="size-8 text-muted" aria-hidden />
            <h2 className="mt-3 text-base font-semibold">No receipts yet</h2>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Receipts you make in the studio show up here with monthly spending and warranty reminders.
            </p>
            <Link href="/studio" className={`${buttonStyles.primary} mt-4`}>
              Open the studio
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 [&>:first-child]:col-span-2 sm:[&>:first-child]:col-span-1">
              <StatTile
                label={`Spent in ${monthLabel(selectedMonth, true)}`}
                value={`${currency} ${formatAmount(selTotal, currency)}`}
                delta={
                  prevTotal > 0
                    ? {
                        value: selTotal - prevTotal,
                        label: `${selTotal >= prevTotal ? "+" : "-"}${formatAmount(Math.abs(selTotal - prevTotal), currency)} vs ${monthLabel(prevKey)}`,
                      }
                    : undefined
                }
                sub={otherCurrencyCount > 0 ? `${otherCurrencyCount} receipt(s) in other currencies not included` : undefined}
              />
              <StatTile
                label={`Receipts in ${monthLabel(selectedMonth, true)}`}
                value={countsByMonth.get(selectedMonth) ?? 0}
                sub={`${entries.length} receipt${entries.length === 1 ? "" : "s"} in total`}
              />
              <StatTile
                label="Active warranties"
                value={activeWarranties}
                sub={
                  soon > 0 ? (
                    <span className="font-medium text-warning">
                      {soon} expiring within 30 days
                    </span>
                  ) : (
                    "None expiring in the next 30 days"
                  )
                }
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
              <MonthlyChart data={monthData} currency={currency} selected={selectedMonth} onSelect={selectMonth} />
              <CategoryBars
                data={categoryData}
                currency={currency}
                monthName={monthLabel(selectedMonth, true)}
                activeCategory={filters.category}
                onSelect={(category) => setFilters((f) => ({ ...f, category }))}
              />
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-[1fr_22rem]">
              <ReceiptList
                entries={entries}
                showSyncState={signedIn}
                filters={filters}
                onFiltersChange={setFilters}
                onPin={handlePin}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
              <WarrantyTracker entries={entries} today={today} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

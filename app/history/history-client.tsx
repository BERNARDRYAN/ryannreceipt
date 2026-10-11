"use client";

import { Camera, ChevronDown, Flame, X, Landmark, Repeat, ShieldCheck, TrendingDown, TrendingUp, Users, CloudUpload, FileDown, Globe, HardDrive, LoaderCircle, Plus, ReceiptText, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { AppHeader } from "@/components/app-header";
import { Breakdown, type BreakdownMode } from "@/components/history/breakdown";
import { BudgetsDialog } from "@/components/history/budgets-dialog";
import { SpendingCalendar } from "@/components/history/calendar";
import { MonthlyChart, StatTile, useMonthLabel } from "@/components/history/charts";
import { MoreTools, type Tool } from "@/components/history/more-tools";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { EditExpenseDialog } from "@/components/quick-add/quick-add-dialog";
import { friendBalances, FriendsCard } from "@/components/history/owed";
import { YearReviewDialog } from "@/components/history/year-review";
import { ReceiptList, type ListFilters } from "@/components/history/receipt-list";
import { RecurringCard } from "@/components/history/recurring";
import { TaxReliefCard } from "@/components/history/tax-relief";
import { WarrantyTracker } from "@/components/history/warranty-tracker";
import { buttonStyles } from "@/components/ui/dialog";
import {
  fromLocal,
  lastMonths,
  mergeEntries,
  monthKey,
  sortEntries,
  sumBy,
  todayKey,
  warrantyState,
  type HistoryEntry,
} from "@/lib/history/entries";
import { translate, useT, type MessageKey } from "@/lib/i18n/messages";
import { convert, useFxRates } from "@/lib/fx/rates";
import { pickInsight, type Insight } from "@/lib/history/insights";
import { downloadMonthlyReport } from "@/lib/reports/pdf";
import { useAuthStore } from "@/lib/store/auth-store";
import { useSettingsHydrated, useSettingsStore } from "@/lib/store/settings-store";
import { useUiStore } from "@/lib/store/ui-store";
import { isDirty, useLibraryHydrated, useReceiptStore } from "@/lib/store/receipt-store";
import { toast } from "@/lib/store/toast-store";
import {
  deleteCloudReceipt,
  dirtyReceipts,
  fetchCloudSummaries,
  pullReceipt,
  pushReceipts,
  setCloudPinned,
  useSyncState,
  type CloudSummary,
} from "@/lib/sync/cloud";
import { formatAmount } from "@/lib/utils/currency";
import { CURRENCIES, type Currency } from "@/lib/validators/receipt-schema";

const UNDO_MS = 5000;
export const HOME_KEY = "ryannreceipt:home";
const EMPTY_FILTERS: ListFilters = { query: "", category: "", month: "", day: "", wallet: "", tag: "" };
// Module-level so a pending delete still completes if the user navigates away.
const pendingTimers = new Map<string, number>();

/** One short observation about spending, e.g. "Food & Drink is down 23% vs this time last month". */
function InsightPill({ insight }: { insight: Insight }) {
  const t = useT();
  const Icon = insight.kind === "streak" ? Flame : insight.direction === "down" ? TrendingDown : TrendingUp;
  const text =
    insight.kind === "streak"
      ? t("insight.streak", { days: insight.days })
      : insight.kind === "month"
        ? t(insight.direction === "down" ? "insight.monthDown" : "insight.monthUp", { pct: insight.pct })
        : t(insight.direction === "down" ? "insight.catDown" : "insight.catUp", {
            category: t(`cat.${insight.category}` as MessageKey),
            pct: insight.pct,
          });
  return (
    <p className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm shadow-sm ring-1 ring-border">
      <Icon className={`size-4 shrink-0 ${insight.kind === "streak" ? "text-viz-accent" : "text-muted"}`} aria-hidden />
      <span className="min-w-0">{text}</span>
    </p>
  );
}

export function HistoryClient() {
  const t = useT();
  const ml = useMonthLabel();
  const router = useRouter();
  const hydrated = useLibraryHydrated();
  const authStatus = useAuthStore((s) => s.status);
  const signedIn = authStatus === "signed-in";
  const receipts = useReceiptStore((s) => s.receipts);
  const [cloud, setCloud] = useState<CloudSummary[] | null>(null);
  const [cloudError, setCloudError] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  // Empty = "current month"; the date is only read in the browser (prerender must stay deterministic).
  const [monthChoice, setMonthChoice] = useState("");
  const [filters, setFilters] = useState<ListFilters>(EMPTY_FILTERS);
  const [syncing, setSyncing] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  useSettingsHydrated();
  const budgets = useSettingsStore((s) => s.budgets);
  const homeCurrency = useSettingsStore((s) => s.homeCurrency);
  const setHomeCurrency = useSettingsStore((s) => s.setHomeCurrency);
  const categoryBudgets = useSettingsStore((s) => s.categoryBudgets);
  const recurringRules = useSettingsStore((s) => s.recurring);
  // Empty tools live folded in "More tools" until opened (or until they have data).
  const [openedTools, setOpenedTools] = useState<Set<string>>(() => new Set());
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const openScan = useUiStore((s) => s.openScan);
  const uploading = useSyncState((s) => s.saving);

  // Home is the app's front door: remember it (the landing page then skips
  // straight here), and open Add expense for the "?add=1" app shortcut.
  useEffect(() => {
    try {
      localStorage.setItem(HOME_KEY, "1");
    } catch {
      // Private mode: the landing page simply shows as usual.
    }
    if (new URLSearchParams(window.location.search).get("add") === "1") {
      useUiStore.getState().setQuickAddOpen(true);
      window.history.replaceState(null, "", "/history");
    }
  }, []);

  // Load (and after every upload, refresh) the cloud list so new receipts
  // from Quick Add, scans or recurring rules don't drop out once synced.
  useEffect(() => {
    if (!signedIn || uploading) return;
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
  }, [signedIn, uploading]);

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
        toast(t("history.pinFailed"), { tone: "error" });
      }
    }
  }

  async function handleDuplicate(entry: HistoryEntry) {
    try {
      if (!useReceiptStore.getState().receipts[entry.id]) await pullReceipt(entry.id);
      const copyId = useReceiptStore.getState().duplicateReceipt(entry.id);
      if (copyId) router.push(`/studio?id=${copyId}`);
    } catch {
      toast(t("history.duplicateFailed"), { tone: "error" });
    }
  }

  function handleDelete(entry: HistoryEntry) {
    setHidden((prev) => new Set(prev).add(entry.id));
    const inCloud = signedIn && (cloud?.some((c) => c.id === entry.id) ?? false);

    const unhide = () =>
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    const timer = window.setTimeout(async () => {
      pendingTimers.delete(entry.id);
      useReceiptStore.getState().deleteReceipt(entry.id);
      if (inCloud) {
        try {
          await deleteCloudReceipt(entry.id);
          setCloud((prev) => prev?.filter((c) => c.id !== entry.id) ?? prev);
        } catch {
          toast(t("history.deleteFailed"), { tone: "error" });
        }
      }
      // Gone for good (or the delete failed): stop hiding the id, so a restored
      // or re-synced copy shows up again.
      unhide();
    }, UNDO_MS);
    pendingTimers.set(entry.id, timer);

    toast(t("list.deleted", { name: `${entry.merchantName || t("list.untitled")} ${entry.receiptNo}`.trim() }), {
      durationMs: UNDO_MS,
      action: {
        label: t("common.undo"),
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

  /** Record that someone paid back their share of a split bill. */
  async function markPaid(entryId: string, personId: string) {
    try {
      if (!useReceiptStore.getState().receipts[entryId]) await pullReceipt(entryId);
      const receipt = useReceiptStore.getState().receipts[entryId];
      const split = receipt?.draft.split;
      if (!receipt || !split) return;
      useReceiptStore.getState().patchDraft(entryId, {
        split: { ...split, paid: { ...split.paid, [personId]: new Date().toISOString() } },
      });
      toast(t("owed.marked"), { tone: "success" });
      if (signedIn) {
        const updated = useReceiptStore.getState().receipts[entryId];
        if (updated) await pushReceipts([updated]);
      }
    } catch {
      toast(t("history.pinFailed"), { tone: "error" });
    }
  }

  /** Split needs the full receipt locally; pull it first if it only lives in the cloud. */
  /** Tap an expense: the simple edit sheet (cloud-only ones are fetched first). */
  async function openEdit(id: string) {
    try {
      if (!useReceiptStore.getState().receipts[id]) await pullReceipt(id);
      setEditId(id);
    } catch {
      toast(t("studio.openFailed"), { tone: "error" });
    }
  }

  async function openSplit(id: string) {
    try {
      if (!useReceiptStore.getState().receipts[id]) await pullReceipt(id);
      useUiStore.getState().setSplitReceiptId(id);
    } catch {
      toast(t("studio.openFailed"), { tone: "error" });
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await pushReceipts(dirtyReceipts());
      setCloud(await fetchCloudSummaries());
      toast(t("history.allSynced"), { tone: "success" });
    } catch {
      toast(t("sync.failed"), { tone: "error" });
    } finally {
      setSyncing(false);
    }
  }

  // ---- derived stats -----------------------------------------------------

  const today = hydrated ? todayKey() : "";
  const currentMonth = today.slice(0, 7);
  const selectedMonth = monthChoice || currentMonth;
  // Travel mode: everything is shown in the home currency; foreign receipts
  // are converted at today's ECB reference rate (only if any exist).
  const currency = homeCurrency;
  const hasForeign = !!entries?.some((e) => e.currency !== currency);
  const fx = useFxRates(hasForeign);
  const inCurrency = (entries ?? []).flatMap((e) => {
    if (e.currency === currency) return [e];
    const spent = convert(e.spent, e.currency, currency, fx);
    return spent === null ? [] : [{ ...e, spent, total: convert(e.total, e.currency, currency, fx) ?? e.total, currency }];
  });
  const insight = hydrated && entries ? pickInsight(inCurrency, today) : null;
  // Receipts we couldn't convert (rates not loaded yet / offline first visit).
  const otherCurrencyCount = (entries?.length ?? 0) - inCurrency.length;

  const months = currentMonth ? lastMonths(currentMonth, 6) : [];
  const totalsByMonth = sumBy(inCurrency, (e) => monthKey(e.receiptDate), (e) => e.spent);
  const countsByMonth = sumBy(inCurrency, (e) => monthKey(e.receiptDate), () => 1);
  const monthData = months.map((key) => ({
    key,
    total: totalsByMonth.get(key) ?? 0,
    count: countsByMonth.get(key) ?? 0,
  }));
  const selTotal = totalsByMonth.get(selectedMonth) ?? 0;
  const prevKey = selectedMonth ? lastMonths(selectedMonth, 2)[0] : "";
  const prevTotal = totalsByMonth.get(prevKey) ?? 0;

  const budget = budgets[currency] ?? 0;
  const budgetPct = budget > 0 ? (selTotal / budget) * 100 : undefined;
  const budgetSub =
    budget > 0
      ? selTotal > budget
        ? t("budget.over", { amount: `${currency} ${formatAmount(selTotal - budget, currency)}` })
        : `${t("budget.of", { pct: Math.round(budgetPct ?? 0), amount: `${currency} ${formatAmount(budget, currency)}` })} · ${t("budget.left", { amount: formatAmount(budget - selTotal, currency) })}`
      : undefined;

  const inMonth = inCurrency.filter((e) => monthKey(e.receiptDate) === selectedMonth);
  const dayTotals = sumBy(inCurrency, (e) => e.receiptDate.slice(0, 10), (e) => e.spent);
  const todayTotal = dayTotals.get(today) ?? 0;
  const todayCount = inCurrency.filter((e) => e.receiptDate.startsWith(today)).length;
  const catBudgets = categoryBudgets[currency] ?? {};
  const byCategory = [...sumBy(inMonth, (e) => e.category, (e) => e.spent)]
    .map(([key, total]) => ({ key, total, budget: catBudgets[key as keyof typeof catBudgets] }))
    .concat(
      // Budgeted categories with no spending yet still show their limit.
      Object.entries(catBudgets)
        .filter(([key, b]) => b && !inMonth.some((e) => e.category === key))
        .map(([key, budget]) => ({ key, total: 0, budget })),
    )
    .sort((a, b) => b.total - a.total);
  const byWallet = [...sumBy(inMonth, (e) => e.wallet, (e) => e.spent)]
    .map(([key, total]) => ({ key, total }))
    .sort((a, b) => b.total - a.total);
  const byTag = [
    ...sumBy(
      inMonth.flatMap((e) => e.tags.map((tag) => ({ tag, total: e.spent }))),
      (x) => x.tag,
      (x) => x.total,
    ),
  ]
    .map(([key, total]) => ({ key, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);
  const activeBreakdown: { mode: BreakdownMode; key: string } = filters.wallet
    ? { mode: "wallet", key: filters.wallet }
    : filters.tag
      ? { mode: "tag", key: filters.tag }
      : { mode: "category", key: filters.category };

  const year = today.slice(0, 4);
  const hasData: Record<string, boolean> = {
    friends: !!entries && friendBalances(entries, currency).length > 0,
    warranty: !!entries?.some((e) => e.warrantyUntil),
    recurring: recurringRules.length > 0,
    tax: inCurrency.some((e) => e.taxRelief && e.receiptDate.startsWith(year)),
  };
  const show = (key: string) => hasData[key] || openedTools.has(key);
  const openTool = (key: string) => setOpenedTools((prev) => new Set(prev).add(key));
  const closeTool = (key: string) =>
    setOpenedTools((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  // A tool opened from "More tools" that is still empty can be folded back.
  const closable = (key: string, card: ReactNode) =>
    hasData[key] ? (
      card
    ) : (
      <div className="relative">
        {card}
        <button
          type="button"
          onClick={() => closeTool(key)}
          aria-label={t("tools.close")}
          title={t("tools.close")}
          className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-surface text-muted shadow-sm ring-1 ring-border hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    );
  const latest = entries?.length ? sortEntries(entries.filter((e) => !e.isPinned)).at(0) ?? entries[0] : undefined;
  const foldedTools: Tool[] = (
    [
      {
        key: "friends",
        icon: Users,
        title: t("tools.split"),
        sub: latest ? t("tools.splitSub", { name: latest.merchantName || t("list.untitled") }) : t("owed.sub"),
        // Straight into splitting the latest bill; the Friends card appears once someone owes.
        onOpen: () => (latest ? void openSplit(latest.id) : openTool("friends")),
      },
      { key: "warranty", icon: ShieldCheck, title: t("warranty.title"), sub: t("warranty.sub"), onOpen: () => openTool("warranty") },
      { key: "recurring", icon: Repeat, title: t("recurring.title"), sub: t("recurring.sub"), onOpen: () => openTool("recurring") },
      { key: "tax", icon: Landmark, title: t("relief.title", { year }), sub: t("relief.sub"), onOpen: () => openTool("tax") },
    ] satisfies Tool[]
  ).filter((tool) => !show(tool.key));

  async function downloadReport() {
    setReporting(true);
    try {
      // PDF fonts are Latin-only, so reports are always in English.
      const en = (key: MessageKey, vars?: Record<string, string | number>) => translate("en", key, vars);
      await downloadMonthlyReport(
        inMonth,
        currency,
        {
          title: "RyannReceipt - Monthly report",
          subtitle: `${selectedMonth} · ${currency}`,
          total: en("summary.total"),
          receipts: en("chart.receipts"),
          byCategory: en("breakdown.category"),
          byWallet: en("breakdown.wallet"),
          list: en("list.title"),
          generated: `Generated ${today} by RyannReceipt`,
          group: (k) => en(`cat.${k}` as MessageKey),
          noWallet: en("breakdown.noWallet"),
        },
        `ryannreceipt-${selectedMonth}.pdf`,
      );
    } finally {
      setReporting(false);
    }
  }

  const warranties = entries?.filter((e) => e.warrantyUntil) ?? [];
  const soon = warranties.filter((e) => warrantyState(e.warrantyUntil, today).kind === "soon").length;
  const activeWarranties = warranties.filter((e) => warrantyState(e.warrantyUntil, today).kind !== "expired").length;

  function selectMonth(key: string) {
    setMonthChoice(key);
    setFilters((f) => ({ ...f, day: "", month: f.month === key ? "" : key }));
  }

  // ---- render ------------------------------------------------------------

  // Shared between the desktop header and the phone Insights section.
  const currencyPicker = (
    <label className="flex items-center gap-1.5 text-sm max-sm:grow max-sm:basis-[calc(50%-0.25rem)]" title={t("fx.showIn")}>
      <span className="sr-only">{t("fx.showIn")}</span>
      <Globe className="size-4 text-muted" aria-hidden />
      <select
        value={currency}
        onChange={(e) => setHomeCurrency(e.target.value as Currency)}
        className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm max-sm:h-10 max-sm:min-w-0 max-sm:flex-1"
      >
        {CURRENCIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
    </label>
  );
  const reportButton = entries && entries.length > 0 && (
    <button
      type="button"
      onClick={() => void downloadReport()}
      disabled={reporting}
      title={t("report.monthly", { month: ml(selectedMonth, true) })}
      className={`${buttonStyles.secondary} max-sm:h-10 max-sm:grow max-sm:basis-[calc(50%-0.25rem)] whitespace-nowrap`}
    >
      {reporting ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <FileDown className="size-4" aria-hidden />}
      {t("report.button")}
    </button>
  );
  const reviewButton = entries && entries.length > 0 && (
    <button
      type="button"
      onClick={() => useUiStore.getState().setReviewYear(today.slice(0, 4))}
      title={t("review.title")}
      className={`${buttonStyles.secondary} max-sm:h-10 max-sm:grow max-sm:basis-[calc(50%-0.25rem)] whitespace-nowrap`}
    >
      <Sparkles className="size-4" aria-hidden />
      {t("review.button")}
    </button>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader section="history" tabBar />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 pt-6 pb-28 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl tracking-tight">{t("history.title")}</h1>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted">
              {signedIn ? (
                cloudError ? (
                  t("history.cloudError")
                ) : (
                  t("history.synced")
                )
              ) : (
                <>
                  <HardDrive className="size-3.5" aria-hidden />
                  {t("history.local")}
                </>
              )}
            </p>
            {hasForeign && fx && (
              <p className="mt-0.5 text-xs text-muted">{t("fx.note", { currency, date: fx.date })}</p>
            )}
            {insight && <InsightPill insight={insight} />}
          </div>
          {/* Phones: an even two-column grid (odd last item fills the row). */}
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            {/* Currency, report and year review live under Insights on phones. */}
            <div className="contents max-sm:hidden">
              {currencyPicker}
              {reportButton}
              {reviewButton}
            </div>
            {signedIn && pendingSync > 0 && (
              <button type="button" onClick={handleSync} disabled={syncing} className={`${buttonStyles.secondary} max-sm:h-10 max-sm:grow max-sm:basis-[calc(50%-0.25rem)] whitespace-nowrap`}>
                {syncing ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  <CloudUpload className="size-4" aria-hidden />
                )}
                {t("sync.action", { count: pendingSync })}
              </button>
            )}
            <button type="button" onClick={() => openScan()} className={`${buttonStyles.secondary} max-sm:hidden`}>
              <Camera className="size-4" aria-hidden />
              {t("scan.title")}
            </button>
            <Link href="/studio" className={`${buttonStyles.primary} max-sm:hidden`}>
              <Plus className="size-4" aria-hidden />
              {t("studio.newReceipt")}
            </Link>
          </div>
        </div>

        {!entries || loadingCloud ? (
          <div aria-busy className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface" />
            ))}
            <div className="h-72 animate-pulse rounded-2xl bg-surface sm:col-span-3" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center">
            <ReceiptText className="size-8 text-muted" aria-hidden />
            <h2 className="mt-3 font-display text-2xl">{t("history.emptyTitle")}</h2>
            <p className="mt-1 max-w-sm text-sm text-muted">{t("history.emptyBody")}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => useUiStore.getState().setQuickAddOpen(true)} className={buttonStyles.primary}>
                {t("quick.title")}
              </button>
              <button type="button" onClick={() => openScan()} className={buttonStyles.secondary}>
                <Camera className="size-4" aria-hidden />
                {t("scan.title")}
              </button>
              <Link href="/studio" className={buttonStyles.secondary}>
                {t("history.openStudio")}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${activeWarranties > 0 ? "sm:grid-cols-3" : ""}`}>
              <StatTile
                className="col-span-2 sm:col-span-1"
                label={t("tile.spentIn", { month: ml(selectedMonth, true) })}
                value={`${currency} ${formatAmount(selTotal, currency)}`}
                delta={
                  prevTotal > 0
                    ? {
                        value: selTotal - prevTotal,
                        label: t("tile.vs", {
                          delta: `${selTotal >= prevTotal ? "+" : "-"}${formatAmount(Math.abs(selTotal - prevTotal), currency)}`,
                          month: ml(prevKey),
                        }),
                      }
                    : undefined
                }
                meter={budgetPct}
                sub={
                  [budgetSub, otherCurrencyCount > 0 ? t("tile.otherCurrencies", { count: otherCurrencyCount }) : null]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
                action={
                  <button
                    type="button"
                    onClick={() => setBudgetOpen(true)}
                    className="-mt-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted ring-1 ring-border hover:bg-surface-muted hover:text-foreground"
                  >
                    {budget > 0 ? t("budget.edit") : t("budget.set")}
                  </button>
                }
              />
              <StatTile
                className={activeWarranties > 0 ? "" : "col-span-2 sm:col-span-1"}
                label={t("tile.today")}
                value={`${currency} ${formatAmount(todayTotal, currency)}`}
                sub={t("tile.todayCount", { count: todayCount, total: entries.length })}
              />
              {activeWarranties > 0 && (
                <StatTile
                  label={t("tile.warranties")}
                  value={activeWarranties}
                  sub={
                    soon > 0 ? (
                      <span className="font-medium text-warning">{t("tile.expiringSoon", { count: soon })}</span>
                    ) : (
                      t("tile.noneExpiring")
                    )
                  }
                />
              )}
            </div>

            {/* The main action, always one tap away. */}
            <button
              type="button"
              onClick={() => useUiStore.getState().setQuickAddOpen(true)}
              className="group flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left shadow-sm ring-1 ring-border transition-shadow hover:shadow-md"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-contrast transition-transform group-hover:scale-105">
                <Plus className="size-5" strokeWidth={2.5} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{t("home.addTitle")}</span>
                <span className="block truncate text-xs text-muted">{t("home.addHint")}</span>
              </span>
              <kbd className="hidden rounded-md px-1.5 py-0.5 font-mono text-[11px] text-muted ring-1 ring-border sm:inline">Alt+Q</kbd>
            </button>

            <div className="grid items-start gap-4 lg:grid-cols-[1fr_22rem]">
              <ReceiptList
                convertTo={hasForeign ? (e) => (e.currency === currency ? null : convert(e.spent, e.currency, currency, fx)) : undefined}
                homeCurrency={currency}
                entries={entries}
                showSyncState={signedIn}
                filters={filters}
                onFiltersChange={setFilters}
                onPin={handlePin}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onSplit={(entry) => void openSplit(entry.id)}
                onOpen={(entry) => void openEdit(entry.id)}
              />
              <div className="space-y-4">
                {show("friends") &&
                  closable(
                    "friends",
                    <FriendsCard entries={entries} currency={currency} onMarkPaid={(id, person) => void markPaid(id, person)} />,
                  )}
                {show("warranty") && closable("warranty", <WarrantyTracker entries={entries} today={today} />)}
                {show("recurring") && closable("recurring", <RecurringCard today={today} currency={currency} />)}
                {show("tax") && closable("tax", <TaxReliefCard entries={inCurrency} currency={currency} year={today.slice(0, 4)} />)}
                <MoreTools tools={foldedTools} />
              </div>
            </div>

            {/* Charts and breakdowns: below your expenses, folded on phones. */}
            <section aria-labelledby="insights-heading" className="space-y-4 pt-4">
              <div className="flex items-center justify-between gap-3">
                <h2 id="insights-heading" className="font-display text-3xl tracking-tight">
                  {t("home.insights")}
                </h2>
                <button
                  type="button"
                  aria-expanded={insightsOpen}
                  aria-controls="insights-body"
                  onClick={() => setInsightsOpen((o) => !o)}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium ring-1 ring-border sm:hidden"
                >
                  {insightsOpen ? t("home.hideInsights") : t("home.showInsights")}
                  <ChevronDown className={`size-4 transition-transform ${insightsOpen ? "rotate-180" : ""}`} aria-hidden />
                </button>
              </div>
              <div id="insights-body" className={`space-y-4 ${insightsOpen ? "" : "max-sm:hidden"}`}>
                <div className="flex flex-wrap items-center gap-2 sm:hidden">
                  {currencyPicker}
                  {reportButton}
                  {reviewButton}
                </div>
              <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
                <MonthlyChart data={monthData} currency={currency} selected={selectedMonth} onSelect={selectMonth} />
                <SpendingCalendar
                  month={selectedMonth}
                  today={today}
                  totals={dayTotals}
                  currency={currency}
                  selectedDay={filters.day}
                  onSelectDay={(day) => setFilters((f) => ({ ...f, day, month: "" }))}
                />
              </div>

              <Breakdown
                monthName={ml(selectedMonth, true)}
                currency={currency}
                byCategory={byCategory}
                byWallet={byWallet}
                byTag={byTag}
                active={activeBreakdown}
                onSelect={(mode, key) =>
                  setFilters((f) => ({
                    ...f,
                    category: mode === "category" ? key : "",
                    wallet: mode === "wallet" ? key : "",
                    tag: mode === "tag" ? key : "",
                  }))
                }
                onEditBudgets={() => setBudgetOpen(true)}
              />
              </div>
            </section>
          </>
        )}
      </main>
      <BudgetsDialog currency={currency} open={budgetOpen} onClose={() => setBudgetOpen(false)} />
      <EditExpenseDialog
        id={editId}
        onClose={() => setEditId(null)}
        onSplit={() => {
          const id = editId;
          setEditId(null);
          if (id) void openSplit(id);
        }}
        onDelete={() => {
          const entry = entries?.find((e) => e.id === editId);
          setEditId(null);
          if (entry) handleDelete(entry);
        }}
      />
      <MobileTabBar current="history" />
      {hydrated && <YearReviewDialog entries={inCurrency} currency={currency} today={today} />}
    </div>
  );
}

"use client";

import { Bell, CalendarClock, CircleAlert, PiggyBank, ShieldAlert, Zap } from "lucide-react";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

import { menuLabelClass, useAnchoredPopover } from "@/components/ui/use-anchored-popover";
import { dominantCurrency, fromLocal, todayKey, warrantyState } from "@/lib/history/entries";
import { useT } from "@/lib/i18n/messages";
import { nextDueDate } from "@/lib/recurring/schedule";
import { useLibraryHydrated, useReceiptStore } from "@/lib/store/receipt-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { useUiStore } from "@/lib/store/ui-store";
import { formatAmount } from "@/lib/utils/currency";

type Reminder = { id: string; icon: typeof Bell; tone: string; text: string; href?: string; action?: "quick-add" };

const noop = () => () => {};
/** Hour of day, read after hydration (never during prerender). */
const useHour = () => useSyncExternalStore(noop, () => new Date().getHours(), () => 12);

/**
 * In-app reminders (no push server needed): warranties about to expire,
 * budgets nearly used, recurring payments coming up, and an evening nudge to
 * log the day's spending.
 */
export function RemindersBell() {
  const t = useT();
  const hydrated = useLibraryHydrated();
  const receipts = useReceiptStore((s) => s.receipts);
  const budgets = useSettingsStore((s) => s.budgets);
  const rules = useSettingsStore((s) => s.recurring);
  const setQuickAddOpen = useUiStore((s) => s.setQuickAddOpen);
  const hour = useHour();
  const { triggerProps, popoverProps, close } = useAnchoredPopover({ align: "end", width: 320 });

  const reminders = useMemo<Reminder[]>(() => {
    if (!hydrated) return [];
    const today = todayKey();
    const entries = Object.values(receipts).map(fromLocal);
    const list: Reminder[] = [];

    for (const e of entries) {
      if (!e.warrantyUntil) continue;
      const w = warrantyState(e.warrantyUntil, today);
      if (w.kind === "soon") {
        list.push({
          id: `w-${e.id}`,
          icon: ShieldAlert,
          tone: "text-warning",
          text: t("remind.warranty", { name: e.merchantName || t("list.untitled"), n: w.daysLeft }),
          href: `/studio?id=${e.id}`,
        });
      }
    }

    const currency = dominantCurrency(entries) ?? "MYR";
    const budget = budgets[currency];
    if (budget) {
      const spent = entries
        .filter((e) => e.currency === currency && e.receiptDate.startsWith(today.slice(0, 7)))
        .reduce((s, e) => s + e.total, 0);
      const pct = Math.round((spent / budget) * 100);
      if (pct >= 80) {
        list.push({
          id: "budget",
          icon: pct > 100 ? CircleAlert : PiggyBank,
          tone: pct > 100 ? "text-danger" : "text-warning",
          text: t(pct > 100 ? "remind.budgetOver" : "remind.budgetNear", {
            pct,
            amount: `${currency} ${formatAmount(budget, currency)}`,
          }),
          href: "/history",
        });
      }
    }

    const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    for (const rule of rules) {
      if (rule.active && nextDueDate(rule, today) === tomorrow) {
        list.push({
          id: `r-${rule.id}`,
          icon: CalendarClock,
          tone: "text-muted",
          text: t("remind.recurring", { name: rule.name, amount: formatAmount(rule.amount, rule.currency) }),
          href: "/history",
        });
      }
    }

    const loggedToday = entries.some((e) => e.receiptDate.startsWith(today));
    if (hour >= 19 && !loggedToday) {
      list.push({ id: "log", icon: Zap, tone: "text-viz-accent", text: t("remind.logToday"), action: "quick-add" });
    }
    return list;
  }, [hydrated, receipts, budgets, rules, hour, t]);

  return (
    <>
      <button
        {...triggerProps}
        type="button"
        aria-label={t("remind.title", { count: reminders.length })}
        title={t("remind.title", { count: reminders.length })}
        className="relative rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground"
      >
        <Bell className="size-4" aria-hidden />
        {reminders.length > 0 && (
          <span className="absolute top-1 right-1 flex min-w-3.5 items-center justify-center rounded-full bg-viz-accent px-1 text-[9px] leading-3.5 font-bold text-white">
            {reminders.length}
          </span>
        )}
      </button>
      <div {...popoverProps} style={{ width: 320 }}>
        <p className={menuLabelClass}>{t("remind.heading")}</p>
        {reminders.length === 0 ? (
          <p className="px-2.5 py-4 text-sm text-muted">{t("remind.none")}</p>
        ) : (
          <ul>
            {reminders.map((r) => {
              const Icon = r.icon;
              const body = (
                <>
                  <Icon className={`mt-0.5 size-4 shrink-0 ${r.tone}`} aria-hidden />
                  <span className="text-sm leading-snug">{r.text}</span>
                </>
              );
              const cls = "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-muted";
              return (
                <li key={r.id}>
                  {r.action === "quick-add" ? (
                    <button
                      type="button"
                      className={cls}
                      onClick={() => {
                        close();
                        setQuickAddOpen(true);
                      }}
                    >
                      {body}
                    </button>
                  ) : (
                    <Link href={r.href ?? "/history"} className={cls} onClick={close}>
                      {body}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

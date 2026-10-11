"use client";

import { Pause, Pencil, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { useState } from "react";

import { CATEGORY_ICONS } from "@/components/quick-add/category-icons";
import { inputClass, NumberInput } from "@/components/receipt/editor/fields";
import { buttonStyles, Dialog } from "@/components/ui/dialog";
import { INTL_LOCALE, useLocale, useT, type MessageKey } from "@/lib/i18n/messages";
import { COMMON_WALLETS } from "@/lib/quick-add/keywords";
import { nextDueDate } from "@/lib/recurring/schedule";
import { useSettingsStore } from "@/lib/store/settings-store";
import { formatAmount } from "@/lib/utils/currency";
import {
  CATEGORIES,
  CURRENCIES,
  PAYMENT_METHODS,
  type Currency,
  type RecurringRule,
} from "@/lib/validators/receipt-schema";

function useWeekdayNames() {
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "long", timeZone: "UTC" });
  // 2024-01-07 was a Sunday (day 0).
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 7 + i))));
}

function RuleForm({ initial, onClose }: { initial: RecurringRule; onClose: () => void }) {
  const t = useT();
  const weekdays = useWeekdayNames();
  const upsertRule = useSettingsStore((s) => s.upsertRule);
  const [rule, setRule] = useState(initial);
  const set = <K extends keyof RecurringRule>(key: K, value: RecurringRule[K]) => setRule((r) => ({ ...r, [key]: value }));
  const valid = rule.name.trim() && rule.amount > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        upsertRule({ ...rule, name: rule.name.trim() });
        onClose();
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">{t("recurring.name")}</span>
          <input
            autoFocus
            className={inputClass}
            maxLength={60}
            placeholder={t("recurring.namePh")}
            value={rule.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">{t("quick.amount", { currency: rule.currency })}</span>
          <NumberInput value={rule.amount} decimals={2} max={1_000_000} onValueChange={(v) => set("amount", v)} className="text-right" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">{t("recurring.frequency")}</span>
          <select
            className={inputClass}
            value={rule.frequency}
            onChange={(e) => {
              const frequency = e.target.value as RecurringRule["frequency"];
              setRule((r) => ({ ...r, frequency, day: frequency === "monthly" ? 1 : 1 }));
            }}
          >
            <option value="monthly">{t("recurring.monthly")}</option>
            <option value="weekly">{t("recurring.weekly")}</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">{t("recurring.on")}</span>
          <select className={inputClass} value={rule.day} onChange={(e) => set("day", Number(e.target.value))}>
            {rule.frequency === "monthly"
              ? Array.from({ length: 28 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {t("recurring.dayOfMonth", { day: i + 1 })}
                  </option>
                ))
              : weekdays.map((name, i) => (
                  <option key={i} value={i}>
                    {name}
                  </option>
                ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">{t("field.category")}</span>
          <select
            className={inputClass}
            value={rule.category}
            onChange={(e) => set("category", e.target.value as RecurringRule["category"])}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`cat.${c}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">{t("field.currency")}</span>
          <select className={inputClass} value={rule.currency} onChange={(e) => set("currency", e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">{t("field.paymentMethod")}</span>
          <select
            className={inputClass}
            value={rule.paymentMethod}
            onChange={(e) => set("paymentMethod", e.target.value as RecurringRule["paymentMethod"])}
          >
            {PAYMENT_METHODS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">{t("field.wallet")}</span>
          <input
            className={inputClass}
            list="recurring-wallets"
            maxLength={30}
            value={rule.wallet}
            onChange={(e) => set("wallet", e.target.value)}
          />
          <datalist id="recurring-wallets">
            {COMMON_WALLETS.map((w) => (
              <option key={w} value={w} />
            ))}
          </datalist>
        </label>
        <label className="col-span-2 space-y-1.5">
          <span className="block text-xs font-medium text-muted">{t("recurring.start")}</span>
          <input
            type="date"
            className={inputClass}
            value={rule.startDate}
            onChange={(e) => e.target.value && setRule((r) => ({ ...r, startDate: e.target.value, lastRun: "" }))}
          />
        </label>
      </div>
      <p className="text-xs text-muted">{t("recurring.hint")}</p>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <button type="button" className={buttonStyles.ghost} onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button type="submit" disabled={!valid} className={buttonStyles.primary}>
          {t("common.save")}
        </button>
      </div>
    </form>
  );
}

/** Rent, bills and subscriptions that add themselves to History on schedule. */
export function RecurringCard({ today, currency }: { today: string; currency: Currency }) {
  const t = useT();
  const weekdays = useWeekdayNames();
  const rules = useSettingsStore((s) => s.recurring);
  const upsertRule = useSettingsStore((s) => s.upsertRule);
  const removeRule = useSettingsStore((s) => s.removeRule);
  const [editing, setEditing] = useState<RecurringRule | null>(null);

  function newRule(): RecurringRule {
    return {
      id: crypto.randomUUID(),
      name: "",
      amount: 0,
      currency,
      category: "Utilities",
      paymentMethod: "BANK TRANSFER",
      wallet: "",
      frequency: "monthly",
      day: Math.min(28, Number(today.slice(8, 10))),
      // lastRun = today: saving never back-fills a payment for today by surprise.
      startDate: today,
      active: true,
      lastRun: today,
    };
  }

  const monthlyTotal = rules
    .filter((r) => r.active && r.currency === currency)
    .reduce((s, r) => s + (r.frequency === "monthly" ? r.amount : (r.amount * 52) / 12), 0);

  return (
    <section aria-labelledby="recurring-heading" className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 id="recurring-heading" className="flex items-center gap-1.5 text-sm font-semibold">
            <Repeat className="size-4" aria-hidden />
            {t("recurring.title")}
          </h2>
          <p className="text-xs text-muted">
            {rules.length
              ? t("recurring.perMonth", { amount: `${currency} ${formatAmount(monthlyTotal, currency)}` })
              : t("recurring.sub")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(newRule())}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-border hover:bg-surface-muted"
        >
          <Plus className="size-3.5" aria-hidden />
          {t("recurring.add")}
        </button>
      </div>
      {rules.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-5 text-center text-xs text-muted">
          {t("recurring.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rules.map((rule) => {
            const Icon = CATEGORY_ICONS[rule.category];
            const schedule =
              rule.frequency === "monthly"
                ? t("recurring.everyMonth", { day: rule.day })
                : t("recurring.everyWeek", { day: weekdays[rule.day] });
            return (
              <li key={rule.id} className={`flex items-center gap-2.5 py-2 ${rule.active ? "" : "opacity-50"}`}>
                <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{rule.name}</p>
                  <p className="truncate text-xs text-muted">
                    {schedule}
                    {rule.active && ` · ${t("recurring.next", { date: nextDueDate(rule, today) })}`}
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums">{formatAmount(rule.amount, rule.currency)}</span>
                <button
                  type="button"
                  aria-label={rule.active ? t("recurring.pause") : t("recurring.resume")}
                  title={rule.active ? t("recurring.pause") : t("recurring.resume")}
                  onClick={() => upsertRule({ ...rule, active: !rule.active, lastRun: rule.active ? rule.lastRun : today })}
                  className="rounded-md p-1 text-muted hover:bg-surface-muted hover:text-foreground"
                >
                  {rule.active ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
                </button>
                <button
                  type="button"
                  aria-label={t("recurring.edit", { name: rule.name })}
                  onClick={() => setEditing(rule)}
                  className="rounded-md p-1 text-muted hover:bg-surface-muted hover:text-foreground"
                >
                  <Pencil className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={t("recurring.remove", { name: rule.name })}
                  onClick={() => removeRule(rule.id)}
                  className="rounded-md p-1 text-muted hover:bg-surface-muted hover:text-danger"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing && rules.some((r) => r.id === editing.id) ? t("recurring.editTitle") : t("recurring.addTitle")}
      >
        {editing && <RuleForm initial={editing} onClose={() => setEditing(null)} />}
      </Dialog>
    </section>
  );
}

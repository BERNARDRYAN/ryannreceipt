"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { inputClass } from "@/components/receipt/editor/fields";
import { useT } from "@/lib/i18n/messages";
import { cleanAmountInput, currencyDecimals, formatAmount } from "@/lib/utils/currency";
import type { Currency } from "@/lib/validators/receipt-schema";

/**
 * "Who had what, for how much": add a dish for one person or for everyone.
 * Typing just a person and a price is enough (e.g. Ali · 12.50).
 */
export function AddDishRow({
  people,
  currency,
  onAdd,
}: {
  people: { id: string; label: string }[];
  currency: Currency;
  onAdd: (who: string, what: string, price: number) => void;
}) {
  const t = useT();
  const [who, setWho] = useState(people.length > 1 ? people[1].id : "all");
  const [what, setWhat] = useState("");
  const [price, setPrice] = useState("");
  const amount = Number(price) || 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (amount <= 0) return;
        onAdd(who, what, Math.round(amount * 100) / 100);
        setWhat("");
        setPrice("");
      }}
      className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2 rounded-xl bg-surface-muted/70 p-2.5 sm:grid-cols-[9rem_minmax(0,1fr)_6.5rem_auto]"
    >
      <label className="contents">
        <span className="sr-only">{t("split.dishWho")}</span>
        <select value={who} onChange={(e) => setWho(e.target.value)} className={`${inputClass} py-1.5`}>
          <option value="all">{t("split.everyone")}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="contents">
        <span className="sr-only">{t("split.dishPrice")}</span>
        <input
          inputMode="decimal"
          placeholder="0.00"
          value={price}
          onChange={(e) => setPrice(cleanAmountInput(e.target.value, currencyDecimals(currency)))}
          className={`${inputClass} py-1.5 text-right tabular-nums sm:order-3`}
        />
      </label>
      <label className="contents">
        <span className="sr-only">{t("split.dishWhat")}</span>
        <input
          placeholder={t("split.dishWhatPh")}
          value={what}
          maxLength={80}
          onChange={(e) => setWhat(e.target.value)}
          className={`${inputClass} py-1.5 sm:order-2`}
        />
      </label>
      <button
        type="submit"
        disabled={amount <= 0}
        className="inline-flex items-center justify-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast disabled:opacity-40 sm:order-4"
      >
        <Plus className="size-4" aria-hidden />
        {t("split.addDish")}
      </button>
    </form>
  );
}

const SERVICE = [0, 10] as const;
const TAX = [0, 6, 8] as const;

/** Service charge and tax, shared in proportion to what each person had. */
export function ChargesRow({
  service,
  tax,
  total,
  currency,
  onChange,
}: {
  service: number;
  tax: number;
  total: number;
  currency: Currency;
  onChange: (patch: { serviceChargeRate?: number; taxRate?: number; taxLabel?: "SST" }) => void;
}) {
  const t = useT();
  const chip = (on: boolean) =>
    `rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${on ? "bg-accent text-accent-contrast ring-accent" : "ring-border hover:bg-surface-muted"}`;
  const pctInput = (value: number, label: string, set: (n: number) => void) => (
    <label className="inline-flex items-center gap-1 text-xs text-muted">
      <span className="sr-only">{label}</span>
      <input
        inputMode="decimal"
        value={value || ""}
        placeholder={t("split.otherPct")}
        onChange={(e) => set(Math.min(100, Number(cleanAmountInput(e.target.value, 2)) || 0))}
        className="w-14 rounded-md border border-border bg-surface px-1.5 py-1 text-right text-xs tabular-nums"
      />
      %
    </label>
  );

  return (
    <div className="space-y-2.5 rounded-xl bg-surface-muted/70 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-full shrink-0 text-xs font-medium text-muted sm:w-24">{t("split.service")}</span>
        {SERVICE.map((n) => (
          <button key={n} type="button" aria-pressed={service === n} onClick={() => onChange({ serviceChargeRate: n })} className={chip(service === n)}>
            {n ? `${n}%` : t("split.none")}
          </button>
        ))}
        {pctInput(SERVICE.includes(service as 0 | 10) ? 0 : service, t("split.service"), (n) => onChange({ serviceChargeRate: n }))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-full shrink-0 text-xs font-medium text-muted sm:w-24">{t("split.tax")}</span>
        {TAX.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={tax === n}
            onClick={() => onChange({ taxRate: n, ...(n ? { taxLabel: "SST" as const } : {}) })}
            className={chip(tax === n)}
          >
            {n ? `SST ${n}%` : t("split.none")}
          </button>
        ))}
        {pctInput(TAX.includes(tax as 0 | 6 | 8) ? 0 : tax, t("split.tax"), (n) => onChange({ taxRate: n }))}
      </div>
      <p className="flex items-baseline justify-between border-t border-border pt-2 text-xs text-muted">
        {t("split.billTotal")}
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {currency} {formatAmount(total, currency)}
        </span>
      </p>
    </div>
  );
}

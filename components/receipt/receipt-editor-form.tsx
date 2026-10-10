"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, type ReactNode } from "react";

import { useReceiptStore } from "@/lib/store/receipt-store";
import { computeTotals, formatAmount } from "@/lib/utils/currency";
import {
  CATEGORIES,
  CURRENCIES,
  PAYMENT_METHODS,
  type ReceiptStyle,
} from "@/lib/validators/receipt-schema";

type BooleanStyleKey = {
  [K in keyof ReceiptStyle]: ReceiptStyle[K] extends boolean ? K : never;
}[keyof ReceiptStyle];

const inputClass =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-foreground/60 focus-visible:ring-2 focus-visible:ring-foreground/15";

function clampNumber(raw: string, min: number, max: number, integer = false) {
  const n = integer ? Math.trunc(Number(raw)) : Number(raw);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-border px-5 py-5 last:border-b-0">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={id} className="block text-xs font-medium text-muted">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-5 w-9 shrink-0 rounded-full bg-surface-muted ring-1 ring-border transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-surface after:shadow-sm after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-foreground/30"
      />
    </label>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="block text-xs font-medium text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex rounded-md bg-surface-muted p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              value === option.value ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReceiptEditorForm() {
  const draft = useReceiptStore((s) => s.draft);
  const setField = useReceiptStore((s) => s.setField);
  const setStyle = useReceiptStore((s) => s.setStyle);
  const addItem = useReceiptStore((s) => s.addItem);
  const updateItem = useReceiptStore((s) => s.updateItem);
  const removeItem = useReceiptStore((s) => s.removeItem);

  const { subtotal, discount, taxAmount, total } = computeTotals(
    draft.items,
    draft.taxRate,
    draft.discountAmount,
    draft.currency,
  );
  const money = (n: number) => `${draft.currency} ${formatAmount(n, draft.currency)}`;
  const style = draft.styleConfig;
  const toggle = (key: BooleanStyleKey) => (checked: boolean) => setStyle(key, checked);

  return (
    <form onSubmit={(e) => e.preventDefault()} className="text-foreground">
      <Section title="Merchant">
        <Field label="Store name">
          {(id) => (
            <input
              id={id}
              className={inputClass}
              maxLength={60}
              value={draft.merchantName}
              onChange={(e) => setField("merchantName", e.target.value)}
            />
          )}
        </Field>
        <Field label="Address">
          {(id) => (
            <textarea
              id={id}
              rows={2}
              className={`${inputClass} resize-none`}
              maxLength={160}
              value={draft.merchantAddress}
              onChange={(e) => setField("merchantAddress", e.target.value)}
            />
          )}
        </Field>
        <Field label="Phone">
          {(id) => (
            <input
              id={id}
              type="tel"
              className={inputClass}
              maxLength={32}
              value={draft.merchantPhone}
              onChange={(e) => setField("merchantPhone", e.target.value)}
            />
          )}
        </Field>
      </Section>

      <Section title="Details">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Header">
            {(id) => (
              <input
                id={id}
                className={inputClass}
                maxLength={80}
                placeholder="Sales receipt"
                value={draft.title}
                onChange={(e) => setField("title", e.target.value)}
              />
            )}
          </Field>
          <Field label="Receipt no.">
            {(id) => (
              <input
                id={id}
                className={inputClass}
                maxLength={32}
                value={draft.receiptNo}
                onChange={(e) => setField("receiptNo", e.target.value)}
              />
            )}
          </Field>
          <Field label="Date & time" className="col-span-2">
            {(id) => (
              <input
                id={id}
                type="datetime-local"
                className={inputClass}
                value={draft.receiptDate}
                onChange={(e) => e.target.value && setField("receiptDate", e.target.value)}
              />
            )}
          </Field>
          <Field label="Currency">
            {(id) => (
              <select
                id={id}
                className={inputClass}
                value={draft.currency}
                onChange={(e) => setField("currency", e.target.value as (typeof CURRENCIES)[number])}
              >
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Payment">
            {(id) => (
              <select
                id={id}
                className={inputClass}
                value={draft.paymentMethod}
                onChange={(e) => setField("paymentMethod", e.target.value as (typeof PAYMENT_METHODS)[number])}
              >
                {PAYMENT_METHODS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Category" className="col-span-2">
            {(id) => (
              <select
                id={id}
                className={inputClass}
                value={draft.category}
                onChange={(e) => setField("category", e.target.value as (typeof CATEGORIES)[number])}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </Section>

      <Section
        title={`Items (${draft.items.length})`}
        action={
          <button
            type="button"
            onClick={addItem}
            disabled={draft.items.length >= 100}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-40"
          >
            <Plus className="size-3.5" aria-hidden />
            Add item
          </button>
        }
      >
        {draft.items.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted">
            No items yet.
          </p>
        )}
        <ul className="space-y-2">
          {draft.items.map((item, index) => (
            <li key={item.id} className="grid grid-cols-[1fr_4rem_5.5rem_auto] items-center gap-1.5">
              <input
                aria-label={`Item ${index + 1} name`}
                placeholder="Item name"
                className={inputClass}
                maxLength={80}
                value={item.name}
                onChange={(e) => updateItem(item.id, { name: e.target.value })}
              />
              <input
                aria-label={`Item ${index + 1} quantity`}
                type="number"
                inputMode="numeric"
                min={0}
                max={9999}
                step={1}
                className={`${inputClass} text-right tabular-nums`}
                value={item.qty}
                onChange={(e) => updateItem(item.id, { qty: clampNumber(e.target.value, 0, 9999, true) })}
              />
              <input
                aria-label={`Item ${index + 1} unit price`}
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                className={`${inputClass} text-right tabular-nums`}
                value={item.price}
                onChange={(e) => updateItem(item.id, { price: clampNumber(e.target.value, 0, 1_000_000) })}
              />
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                aria-label={`Remove item ${index + 1}`}
                className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Totals">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tax rate (%)">
            {(id) => (
              <input
                id={id}
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={0.5}
                className={`${inputClass} tabular-nums`}
                value={draft.taxRate}
                onChange={(e) => setField("taxRate", clampNumber(e.target.value, 0, 100))}
              />
            )}
          </Field>
          <Field label={`Discount (${draft.currency})`}>
            {(id) => (
              <input
                id={id}
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                className={`${inputClass} tabular-nums`}
                value={draft.discountAmount}
                onChange={(e) => setField("discountAmount", clampNumber(e.target.value, 0, 1_000_000_000))}
              />
            )}
          </Field>
        </div>
        <dl className="space-y-1 rounded-md bg-surface-muted px-3 py-2.5 text-sm tabular-nums">
          <div className="flex justify-between text-muted">
            <dt>Subtotal</dt>
            <dd>{money(subtotal)}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-muted">
              <dt>Discount</dt>
              <dd>-{money(discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-muted">
            <dt>Tax</dt>
            <dd>{money(taxAmount)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd>{money(total)}</dd>
          </div>
        </dl>
      </Section>

      <Section title="Footer & warranty">
        <Field label="Footer note">
          {(id) => (
            <textarea
              id={id}
              rows={2}
              className={`${inputClass} resize-none`}
              maxLength={280}
              value={draft.notes}
              onChange={(e) => setField("notes", e.target.value)}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Barcode value">
            {(id) => (
              <input
                id={id}
                className={`${inputClass} font-mono`}
                maxLength={48}
                value={draft.barcodeData}
                onChange={(e) => setField("barcodeData", e.target.value)}
              />
            )}
          </Field>
          <Field label="Warranty until">
            {(id) => (
              <input
                id={id}
                type="date"
                className={inputClass}
                value={draft.warrantyUntil}
                onChange={(e) => setField("warrantyUntil", e.target.value)}
              />
            )}
          </Field>
          <Field label="QR content (defaults to receipt no.)" className="col-span-2">
            {(id) => (
              <input
                id={id}
                className={inputClass}
                maxLength={512}
                placeholder="https://… or any text"
                value={draft.qrData}
                onChange={(e) => setField("qrData", e.target.value)}
              />
            )}
          </Field>
        </div>
      </Section>

      <Section title="Paper">
        <div className="grid grid-cols-2 gap-3">
          <Segmented
            label="Roll width"
            value={style.width}
            options={[
              { value: "80mm", label: "80mm" },
              { value: "58mm", label: "58mm" },
            ]}
            onChange={(v) => setStyle("width", v)}
          />
          <Segmented
            label="Paper"
            value={style.paperTheme}
            options={[
              { value: "clean", label: "Clean" },
              { value: "aged", label: "Aged" },
            ]}
            onChange={(v) => setStyle("paperTheme", v)}
          />
        </div>
        <div className="divide-y divide-border">
          <Toggle label="Barcode" checked={style.showBarcode} onChange={toggle("showBarcode")} />
          <Toggle label="QR code" checked={style.showQr} onChange={toggle("showQr")} />
          <Toggle label="Torn edges" checked={style.tearEdge} onChange={toggle("tearEdge")} />
          <Toggle label="Thermal grain" checked={style.monochromeDither} onChange={toggle("monochromeDither")} />
        </div>
      </Section>
    </form>
  );
}

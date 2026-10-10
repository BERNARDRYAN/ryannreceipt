"use client";

import { Bookmark } from "lucide-react";
import { useState } from "react";

import { Field, inputClass, NumberInput, Section, Segmented, Toggle } from "@/components/receipt/editor/fields";
import { ItemsEditor } from "@/components/receipt/editor/items-editor";
import { LogoField } from "@/components/receipt/editor/logo-field";
import { PresetsDialog } from "@/components/receipt/editor/presets-dialog";
import { useActiveDraft, useReceiptStore } from "@/lib/store/receipt-store";
import { computeTotals, currencyDecimals, formatAmount } from "@/lib/utils/currency";
import {
  CATEGORIES,
  CURRENCIES,
  ORDER_TYPES,
  PAYMENT_METHODS,
  TAX_LABELS,
  type ReceiptStyle,
} from "@/lib/validators/receipt-schema";

type BooleanStyleKey = {
  [K in keyof ReceiptStyle]: ReceiptStyle[K] extends boolean ? K : never;
}[keyof ReceiptStyle];

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : "text-muted"}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function ReceiptEditorForm() {
  const draft = useActiveDraft();
  const setField = useReceiptStore((s) => s.setField);
  const setStyle = useReceiptStore((s) => s.setStyle);
  const [presetsOpen, setPresetsOpen] = useState(false);

  if (!draft) return null;

  const t = computeTotals(draft);
  const decimals = currencyDecimals(draft.currency);
  const money = (n: number) => `${draft.currency} ${formatAmount(n, draft.currency)}`;
  const style = draft.styleConfig;
  const toggle = (key: BooleanStyleKey) => (checked: boolean) => setStyle(key, checked);
  const isCash = draft.paymentMethod === "CASH";
  const quickTender = [t.payable, ...[10, 20, 50, 100].filter((n) => n > t.payable)].slice(0, 4);

  return (
    <div className="text-foreground">
      <Section
        title="Merchant"
        action={
          <button
            type="button"
            onClick={() => setPresetsOpen(true)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-surface-muted"
          >
            <Bookmark className="size-3.5" aria-hidden />
            Presets
          </button>
        }
      >
        <LogoField value={style.logo} onChange={(logo) => setStyle("logo", logo)} />
        <Field label="Store name">
          {(id) => (
            <input
              id={id}
              className={inputClass}
              maxLength={60}
              placeholder="e.g. Ryann Kopitiam"
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
          <Field label="Cashier">
            {(id) => (
              <input
                id={id}
                className={inputClass}
                maxLength={32}
                value={draft.cashier}
                onChange={(e) => setField("cashier", e.target.value)}
              />
            )}
          </Field>
          <Field label="Table">
            {(id) => (
              <input
                id={id}
                className={inputClass}
                maxLength={12}
                value={draft.tableNo}
                onChange={(e) => setField("tableNo", e.target.value)}
              />
            )}
          </Field>
          <Field label="Order type">
            {(id) => (
              <select
                id={id}
                className={inputClass}
                value={draft.orderType}
                onChange={(e) => setField("orderType", e.target.value as (typeof ORDER_TYPES)[number])}
              >
                {ORDER_TYPES.map((o) => (
                  <option key={o} value={o}>
                    {o || "None"}
                  </option>
                ))}
              </select>
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
          <Field label="Category" className="col-span-2" hint="Used for spending summaries in History.">
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

      <ItemsEditor />

      <Section title="Charges & tax">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Discount (${draft.currency})`}>
            {(id) => (
              <NumberInput
                id={id}
                decimals={decimals}
                max={1_000_000_000}
                value={draft.discountAmount}
                onValueChange={(v) => setField("discountAmount", v)}
              />
            )}
          </Field>
          <Field label="Service charge (%)">
            {(id) => (
              <NumberInput
                id={id}
                max={100}
                value={draft.serviceChargeRate}
                onValueChange={(v) => setField("serviceChargeRate", v)}
              />
            )}
          </Field>
          <Field label="Tax label">
            {(id) => (
              <select
                id={id}
                className={inputClass}
                value={draft.taxLabel}
                onChange={(e) => setField("taxLabel", e.target.value as (typeof TAX_LABELS)[number])}
              >
                {TAX_LABELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Tax rate (%)">
            {(id) => (
              <NumberInput id={id} max={100} value={draft.taxRate} onValueChange={(v) => setField("taxRate", v)} />
            )}
          </Field>
        </div>
        <Toggle
          label="Prices include tax"
          description="Tax is shown as included instead of added on top."
          checked={draft.taxInclusive}
          onChange={(v) => setField("taxInclusive", v)}
        />
      </Section>

      <Section title="Payment">
        <Field label="Payment method">
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
        {isCash && (
          <>
            {decimals === 2 && (
              <Toggle
                label="Round to nearest 0.05"
                description="Malaysian cash rounding (1–2 sen down, 3–4 up)."
                checked={draft.roundCash}
                onChange={(v) => setField("roundCash", v)}
              />
            )}
            <Field label={`Cash tendered (${draft.currency})`}>
              {(id) => (
                <NumberInput
                  id={id}
                  decimals={decimals}
                  max={1_000_000_000}
                  value={draft.amountTendered}
                  onValueChange={(v) => setField("amountTendered", v)}
                />
              )}
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {quickTender.map((amount, i) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setField("amountTendered", amount)}
                  className="rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ring-1 ring-border hover:bg-surface-muted"
                >
                  {i === 0 ? "Exact" : formatAmount(amount, draft.currency)}
                </button>
              ))}
            </div>
          </>
        )}
        <dl className="space-y-1 rounded-md bg-surface-muted px-3 py-2.5 text-sm tabular-nums">
          <SummaryRow label="Subtotal" value={money(t.subtotal)} />
          {t.discount > 0 && <SummaryRow label="Discount" value={`-${money(t.discount)}`} />}
          {t.serviceCharge > 0 && <SummaryRow label="Service charge" value={money(t.serviceCharge)} />}
          {t.taxAmount > 0 && (
            <SummaryRow
              label={`${draft.taxLabel}${draft.taxInclusive ? " (included)" : ""}`}
              value={money(t.taxAmount)}
            />
          )}
          {t.rounding !== 0 && <SummaryRow label="Rounding" value={money(t.rounding)} />}
          <SummaryRow label="Total" value={money(t.payable)} strong />
          {isCash && t.tendered > 0 && (
            <>
              <SummaryRow label="Tendered" value={money(t.tendered)} />
              <SummaryRow
                label={t.tendered < t.payable ? "Short by" : "Change"}
                value={money(t.tendered < t.payable ? t.payable - t.tendered : t.change)}
                strong
              />
            </>
          )}
        </dl>
      </Section>

      <Section title="Footer, codes & warranty">
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
          <Field label="Warranty until" hint="Tracked in History.">
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

      <Section title="Paper & print">
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
            label="Typeface"
            value={style.fontFamily}
            options={[
              { value: "mono", label: "Mono" },
              { value: "typewriter", label: "Type" },
              { value: "dotmatrix", label: "Dots" },
            ]}
            onChange={(v) => setStyle("fontFamily", v)}
          />
        </div>
        <Segmented
          label="Paper"
          value={style.paperTheme}
          options={[
            { value: "clean", label: "Clean" },
            { value: "aged", label: "Aged" },
            { value: "pink", label: "Pink" },
            { value: "blue", label: "Blue" },
          ]}
          onChange={(v) => setStyle("paperTheme", v)}
        />
        <div className="divide-y divide-border">
          <Toggle label="Barcode" checked={style.showBarcode} onChange={toggle("showBarcode")} />
          <Toggle label="QR code" checked={style.showQr} onChange={toggle("showQr")} />
          <Toggle label="Torn edges" checked={style.tearEdge} onChange={toggle("tearEdge")} />
          <Toggle label="Thermal grain" checked={style.monochromeDither} onChange={toggle("monochromeDither")} />
        </div>
      </Section>

      <PresetsDialog open={presetsOpen} onClose={() => setPresetsOpen(false)} />
    </div>
  );
}

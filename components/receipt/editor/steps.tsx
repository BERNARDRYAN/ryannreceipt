"use client";

import { Bookmark } from "lucide-react";
import { useState } from "react";

import {
  Field,
  fieldDomId,
  Group,
  inputClass,
  MoreOptions,
  NumberInput,
  Segmented,
  Toggle,
} from "@/components/receipt/editor/fields";
import { LogoField } from "@/components/receipt/editor/logo-field";
import { LookPicker } from "@/components/receipt/editor/look-picker";
import { PresetsDialog } from "@/components/receipt/editor/presets-dialog";
import { useT, type MessageKey } from "@/lib/i18n/messages";
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

function useEditing() {
  const draft = useActiveDraft();
  const setField = useReceiptStore((s) => s.setField);
  const setStyle = useReceiptStore((s) => s.setStyle);
  return { draft, setField, setStyle };
}

// ---------------------------------------------------------------------------
// Step 1: Shop
// ---------------------------------------------------------------------------

export function ShopStep() {
  const t = useT();
  const { draft, setField, setStyle } = useEditing();
  const [presetsOpen, setPresetsOpen] = useState(false);
  if (!draft) return null;

  return (
    <div className="space-y-6">
      <Group
        title={t("step.shop")}
        action={
          <button
            type="button"
            onClick={() => setPresetsOpen(true)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-surface-muted"
          >
            <Bookmark className="size-3.5" aria-hidden />
            {t("presets.button")}
          </button>
        }
      >
        <Field label={t("field.storeName")} fieldId="merchantName">
          {(id) => (
            <input
              id={id}
              className={inputClass}
              maxLength={60}
              placeholder={t("field.storeNamePh")}
              value={draft.merchantName}
              onChange={(e) => setField("merchantName", e.target.value)}
            />
          )}
        </Field>
        <Field label={t("field.address")} fieldId="merchantAddress">
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
        <Field label={t("field.phone")} fieldId="merchantPhone">
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
        <LogoField value={draft.styleConfig.logo} onChange={(logo) => setStyle("logo", logo)} />
      </Group>

      <Group title={t("section.receiptDetails")}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("field.receiptNo")} fieldId="receiptNo">
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
          <Field label={t("field.currency")} fieldId="currency">
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
          <Field label={t("field.date")} className="col-span-2" fieldId="receiptDate">
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
          <Field label={t("field.header")} className="col-span-2" fieldId="title">
            {(id) => (
              <input
                id={id}
                className={inputClass}
                maxLength={80}
                placeholder={t("field.headerPh")}
                value={draft.title}
                onChange={(e) => setField("title", e.target.value)}
              />
            )}
          </Field>
        </div>
        <MoreOptions title={t("editor.optionalDetails")}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.cashier")} fieldId="cashier">
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
            <Field label={t("field.table")} fieldId="tableNo">
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
            <Field label={t("field.orderType")} className="col-span-2" fieldId="orderType">
              {(id) => (
                <select
                  id={id}
                  className={inputClass}
                  value={draft.orderType}
                  onChange={(e) => setField("orderType", e.target.value as (typeof ORDER_TYPES)[number])}
                >
                  {ORDER_TYPES.map((o) => (
                    <option key={o} value={o}>
                      {o || t("order.none")}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        </MoreOptions>
      </Group>

      <PresetsDialog open={presetsOpen} onClose={() => setPresetsOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Payment
// ---------------------------------------------------------------------------

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold text-foreground" : "text-muted"}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function PaymentStep() {
  const t = useT();
  const { draft, setField } = useEditing();
  if (!draft) return null;

  const totals = computeTotals(draft);
  const decimals = currencyDecimals(draft.currency);
  const money = (n: number) => `${draft.currency} ${formatAmount(n, draft.currency)}`;
  const isCash = draft.paymentMethod === "CASH";
  const quickTender = [totals.payable, ...[10, 20, 50, 100].filter((n) => n > totals.payable)].slice(0, 4);

  return (
    <div className="space-y-6">
      <Group title={t("section.payment")}>
        <Field label={t("field.paymentMethod")} fieldId="paymentMethod">
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
            <Field label={t("field.tendered", { currency: draft.currency })} fieldId="amountTendered">
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
                  className="rounded-full px-3 py-1 text-xs font-medium tabular-nums ring-1 ring-border transition-colors hover:bg-surface-muted"
                >
                  {i === 0 ? t("tender.exact") : formatAmount(amount, draft.currency)}
                </button>
              ))}
            </div>
            {decimals === 2 && (
              <Toggle
                id={fieldDomId("roundCash")}
                label={t("field.roundCash")}
                description={t("hint.roundCash")}
                checked={draft.roundCash}
                onChange={(v) => setField("roundCash", v)}
              />
            )}
          </>
        )}
      </Group>

      <Group title={t("section.charges")}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("field.discount", { currency: draft.currency })} fieldId="discountAmount">
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
          <Field label={t("field.service")} hint={t("hint.service")} fieldId="serviceChargeRate">
            {(id) => (
              <NumberInput
                id={id}
                max={100}
                value={draft.serviceChargeRate}
                onValueChange={(v) => setField("serviceChargeRate", v)}
              />
            )}
          </Field>
          <Field label={t("field.taxLabel")}>
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
          <Field label={t("field.taxRate")} fieldId="taxRate">
            {(id) => (
              <NumberInput id={id} max={100} value={draft.taxRate} onValueChange={(v) => setField("taxRate", v)} />
            )}
          </Field>
        </div>
        <Toggle
          label={t("field.taxInclusive")}
          description={t("hint.taxInclusive")}
          checked={draft.taxInclusive}
          onChange={(v) => setField("taxInclusive", v)}
        />
      </Group>

      <dl className="space-y-1 rounded-xl bg-surface-muted px-4 py-3 text-sm tabular-nums">
        <SummaryRow label={t("summary.subtotal")} value={money(totals.subtotal)} />
        {totals.discount > 0 && <SummaryRow label={t("summary.discount")} value={`-${money(totals.discount)}`} />}
        {totals.serviceCharge > 0 && <SummaryRow label={t("summary.service")} value={money(totals.serviceCharge)} />}
        {totals.taxAmount > 0 && (
          <SummaryRow
            label={draft.taxInclusive ? t("summary.taxIncluded", { label: draft.taxLabel }) : draft.taxLabel}
            value={money(totals.taxAmount)}
          />
        )}
        {totals.rounding !== 0 && <SummaryRow label={t("summary.rounding")} value={money(totals.rounding)} />}
        <div className="my-1 border-t border-border" />
        <SummaryRow label={t("summary.total")} value={money(totals.payable)} strong />
        {isCash && totals.tendered > 0 && (
          <>
            <SummaryRow label={t("summary.tendered")} value={money(totals.tendered)} />
            <SummaryRow
              label={totals.tendered < totals.payable ? t("summary.short") : t("summary.change")}
              value={money(totals.tendered < totals.payable ? totals.payable - totals.tendered : totals.change)}
              strong
            />
          </>
        )}
      </dl>

      <Group title={t("section.records")}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("field.category")} hint={t("hint.category")} fieldId="category">
            {(id) => (
              <select
                id={id}
                className={inputClass}
                value={draft.category}
                onChange={(e) => setField("category", e.target.value as (typeof CATEGORIES)[number])}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`cat.${c}` as MessageKey)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("field.warranty")} hint={t("hint.warranty")} fieldId="warrantyUntil">
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
        </div>
      </Group>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Look
// ---------------------------------------------------------------------------

export function LookStep() {
  const t = useT();
  const { draft, setField, setStyle } = useEditing();
  if (!draft) return null;
  const style = draft.styleConfig;
  const toggle = (key: BooleanStyleKey) => (checked: boolean) => setStyle(key, checked);

  return (
    <div className="space-y-6">
      <Group title={t("section.style")}>
        <LookPicker />
        <Segmented
          label={t("field.width")}
          value={style.width}
          options={[
            { value: "80mm", label: "80 mm" },
            { value: "58mm", label: "58 mm" },
          ]}
          onChange={(v) => setStyle("width", v)}
        />
      </Group>

      <div>
        <Field label={t("field.footer")} fieldId="notes">
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
      </div>

      <MoreOptions title={t("editor.moreOptions")}>
        <Segmented
          label={t("field.typeface")}
          value={style.fontFamily}
          options={[
            { value: "mono", label: t("font.mono") },
            { value: "typewriter", label: t("font.typewriter") },
            { value: "dotmatrix", label: t("font.dotmatrix") },
          ]}
          onChange={(v) => setStyle("fontFamily", v)}
        />
        <Segmented
          label={t("field.paper")}
          value={style.paperTheme}
          options={[
            { value: "clean", label: t("paper.clean") },
            { value: "aged", label: t("paper.aged") },
            { value: "pink", label: t("paper.pink") },
            { value: "blue", label: t("paper.blue") },
          ]}
          onChange={(v) => setStyle("paperTheme", v)}
        />
        <div className="divide-y divide-border">
          <Toggle label={t("toggle.tear")} checked={style.tearEdge} onChange={toggle("tearEdge")} />
          <Toggle label={t("toggle.grain")} checked={style.monochromeDither} onChange={toggle("monochromeDither")} />
          <Toggle label={t("toggle.barcode")} checked={style.showBarcode} onChange={toggle("showBarcode")} />
          <Toggle label={t("toggle.qr")} checked={style.showQr} onChange={toggle("showQr")} />
        </div>
        <Field label={t("field.barcode")} fieldId="barcodeData">
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
        <Field label={t("field.qr")} hint={t("hint.qr")} fieldId="qrData">
          {(id) => (
            <input
              id={id}
              className={inputClass}
              maxLength={512}
              placeholder={t("field.qrPh")}
              value={draft.qrData}
              onChange={(e) => setField("qrData", e.target.value)}
            />
          )}
        </Field>
      </MoreOptions>
    </div>
  );
}

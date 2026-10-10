"use client";

import type { Ref } from "react";

import { Barcode } from "@/components/receipt/barcode";
import { QrCode } from "@/components/receipt/qr-code";
import { computeTotals, formatAmount, lineTotal } from "@/lib/utils/currency";
import type { ReceiptDraft } from "@/lib/validators/receipt-schema";

type ReceiptCanvasProps = {
  draft: ReceiptDraft;
  /** Points at the paper node itself, for PNG/PDF export and printing. */
  ref?: Ref<HTMLDivElement>;
  /** Makes lines clickable; receives the editor field a line belongs to. */
  onFieldClick?: (field: string) => void;
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** `2026-10-11T14:05` -> `11/10/2026 14:05`, parsed by hand so output never depends on locale. */
function formatReceiptDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : value;
}

/** `2027-10-11` -> `11 OCT 2027`. */
export function formatWarrantyDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}` : value;
}

function Divider({ double }: { double?: boolean }) {
  return <div aria-hidden className="receipt-divider" data-double={double || undefined} />;
}

function Row({
  label,
  value,
  strong,
  indent,
  large,
  field,
}: {
  label: string;
  value: string;
  strong?: boolean;
  indent?: boolean;
  large?: boolean;
  field?: string;
}) {
  return (
    <div
      data-field={field}
      className={`flex items-baseline justify-between gap-3 ${strong ? "font-bold" : ""} ${
        indent ? "pl-[2ch]" : ""
      } ${large ? "text-[1.2em]" : ""}`}
    >
      <span className="min-w-0 break-words">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

export function ReceiptCanvas({ draft, ref, onFieldClick }: ReceiptCanvasProps) {
  const { styleConfig: style, currency } = draft;
  const t = computeTotals(draft);
  const money = (n: number) => formatAmount(n, currency);
  const items = draft.items.filter((item) => item.name.trim() || item.price > 0);
  const qrValue = draft.qrData.trim() || draft.receiptNo.trim();
  const compact = style.width === "58mm";
  const isCash = draft.paymentMethod === "CASH";
  const taxLine = `${draft.taxLabel} ${draft.taxRate}%${draft.taxInclusive ? " INCL." : ""}`;
  const hasOrderMeta = draft.cashier || draft.tableNo || draft.orderType;

  return (
    <div
      ref={ref}
      className="receipt-paper"
      data-width={style.width}
      data-theme={style.paperTheme}
      data-font={style.fontFamily}
      data-tear={style.tearEdge || undefined}
      data-dither={style.monochromeDither || undefined}
      data-interactive={onFieldClick ? "" : undefined}
      onClick={
        onFieldClick
          ? (e) => {
              const el = (e.target as HTMLElement).closest<HTMLElement>("[data-field]");
              if (el?.dataset.field) onFieldClick(el.dataset.field);
            }
          : undefined
      }
    >
      <div className="receipt-ink space-y-2">
        <header className="space-y-0.5 text-center">
          {style.logo && (
            // A data: URL generated locally; next/image adds nothing here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={style.logo} alt="" className="receipt-logo" data-field="logo" />
          )}
          <p className="receipt-title break-words" data-field="merchantName">{draft.merchantName || "MERCHANT NAME"}</p>
          {draft.merchantAddress && (
            <p className="break-words whitespace-pre-line" data-field="merchantAddress">
              {draft.merchantAddress}
            </p>
          )}
          {draft.merchantPhone && <p data-field="merchantPhone">TEL: {draft.merchantPhone}</p>}
        </header>

        <p className="text-center tracking-widest" data-field="title">*** {draft.title.toUpperCase() || "SALES RECEIPT"} ***</p>

        <Divider />

        <div className="space-y-0.5">
          {draft.receiptNo && <Row label="NO:" value={draft.receiptNo} field="receiptNo" />}
          <Row label="DATE:" value={formatReceiptDate(draft.receiptDate)} field="receiptDate" />
          {hasOrderMeta && (
            <>
              {draft.cashier && <Row label="CASHIER:" value={draft.cashier.toUpperCase()} field="cashier" />}
              {draft.tableNo && <Row label="TABLE:" value={draft.tableNo.toUpperCase()} field="tableNo" />}
              {draft.orderType && <Row label="ORDER:" value={draft.orderType} field="orderType" />}
            </>
          )}
          {!compact && !hasOrderMeta && (
            <Row label="CATEGORY:" value={draft.category.toUpperCase()} field="category" />
          )}
        </div>

        <Divider />

        <div className="space-y-1.5">
          {items.length === 0 && (
            <p className="text-center opacity-70" data-field="items">
              ( NO ITEMS )
            </p>
          )}
          {items.map((item) => (
            <div key={item.id} data-field={`item-${item.id}`}>
              <p className="break-words uppercase">{item.name || "ITEM"}</p>
              <Row indent label={`${item.qty} x ${money(item.price)}`} value={money(lineTotal(item, currency))} />
            </div>
          ))}
        </div>

        <Divider />

        <div className="space-y-0.5">
          <Row label="SUBTOTAL" value={money(t.subtotal)} field="items" />
          {t.discount > 0 && <Row label="DISCOUNT" value={`-${money(t.discount)}`} field="discountAmount" />}
          {draft.serviceChargeRate > 0 && (
            <Row
              label={`SERVICE CHG ${draft.serviceChargeRate}%`}
              value={money(t.serviceCharge)}
              field="serviceChargeRate"
            />
          )}
          {draft.taxRate > 0 && !draft.taxInclusive && (
            <Row label={taxLine} value={money(t.taxAmount)} field="taxRate" />
          )}
          {t.rounding !== 0 && (
            <Row
              label="ROUNDING ADJ"
              value={`${t.rounding > 0 ? "+" : "-"}${money(Math.abs(t.rounding))}`}
              field="roundCash"
            />
          )}
        </div>

        <Divider double />

        <Row label={`TOTAL ${currency}`} value={money(t.payable)} strong large field="paymentMethod" />

        <Divider double />

        <div className="space-y-0.5">
          <Row label="PAID BY" value={draft.paymentMethod} field="paymentMethod" />
          {isCash && t.tendered > 0 && (
            <>
              <Row label="CASH TENDERED" value={money(t.tendered)} field="amountTendered" />
              <Row label="CHANGE" value={money(t.change)} strong field="amountTendered" />
            </>
          )}
          {draft.taxRate > 0 && draft.taxInclusive && (
            <Row label={`${draft.taxLabel} ${draft.taxRate}% INCLUDED`} value={money(t.taxAmount)} field="taxRate" />
          )}
        </div>

        {draft.warrantyUntil && (
          <div className="receipt-box text-center" data-field="warrantyUntil">
            <p className="font-bold">WARRANTY VALID UNTIL</p>
            <p>{formatWarrantyDate(draft.warrantyUntil)}</p>
          </div>
        )}

        {draft.notes && (
          <p className="pt-1 text-center break-words whitespace-pre-line" data-field="notes">
            {draft.notes}
          </p>
        )}

        {(style.showBarcode || style.showQr) && (
          <div className="flex flex-col items-center gap-2 pt-2">
            {style.showBarcode && draft.barcodeData && (
              <div className="flex w-full flex-col items-center gap-1" data-field="barcodeData">
                <Barcode value={draft.barcodeData} barWidth={compact ? 1.2 : 1.6} height={compact ? 36 : 46} />
                <p className="text-[0.85em] tracking-[0.3em]">{draft.barcodeData}</p>
              </div>
            )}
            {style.showQr && qrValue && (
              <div data-field="qrData">
                <QrCode value={qrValue} size={compact ? 72 : 92} />
              </div>
            )}
          </div>
        )}

        <p className="pt-1 text-center text-[0.8em] opacity-70">RYANNRECEIPT · KEEP FOR YOUR RECORDS</p>
      </div>
    </div>
  );
}

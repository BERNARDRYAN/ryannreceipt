"use client";

import type { Ref } from "react";

import { Barcode } from "@/components/receipt/barcode";
import { QrCode } from "@/components/receipt/qr-code";
import { computeTotals, formatAmount, lineTotal } from "@/lib/utils/currency";
import type { ReceiptDraft } from "@/lib/validators/receipt-schema";

type ReceiptCanvasProps = {
  draft: ReceiptDraft;
  /** Points at the paper node itself, for PNG export. */
  ref?: Ref<HTMLDivElement>;
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** `2026-10-11T14:05` -> `11/10/2026 14:05`, parsed by hand so output never depends on locale. */
function formatReceiptDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : value;
}

/** `2027-10-11` -> `11 OCT 2027`. */
function formatWarrantyDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}` : value;
}

function Divider({ char = "-" }: { char?: string }) {
  return (
    <div aria-hidden className="receipt-divider">
      {char.repeat(96)}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  indent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${strong ? "font-bold" : ""} ${indent ? "pl-[2ch]" : ""}`}
    >
      <span className="min-w-0 break-words">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

export function ReceiptCanvas({ draft, ref }: ReceiptCanvasProps) {
  const { styleConfig: style, currency } = draft;
  const { subtotal, discount, taxAmount, total } = computeTotals(
    draft.items,
    draft.taxRate,
    draft.discountAmount,
    currency,
  );
  const money = (n: number) => formatAmount(n, currency);
  const items = draft.items.filter((item) => item.name.trim() || item.price > 0);
  const qrValue = draft.qrData.trim() || draft.receiptNo.trim();
  const compact = style.width === "58mm";

  return (
    <div
      ref={ref}
      className="receipt-paper"
      data-width={style.width}
      data-theme={style.paperTheme}
      data-tear={style.tearEdge || undefined}
      data-dither={style.monochromeDither || undefined}
    >
      <div className="receipt-ink space-y-2">
        <header className="space-y-0.5 text-center">
          <p className="receipt-title break-words">{draft.merchantName || "MERCHANT NAME"}</p>
          {draft.merchantAddress && <p className="break-words">{draft.merchantAddress}</p>}
          {draft.merchantPhone && <p>TEL: {draft.merchantPhone}</p>}
        </header>

        <p className="text-center tracking-widest">*** {draft.title.toUpperCase() || "SALES RECEIPT"} ***</p>

        <Divider />

        <div className="space-y-0.5">
          {draft.receiptNo && <Row label="NO:" value={draft.receiptNo} />}
          <Row label="DATE:" value={formatReceiptDate(draft.receiptDate)} />
          {!compact && <Row label="CATEGORY:" value={draft.category.toUpperCase()} />}
        </div>

        <Divider />

        <div className="space-y-1.5">
          {items.length === 0 && <p className="text-center opacity-70">( NO ITEMS )</p>}
          {items.map((item) => (
            <div key={item.id}>
              <p className="break-words uppercase">{item.name || "ITEM"}</p>
              <Row
                indent
                label={`${item.qty} x ${money(item.price)}`}
                value={money(lineTotal(item, currency))}
              />
            </div>
          ))}
        </div>

        <Divider />

        <div className="space-y-0.5">
          <Row label="SUBTOTAL" value={money(subtotal)} />
          {discount > 0 && <Row label="DISCOUNT" value={`-${money(discount)}`} />}
          {draft.taxRate > 0 && <Row label={`TAX ${draft.taxRate}%`} value={money(taxAmount)} />}
        </div>

        <Divider char="=" />

        <Row label={`TOTAL ${currency}`} value={money(total)} strong />

        <Divider char="=" />

        <Row label="PAID BY" value={draft.paymentMethod} />

        {draft.warrantyUntil && (
          <div className="receipt-box text-center">
            <p className="font-bold">WARRANTY VALID UNTIL</p>
            <p>{formatWarrantyDate(draft.warrantyUntil)}</p>
          </div>
        )}

        {draft.notes && <p className="whitespace-pre-line break-words pt-1 text-center">{draft.notes}</p>}

        {(style.showBarcode || style.showQr) && (
          <div className="flex flex-col items-center gap-2 pt-2">
            {style.showBarcode && draft.barcodeData && (
              <div className="flex w-full flex-col items-center gap-1">
                <Barcode value={draft.barcodeData} barWidth={compact ? 1.2 : 1.6} height={compact ? 36 : 46} />
                <p className="text-[0.85em] tracking-[0.3em]">{draft.barcodeData}</p>
              </div>
            )}
            {style.showQr && qrValue && <QrCode value={qrValue} size={compact ? 72 : 92} />}
          </div>
        )}

        <p className="pt-1 text-center text-[0.8em] opacity-70">RYANNRECEIPT · KEEP FOR YOUR RECORDS</p>
      </div>
    </div>
  );
}

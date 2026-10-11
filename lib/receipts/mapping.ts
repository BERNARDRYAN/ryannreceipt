import { normalizeDraft } from "@/lib/receipts/defaults";
import { computeTotals } from "@/lib/utils/currency";
import type { Preset, PresetInput, ReceiptDraft } from "@/lib/validators/receipt-schema";

/** Columns of `public.receipt_items` (see supabase/migrations). */
export type ReceiptRow = {
  id: string;
  user_id: string;
  title: string;
  merchant_name: string;
  merchant_address: string | null;
  merchant_phone: string | null;
  receipt_no: string | null;
  receipt_date: string;
  currency: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  payment_method: string;
  category: string;
  notes: string | null;
  barcode_data: string | null;
  qr_data: string | null;
  items: ReceiptDraft["items"];
  style_config: ReceiptDraft["styleConfig"];
  warranty_until: string | null;
  is_pinned: boolean;
  meta: Partial<ReceiptMeta>;
  created_at: string;
  updated_at: string;
};

/** Draft fields with no dedicated column, plus derived amounts for reporting. */
type ReceiptMeta = Pick<
  ReceiptDraft,
  | "taxLabel"
  | "taxInclusive"
  | "serviceChargeRate"
  | "roundCash"
  | "amountTendered"
  | "cashier"
  | "tableNo"
  | "orderType"
  | "wallet"
  | "tags"
  | "taxRelief"
  | "hasPhoto"
> & { serviceCharge: number; rounding: number; v: 1 };

/** Lightweight columns for list/summary views (no items, no logo). */
export const RECEIPT_SUMMARY_COLUMNS =
  "id,title,merchant_name,receipt_no,receipt_date,currency,total,category,payment_method,warranty_until,is_pinned,meta,updated_at";

export type ReceiptSummaryRow = Pick<
  ReceiptRow,
  | "id"
  | "title"
  | "merchant_name"
  | "receipt_no"
  | "receipt_date"
  | "currency"
  | "total"
  | "category"
  | "payment_method"
  | "warranty_until"
  | "is_pinned"
  | "meta"
  | "updated_at"
>;

/**
 * Receipt dates are wall-clock times ("14:05 at the shop"), not instants, so the
 * local `YYYY-MM-DDTHH:mm` is stored as if it were UTC and read back verbatim.
 */
export const wallClockToTimestamp = (local: string) => `${local.slice(0, 16)}:00Z`;
export const timestampToWallClock = (ts: string) => ts.slice(0, 16);

/** Build an insert/update row. Totals are always recomputed server-side. */
export function draftToRow(id: string, userId: string, isPinned: boolean, draft: ReceiptDraft) {
  const t = computeTotals(draft);
  const meta: ReceiptMeta = {
    taxLabel: draft.taxLabel,
    taxInclusive: draft.taxInclusive,
    serviceChargeRate: draft.serviceChargeRate,
    roundCash: draft.roundCash,
    amountTendered: draft.amountTendered,
    cashier: draft.cashier,
    tableNo: draft.tableNo,
    orderType: draft.orderType,
    wallet: draft.wallet,
    tags: draft.tags,
    taxRelief: draft.taxRelief,
    hasPhoto: draft.hasPhoto,
    serviceCharge: t.serviceCharge,
    rounding: t.rounding,
    v: 1,
  };
  return {
    id,
    user_id: userId,
    title: draft.title || "Receipt",
    merchant_name: draft.merchantName,
    merchant_address: draft.merchantAddress || null,
    merchant_phone: draft.merchantPhone || null,
    receipt_no: draft.receiptNo || null,
    receipt_date: wallClockToTimestamp(draft.receiptDate),
    currency: draft.currency,
    subtotal: t.subtotal,
    tax_rate: draft.taxRate,
    tax_amount: t.taxAmount,
    discount_amount: t.discount,
    total: t.payable,
    payment_method: draft.paymentMethod,
    category: draft.category,
    notes: draft.notes || null,
    barcode_data: draft.barcodeData || null,
    qr_data: draft.qrData || null,
    items: draft.items,
    style_config: draft.styleConfig,
    warranty_until: draft.warrantyUntil || null,
    is_pinned: isPinned,
    meta,
  } satisfies Omit<ReceiptRow, "created_at" | "updated_at">;
}

export function rowToRecord(row: ReceiptRow) {
  const meta = row.meta ?? {};
  const draft = normalizeDraft({
    title: row.title,
    merchantName: row.merchant_name,
    merchantAddress: row.merchant_address ?? "",
    merchantPhone: row.merchant_phone ?? "",
    receiptNo: row.receipt_no ?? "",
    receiptDate: timestampToWallClock(row.receipt_date),
    currency: row.currency as ReceiptDraft["currency"],
    taxRate: Number(row.tax_rate),
    discountAmount: Number(row.discount_amount),
    paymentMethod: row.payment_method as ReceiptDraft["paymentMethod"],
    category: row.category as ReceiptDraft["category"],
    notes: row.notes ?? "",
    barcodeData: row.barcode_data ?? "",
    qrData: row.qr_data ?? "",
    warrantyUntil: row.warranty_until ?? "",
    items: row.items,
    styleConfig: row.style_config,
    ...(meta.taxLabel !== undefined && { taxLabel: meta.taxLabel }),
    ...(meta.taxInclusive !== undefined && { taxInclusive: meta.taxInclusive }),
    ...(meta.serviceChargeRate !== undefined && { serviceChargeRate: meta.serviceChargeRate }),
    ...(meta.roundCash !== undefined && { roundCash: meta.roundCash }),
    ...(meta.amountTendered !== undefined && { amountTendered: meta.amountTendered }),
    ...(meta.cashier !== undefined && { cashier: meta.cashier }),
    ...(meta.tableNo !== undefined && { tableNo: meta.tableNo }),
    ...(meta.orderType !== undefined && { orderType: meta.orderType }),
    ...(meta.wallet !== undefined && { wallet: meta.wallet }),
    ...(meta.tags !== undefined && { tags: meta.tags }),
    ...(meta.taxRelief !== undefined && { taxRelief: meta.taxRelief }),
    ...(meta.hasPhoto !== undefined && { hasPhoto: meta.hasPhoto }),
  });
  return { id: row.id, isPinned: row.is_pinned, draft, updatedAt: row.updated_at };
}

export type PresetRow = {
  id: string;
  user_id: string;
  name: string;
  merchant_name: string | null;
  merchant_address: string | null;
  merchant_phone: string | null;
  currency: string | null;
  style_config: Partial<ReceiptDraft["styleConfig"]>;
  created_at: string;
};

export function presetToRow(userId: string, p: PresetInput) {
  return {
    user_id: userId,
    name: p.name,
    merchant_name: p.merchantName || null,
    merchant_address: p.merchantAddress || null,
    merchant_phone: p.merchantPhone || null,
    currency: p.currency,
    style_config: p.styleConfig,
  };
}

export function rowToPreset(row: PresetRow): Preset {
  const base = normalizeDraft({});
  return {
    id: row.id,
    name: row.name,
    merchantName: row.merchant_name ?? "",
    merchantAddress: row.merchant_address ?? "",
    merchantPhone: row.merchant_phone ?? "",
    currency: (row.currency ?? "MYR") as Preset["currency"],
    styleConfig: { ...base.styleConfig, ...row.style_config },
  };
}

import { z } from "zod";

export const CURRENCIES = ["MYR", "USD", "SGD", "EUR", "GBP", "JPY", "AUD", "IDR", "THB", "PHP"] as const;
export const PAYMENT_METHODS = ["CASH", "CARD", "E-WALLET", "QR PAY", "BANK TRANSFER"] as const;
export const CATEGORIES = [
  "General",
  "Food & Drink",
  "Groceries",
  "Electronics",
  "Transport",
  "Shopping",
  "Utilities",
  "Health",
  "Other",
] as const;
export const ORDER_TYPES = ["", "DINE-IN", "TAKEAWAY", "DELIVERY"] as const;
export const TAX_LABELS = ["SST", "GST", "VAT", "TAX"] as const;
export const FONT_FAMILIES = ["mono", "typewriter", "dotmatrix"] as const;
export const PAPER_THEMES = ["clean", "aged", "pink", "blue"] as const;

/** Logo is stored as a small dithered PNG data URL. ~120 KB is far above what the ditherer emits. */
export const MAX_LOGO_LENGTH = 120_000;

const text = (max: number) => z.string().trim().max(max);
const money = z.number().min(0).max(1_000_000_000);

export const receiptLineItemSchema = z.strictObject({
  id: z.uuid(),
  name: text(80),
  qty: z.number().int().min(0).max(9999),
  price: z.number().min(0).max(1_000_000),
});

export const receiptStyleSchema = z.strictObject({
  width: z.enum(["80mm", "58mm"]),
  fontFamily: z.enum(FONT_FAMILIES),
  paperTheme: z.enum(PAPER_THEMES),
  showBarcode: z.boolean(),
  showQr: z.boolean(),
  tearEdge: z.boolean(),
  monochromeDither: z.boolean(),
  logo: z
    .string()
    .max(MAX_LOGO_LENGTH)
    .regex(/^(data:image\/png;base64,[A-Za-z0-9+/=]+)?$/),
});

/** Client-side receipt draft. Mirrors `public.receipt_items` (camelCased); extras live in `meta`. */
export const receiptDraftSchema = z.strictObject({
  title: text(80),
  merchantName: text(60),
  merchantAddress: text(160),
  merchantPhone: text(32),
  receiptNo: text(32),
  receiptDate: z.iso.datetime({ local: true }),
  currency: z.enum(CURRENCIES),
  taxRate: z.number().min(0).max(100),
  taxLabel: z.enum(TAX_LABELS),
  taxInclusive: z.boolean(),
  serviceChargeRate: z.number().min(0).max(100),
  discountAmount: money,
  roundCash: z.boolean(),
  amountTendered: money,
  paymentMethod: z.enum(PAYMENT_METHODS),
  category: z.enum(CATEGORIES),
  cashier: text(32),
  tableNo: text(12),
  orderType: z.enum(ORDER_TYPES),
  notes: text(280),
  barcodeData: text(48),
  qrData: text(512),
  warrantyUntil: z.union([z.iso.date(), z.literal("")]),
  items: z.array(receiptLineItemSchema).max(100),
  styleConfig: receiptStyleSchema,
});

/** A draft plus its identity: the same uuid is used locally and as the cloud row id. */
export const receiptRecordSchema = z.strictObject({
  id: z.uuid(),
  isPinned: z.boolean(),
  draft: receiptDraftSchema,
});

export const receiptBatchSchema = z.strictObject({
  receipts: z.array(receiptRecordSchema).min(1).max(50),
});

export const receiptPatchSchema = z
  .strictObject({
    isPinned: z.boolean().optional(),
    draft: receiptDraftSchema.optional(),
  })
  .refine((v) => v.isPinned !== undefined || v.draft !== undefined, "Nothing to update");

export const presetInputSchema = z.strictObject({
  name: text(40).min(1),
  merchantName: text(60),
  merchantAddress: text(160),
  merchantPhone: text(32),
  currency: z.enum(CURRENCIES),
  styleConfig: receiptStyleSchema,
});

export type ReceiptLineItem = z.infer<typeof receiptLineItemSchema>;
export type ReceiptStyle = z.infer<typeof receiptStyleSchema>;
export type ReceiptDraft = z.infer<typeof receiptDraftSchema>;
export type ReceiptRecord = z.infer<typeof receiptRecordSchema>;
export type PresetInput = z.infer<typeof presetInputSchema>;
export type Preset = PresetInput & { id: string };
export type Currency = (typeof CURRENCIES)[number];
export type Category = (typeof CATEGORIES)[number];

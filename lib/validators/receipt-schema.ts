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

const text = (max: number) => z.string().trim().max(max);

export const receiptLineItemSchema = z.strictObject({
  id: z.uuid(),
  name: text(80),
  qty: z.number().int().min(0).max(9999),
  price: z.number().min(0).max(1_000_000),
});

export const receiptStyleSchema = z.strictObject({
  width: z.enum(["80mm", "58mm"]),
  fontFamily: z.enum(["mono"]),
  paperTheme: z.enum(["clean", "aged"]),
  showBarcode: z.boolean(),
  showQr: z.boolean(),
  tearEdge: z.boolean(),
  monochromeDither: z.boolean(),
});

/** Client-side receipt draft. Mirrors `public.receipt_items` (camelCased). */
export const receiptDraftSchema = z.strictObject({
  title: text(80),
  merchantName: text(60),
  merchantAddress: text(160),
  merchantPhone: text(32),
  receiptNo: text(32),
  receiptDate: z.iso.datetime({ local: true }),
  currency: z.enum(CURRENCIES),
  taxRate: z.number().min(0).max(100),
  discountAmount: z.number().min(0).max(1_000_000_000),
  paymentMethod: z.enum(PAYMENT_METHODS),
  category: z.enum(CATEGORIES),
  notes: text(280),
  barcodeData: text(48),
  qrData: text(512),
  warrantyUntil: z.union([z.iso.date(), z.literal("")]),
  items: z.array(receiptLineItemSchema).max(100),
  styleConfig: receiptStyleSchema,
});

export type ReceiptLineItem = z.infer<typeof receiptLineItemSchema>;
export type ReceiptStyle = z.infer<typeof receiptStyleSchema>;
export type ReceiptDraft = z.infer<typeof receiptDraftSchema>;
export type Currency = (typeof CURRENCIES)[number];

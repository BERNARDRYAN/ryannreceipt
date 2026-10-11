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
/**
 * Malaysian personal income tax relief groups a receipt may count towards
 * (for the yearly e-Filing summary). Limits change yearly, so none are stored.
 */
export const TAX_RELIEFS = [
  "",
  "lifestyle",
  "sports",
  "medical",
  "parents-medical",
  "education",
  "childcare",
  "breastfeeding",
  "ev-charging",
  "disability",
] as const;

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
  /** Specific account paid from, e.g. "Maybank Visa" or "TNG eWallet". */
  wallet: text(30),
  tags: z.array(text(24).min(1)).max(10),
  taxRelief: z.enum(TAX_RELIEFS),
  /** A photo of the paper receipt is stored in the cloud for this receipt. */
  hasPhoto: z.boolean(),
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

export const RECURRING_FREQUENCIES = ["monthly", "weekly"] as const;

/** A repeating expense (rent, phone bill…) that creates a receipt on schedule. */
export const recurringRuleSchema = z.strictObject({
  id: z.uuid(),
  name: text(60).min(1),
  amount: money,
  currency: z.enum(CURRENCIES),
  category: z.enum(CATEGORIES),
  paymentMethod: z.enum(PAYMENT_METHODS),
  wallet: text(30),
  frequency: z.enum(RECURRING_FREQUENCIES),
  /** Day of month 1–28 (monthly) or weekday 0–6, Sunday = 0 (weekly). */
  day: z.number().int().min(0).max(28),
  startDate: z.iso.date(),
  active: z.boolean(),
  /** Last date a receipt was created for this rule ("" = never). */
  lastRun: z.union([z.iso.date(), z.literal("")]),
});

const budgetMap = z.partialRecord(z.enum(CURRENCIES), money);

/** Per-user settings synced across devices when signed in. */
export const userSettingsSchema = z.strictObject({
  budgets: budgetMap,
  categoryBudgets: z.partialRecord(z.enum(CURRENCIES), z.partialRecord(z.enum(CATEGORIES), money)),
  recurring: z.array(recurringRuleSchema).max(50),
  updatedAt: z.iso.datetime(),
});

export type ReceiptLineItem = z.infer<typeof receiptLineItemSchema>;
export type RecurringRule = z.infer<typeof recurringRuleSchema>;
export type UserSettings = z.infer<typeof userSettingsSchema>;
export type TaxRelief = (typeof TAX_RELIEFS)[number];
export type ReceiptStyle = z.infer<typeof receiptStyleSchema>;
export type ReceiptDraft = z.infer<typeof receiptDraftSchema>;
export type ReceiptRecord = z.infer<typeof receiptRecordSchema>;
export type PresetInput = z.infer<typeof presetInputSchema>;
export type Preset = PresetInput & { id: string };
export type Currency = (typeof CURRENCIES)[number];
export type Category = (typeof CATEGORIES)[number];

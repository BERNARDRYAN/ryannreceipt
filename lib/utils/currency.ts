import type { Currency, ReceiptLineItem } from "@/lib/validators/receipt-schema";

const ZERO_DECIMAL: ReadonlySet<Currency> = new Set(["JPY", "IDR"]);

export function currencyDecimals(currency: Currency) {
  return ZERO_DECIMAL.has(currency) ? 0 : 2;
}

/** Plain receipt-style number, e.g. `1,234.50` (the code is printed separately). */
export function formatAmount(value: number, currency: Currency) {
  const digits = currencyDecimals(currency);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Round to the currency's minor unit without float drift. */
function round(value: number, currency: Currency) {
  const factor = 10 ** currencyDecimals(currency);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function lineTotal(item: Pick<ReceiptLineItem, "qty" | "price">, currency: Currency) {
  return round(item.qty * item.price, currency);
}

/** Discount applies before tax; tax is charged on the discounted subtotal. */
export function computeTotals(
  items: ReceiptLineItem[],
  taxRate: number,
  discountAmount: number,
  currency: Currency,
) {
  const subtotal = round(
    items.reduce((sum, item) => sum + lineTotal(item, currency), 0),
    currency,
  );
  const discount = round(Math.min(Math.max(discountAmount, 0), subtotal), currency);
  const taxable = subtotal - discount;
  const taxAmount = round((taxable * Math.max(taxRate, 0)) / 100, currency);
  const total = round(taxable + taxAmount, currency);
  return { subtotal, discount, taxAmount, total };
}

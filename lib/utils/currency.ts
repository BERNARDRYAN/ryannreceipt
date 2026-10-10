import type { Currency, ReceiptDraft, ReceiptLineItem } from "@/lib/validators/receipt-schema";

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

/** Editor-friendly fixed string without grouping, e.g. `2.80`. */
export function formatInputAmount(value: number, currency: Currency) {
  return value.toFixed(currencyDecimals(currency));
}

// All arithmetic runs in integer minor units (cents) so totals never drift.
const factor = (currency: Currency) => 10 ** currencyDecimals(currency);
const toMinor = (value: number, currency: Currency) => Math.round((value + Number.EPSILON) * factor(currency));
const fromMinor = (minor: number, currency: Currency) => minor / factor(currency);

export function lineTotal(item: Pick<ReceiptLineItem, "qty" | "price">, currency: Currency) {
  return fromMinor(item.qty * toMinor(item.price, currency), currency);
}

export type ReceiptTotals = {
  subtotal: number;
  discount: number;
  serviceCharge: number;
  /** Tax charged on top (exclusive) or contained in the prices (inclusive). */
  taxAmount: number;
  /** Total before cash rounding. */
  total: number;
  /** Signed adjustment from rounding cash payments to the nearest 0.05. */
  rounding: number;
  /** Amount actually payable. */
  payable: number;
  tendered: number;
  change: number;
};

type TotalsInput = Pick<
  ReceiptDraft,
  | "items"
  | "currency"
  | "taxRate"
  | "taxInclusive"
  | "serviceChargeRate"
  | "discountAmount"
  | "roundCash"
  | "amountTendered"
  | "paymentMethod"
>;

/**
 * Order of operations (Malaysian F&B convention):
 *   net      = subtotal - discount
 *   service  = net × service%
 *   tax      = (net + service) × tax%        (exclusive)
 *            = (net + service) × t / (100+t) (inclusive: already in the prices)
 *   payable  = total rounded to 0.05 for cash, when enabled
 */
export function computeTotals(input: TotalsInput): ReceiptTotals {
  const { currency } = input;
  const subtotalMinor = input.items.reduce((sum, item) => sum + item.qty * toMinor(item.price, currency), 0);
  const discountMinor = Math.min(Math.max(toMinor(input.discountAmount, currency), 0), subtotalMinor);
  const netMinor = subtotalMinor - discountMinor;
  const serviceMinor = Math.round((netMinor * Math.max(input.serviceChargeRate, 0)) / 100);
  const baseMinor = netMinor + serviceMinor;

  const rate = Math.max(input.taxRate, 0);
  const taxMinor = input.taxInclusive
    ? Math.round((baseMinor * rate) / (100 + rate))
    : Math.round((baseMinor * rate) / 100);
  const totalMinor = input.taxInclusive ? baseMinor : baseMinor + taxMinor;

  const isCash = input.paymentMethod === "CASH";
  // Nearest 5 sen: .01/.02 down, .03/.04 up to .05, .06/.07 down to .05, .08/.09 up.
  const canRound = isCash && input.roundCash && currencyDecimals(currency) === 2;
  const payableMinor = canRound ? Math.round(totalMinor / 5) * 5 : totalMinor;

  const tenderedMinor = isCash ? toMinor(input.amountTendered, currency) : 0;
  const changeMinor = tenderedMinor > 0 ? Math.max(0, tenderedMinor - payableMinor) : 0;

  return {
    subtotal: fromMinor(subtotalMinor, currency),
    discount: fromMinor(discountMinor, currency),
    serviceCharge: fromMinor(serviceMinor, currency),
    taxAmount: fromMinor(taxMinor, currency),
    total: fromMinor(totalMinor, currency),
    rounding: fromMinor(payableMinor - totalMinor, currency),
    payable: fromMinor(payableMinor, currency),
    tendered: fromMinor(tenderedMinor, currency),
    change: fromMinor(changeMinor, currency),
  };
}

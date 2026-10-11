import { guessCategory, guessPayment } from "@/lib/quick-add/keywords";
import type { Category, ReceiptDraft } from "@/lib/validators/receipt-schema";

export type ScannedReceipt = {
  merchantName: string;
  merchantAddress: string;
  merchantPhone: string;
  /** Local `YYYY-MM-DDTHH:mm`, or "" if no date was found. */
  receiptDate: string;
  total: number | null;
  /** Printed subtotal, when the receipt has one. */
  subtotal: number | null;
  taxRate: number;
  serviceChargeRate: number;
  items: { name: string; qty: number; price: number }[];
  category: Category | null;
  paymentMethod: ReceiptDraft["paymentMethod"] | null;
  wallet: string;
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, ogo: 8, sep: 9, sept: 9,
  oct: 10, okt: 10, nov: 11, dec: 12, dis: 12,
};

// Lines that are never items: totals, tax, payment, and receipt chrome.
const NOT_ITEM =
  /\b(sub\s*-?total|total|jumlah|grand|tax|sst|gst|service|svc|rounding|round|adj|cash|tunai|change|baki|tender|paid|payment|visa|master|card|debit|credit|balance|discount|diskaun|amount|due|qty|items?|tel|phone|fax|invoice|receipt|resit|no\b|date|tarikh|time|cashier|counter|table|member|points?|thank)\b|总计|合计|找零|现金|税/i;

const HEADER_NOISE = /(receipt|invoice|resit|tax|tel|phone|fax|gst|sst|reg|no\.|date|cashier|www|http|@|\d{5,})/i;

const AMOUNT = /(-?\d{1,6}(?:,\d{3})*[.,]\d{2})\s*[A-Z*]?$/;

const toNumber = (s: string) => {
  const cleaned = s.replace(/,(?=\d{3}\b)/g, "").replace(",", ".");
  return Number(cleaned);
};

const pad = (n: number) => String(n).padStart(2, "0");

function titleCase(s: string) {
  return /[a-z]/.test(s) ? s : s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

function findDate(text: string): string {
  let y = 0;
  let m = 0;
  let d = 0;
  const iso = /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(text);
  const dmy = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(text);
  const named = /\b(\d{1,2})[\s-]([A-Za-z]{3,4})[A-Za-z]*[\s-,]+(\d{2,4})\b/.exec(text);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (dmy) [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  else if (named && MONTHS[named[2].toLowerCase()]) [d, m, y] = [Number(named[1]), MONTHS[named[2].toLowerCase()], Number(named[3])];
  if (!y) return "";
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return "";

  let hh = 12;
  let mm = 0;
  const time = /\b(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?\b/.exec(text);
  if (time) {
    hh = Number(time[1]) % 24;
    mm = Number(time[2]) % 60;
    const ampm = time[3]?.toLowerCase();
    if (ampm === "pm" && hh < 12) hh += 12;
    if (ampm === "am" && hh === 12) hh = 0;
  }
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}`;
}

/**
 * Turn OCR text from a photographed receipt into editable fields. Heuristic by
 * nature: the user reviews everything before it becomes a receipt.
 */
export function parseReceiptText(raw: string): ScannedReceipt {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1);

  // Merchant: the first prominent text line near the top.
  const merchantIndex = lines.slice(0, 6).findIndex((l) => /\p{L}{3,}/u.test(l) && !HEADER_NOISE.test(l));
  const merchantName = merchantIndex >= 0 ? titleCase(lines[merchantIndex]) : "";

  const addressLines = lines
    .slice(Math.max(0, merchantIndex + 1), merchantIndex + 5)
    .filter((l) => /(jalan|jln|lot|no\.?\s*\d|taman|tmn|kuala|selangor|johor|penang|pulau|sabah|sarawak|melaka|perak|kedah|pahang|\b\d{5}\b)/i.test(l))
    .slice(0, 2);
  const phone = /(\+?6?0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{3,4})/.exec(raw)?.[1] ?? "";

  // Total: the last "total"-labelled line that isn't a subtotal.
  let total: number | null = null;
  for (const line of lines) {
    if (/(grand\s*total|net\s*total|total|jumlah|amount\s*due|总计|合计)/i.test(line) && !/sub\s*-?total/i.test(line)) {
      const m = AMOUNT.exec(line);
      if (m) total = toNumber(m[1]);
    }
  }
  if (total === null) {
    const amounts = lines.map((l) => AMOUNT.exec(l)?.[1]).filter(Boolean).map((s) => toNumber(s!));
    total = amounts.length ? Math.max(...amounts) : null;
  }

  const taxMatch = /(sst|gst|service\s*tax|sales\s*tax|vat)[^\d]{0,12}(\d{1,2}(?:\.\d+)?)\s*%/i.exec(raw);
  const taxRate = taxMatch ? Number(taxMatch[2]) : 0;
  // "SERVICE CHG 10%" / "Svc charge 10%" (but not "service tax", handled above).
  const svcMatch = /(service\s*(?:chg|charge)|svc\s*(?:chg|charge)?|caj\s*perkhidmatan)[^\d%]{0,8}(\d{1,2}(?:\.\d+)?)\s*%/i.exec(raw);
  const serviceChargeRate = svcMatch ? Number(svcMatch[2]) : 0;
  let subtotal: number | null = null;
  for (const line of lines) {
    if (/sub\s*-?total|jumlah\s*kecil|小计/i.test(line)) {
      const m = AMOUNT.exec(line);
      if (m) subtotal = toNumber(m[1]);
    }
  }

  // Items: lines ending in an amount, between the header and the total.
  const items: ScannedReceipt["items"] = [];
  for (let i = Math.max(0, merchantIndex + 1); i < lines.length; i++) {
    const line = lines[i];
    if (/(grand\s*total|^total|jumlah)/i.test(line)) break;
    if (NOT_ITEM.test(line)) continue;
    const m = AMOUNT.exec(line);
    if (!m) continue;
    let label = line.slice(0, m.index).trim();
    const lineTotal = toNumber(m[1]);
    let qty = 1;

    // "2 x 2.80" / "2 @ 2.80" on this line or as the whole label.
    const qtyMatch = /^(.*?)(\d{1,3})\s*[x@×]\s*\d+(?:[.,]\d{2})?\s*$/i.exec(label) ?? /^(\d{1,3})\s+(.+)$/.exec(label);
    if (qtyMatch && /[x@×]/i.test(label)) {
      qty = Number(qtyMatch[2]);
      label = qtyMatch[1].trim();
      // Name was on the previous line ("NASI LEMAK" / "2 x 6.45  12.90").
      if (!label && i > 0 && !AMOUNT.test(lines[i - 1]) && !NOT_ITEM.test(lines[i - 1])) label = lines[i - 1];
    } else if (/^\d{1,3}\s+\D/.test(label)) {
      const [, q, rest] = /^(\d{1,3})\s+(.+)$/.exec(label)!;
      qty = Number(q);
      label = rest;
    }
    label = label.replace(/^[\d\s.*#-]+(?=\p{L})/u, "").trim();
    if (!/\p{L}{2,}/u.test(label) || lineTotal <= 0 || qty < 1) continue;
    items.push({ name: titleCase(label).slice(0, 80), qty, price: Math.round((lineTotal / qty) * 100) / 100 });
  }

  const payment = guessPayment(raw);
  return {
    merchantName: merchantName.slice(0, 60),
    merchantAddress: addressLines.join(", ").slice(0, 160),
    merchantPhone: phone.slice(0, 32),
    receiptDate: findDate(raw),
    total,
    subtotal,
    taxRate: taxRate <= 30 ? taxRate : 0,
    serviceChargeRate: serviceChargeRate <= 30 ? serviceChargeRate : 0,
    items: items.slice(0, 50),
    category: guessCategory(`${merchantName} ${items.map((i) => i.name).join(" ")}`),
    paymentMethod: payment?.method ?? null,
    wallet: payment?.wallet ?? "",
  };
}

export type Reconciled = {
  items: ScannedReceipt["items"];
  taxRate: number;
  serviceChargeRate: number;
};

/**
 * Decide which lines to keep so the receipt adds up to the printed total:
 *  1. items alone match the total;
 *  2. items + detected service charge and tax (cash rounding tolerated) match;
 *  3. items match the printed subtotal: keep them and add one "tax & charges" line;
 *  4. otherwise a single line for the total.
 */
export function reconcileItems(scan: ScannedReceipt, fallbackName: string, chargesLabel = "Tax & charges"): Reconciled {
  const sum = scan.items.reduce((s, i) => s + i.qty * i.price, 0);
  // 5 sen covers Malaysian cash rounding; 1% covers OCR'd unit prices.
  const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.06, b * 0.01);
  const none = { taxRate: 0, serviceChargeRate: 0 };
  if (scan.total === null) return { items: scan.items, taxRate: scan.taxRate, serviceChargeRate: scan.serviceChargeRate };
  if (!scan.items.length) return { items: [{ name: fallbackName, qty: 1, price: scan.total }], ...none };
  if (close(sum, scan.total)) return { items: scan.items, ...none };

  const svc = scan.serviceChargeRate / 100;
  const tax = scan.taxRate / 100;
  if ((svc || tax) && close(sum * (1 + svc) * (1 + tax), scan.total)) {
    return { items: scan.items, taxRate: scan.taxRate, serviceChargeRate: scan.serviceChargeRate };
  }
  // Tax + service rarely exceed ~30%; a bigger gap means the items were misread.
  if (scan.subtotal !== null && close(sum, scan.subtotal) && scan.total > sum && scan.total <= sum * 1.3) {
    const extra = Math.round((scan.total - sum) * 100) / 100;
    return { items: [...scan.items, { name: chargesLabel, qty: 1, price: extra }], ...none };
  }
  return { items: [{ name: fallbackName, qty: 1, price: scan.total }], ...none };
}

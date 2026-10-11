import { guessCategory, guessPayment } from "@/lib/quick-add/keywords";
import type { Category, ReceiptDraft } from "@/lib/validators/receipt-schema";

/** RFC 4180-ish CSV parser: quoted fields, escaped quotes, CRLF; delimiter auto-detected. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field.trim());
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field.trim());
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

export type ColumnMap = { date: number; description: number; amount: number; debit: number; credit: number };

const find = (header: string[], patterns: RegExp[]) => {
  for (const re of patterns) {
    const i = header.findIndex((h) => re.test(h));
    if (i >= 0) return i;
  }
  return -1;
};

/** Guess which columns hold what, from common bank/e-wallet export headers. */
export function detectColumns(header: string[]): ColumnMap {
  const h = header.map((x) => x.toLowerCase().trim());
  return {
    date: find(h, [/^(transaction\s*)?date$/, /tarikh/, /date/, /日期/]),
    description: find(h, [/description|details|particular|merchant|narration|keterangan|butiran|remark|transaction$/, /备注|摘要|说明/]),
    amount: find(h, [/^amount|jumlah|金额|^value/]),
    debit: find(h, [/debit|withdraw|money\s*out|paid\s*out|keluar|支出/]),
    credit: find(h, [/credit|deposit|money\s*in|paid\s*in|masuk|收入/]),
  };
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, ogo: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dis: 12,
};

/**
 * Parse a statement date to `YYYY-MM-DD`. Numeric dates default to day-first
 * (Malaysian banks) unless `monthFirst` is set.
 */
export function parseStatementDate(raw: string, monthFirst = false): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let r = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (r) [y, m, d] = [+r[1], +r[2], +r[3]];
  else if ((r = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s))) {
    [d, m, y] = monthFirst ? [+r[2], +r[1], +r[3]] : [+r[1], +r[2], +r[3]];
  } else if ((r = /^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-,]+(\d{2,4})/.exec(s)) && MONTHS[r[2].toLowerCase()]) {
    [d, m, y] = [+r[1], MONTHS[r[2].toLowerCase()], +r[3]];
  } else return null;
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "RM1,234.50", "-12.30", "(45.00)", "12.30 DR" → signed number (negative = money out). */
export function parseAmount(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const negative = /^-|^\(|\bdr\b|-$/i.test(s);
  const digits = s.replace(/[^\d.,]/g, "");
  if (!digits) return null;
  // "1.234,50" (EU) vs "1,234.50": the last separator is the decimal point.
  const lastSep = Math.max(digits.lastIndexOf("."), digits.lastIndexOf(","));
  const normalised =
    lastSep >= 0 && digits.length - lastSep - 1 <= 2
      ? digits.slice(0, lastSep).replace(/[.,]/g, "") + "." + digits.slice(lastSep + 1)
      : digits.replace(/[.,]/g, "");
  const n = Number(normalised);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Strip bank noise from a description: "POS DEBIT 123456 AEON BIG KL" → "Aeon Big Kl". */
export function cleanDescription(raw: string) {
  const s = raw
    .replace(/\b(pos|debit card|card purchase|purchase|debit|credit|payment to|duitnow( transfer)?|fpx|ibg|ibft|instant transfer|online|sale|trx|txn|ref(erence)?)\b[:#]?/gi, " ")
    .replace(/\b\d{4,}\b/g, " ")
    .replace(/[*#|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const titled = /[a-z]/.test(s) ? s : s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  return (titled || raw.trim()).slice(0, 60);
}

export type ImportRow = {
  /** Stable key so re-importing the same statement never duplicates. */
  key: string;
  date: string;
  description: string;
  merchant: string;
  amount: number;
  category: Category;
  paymentMethod: ReceiptDraft["paymentMethod"] | null;
};

/**
 * Turn statement rows into spending rows. With separate debit/credit columns,
 * debits are spending; with a single signed amount, negatives are spending
 * (or every row when `allPositiveIsSpending` and nothing is negative).
 */
export function statementToRows(rows: string[][], map: ColumnMap, monthFirst = false): ImportRow[] {
  const body = rows.slice(1);
  const signed = body.map((r) => (map.amount >= 0 ? parseAmount(r[map.amount] ?? "") : null));
  const anyNegative = signed.some((n) => n !== null && n < 0);
  const out: ImportRow[] = [];
  const seen = new Map<string, number>();

  body.forEach((r, i) => {
    const date = map.date >= 0 ? parseStatementDate(r[map.date] ?? "", monthFirst) : null;
    if (!date) return;
    let spent: number | null = null;
    if (map.debit >= 0 && (r[map.debit] ?? "").trim()) spent = Math.abs(parseAmount(r[map.debit]) ?? 0);
    else if (map.debit < 0 && signed[i] !== null) {
      const n = signed[i]!;
      spent = anyNegative ? (n < 0 ? -n : null) : n;
    }
    if (!spent || spent <= 0) return;
    const description = (map.description >= 0 ? r[map.description] : "") ?? "";
    const merchant = cleanDescription(description || "Expense");
    // Identical lines on the same day (two coffees) get a running suffix.
    const base = `${date}|${description.trim().toLowerCase()}|${spent.toFixed(2)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    out.push({
      key: `${base}|${n}`,
      date,
      description,
      merchant,
      amount: Math.round(spent * 100) / 100,
      category: guessCategory(description) ?? "General",
      paymentMethod: guessPayment(description)?.method ?? null,
    });
  });
  return out;
}

/** Deterministic receipt id for an imported row (same file → same ids). */
export async function importId(key: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`import:${key}`)));
  const b = digest.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

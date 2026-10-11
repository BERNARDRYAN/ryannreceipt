"use client";

import type { HistoryEntry } from "@/lib/history/entries";
import { formatAmount } from "@/lib/utils/currency";
import type { Currency } from "@/lib/validators/receipt-schema";

export type ReportLabels = {
  title: string;
  subtitle: string;
  total: string;
  receipts: string;
  byCategory: string;
  byWallet: string;
  list: string;
  generated: string;
  /** Display name for a category/relief key. */
  group: (key: string) => string;
  noWallet: string;
};

type Doc = InstanceType<typeof import("jspdf").jsPDF>;

const sumBy = (entries: HistoryEntry[], key: (e: HistoryEntry) => string) => {
  const m = new Map<string, number>();
  for (const e of entries) m.set(key(e), (m.get(key(e)) ?? 0) + e.spent);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

/**
 * A plain, printable A4 report drawn with jsPDF (already used for receipt
 * PDFs), so no extra libraries. Latin text only: jsPDF's built-in fonts have
 * no CJK glyphs, so non-Latin merchant names are transliterated as "?".
 */
async function buildReport(
  entries: HistoryEntry[],
  currency: Currency,
  labels: ReportLabels,
  groupBy: (e: HistoryEntry) => string,
): Promise<Doc> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ascii = (s: string) => s.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?");
  const money = (n: number) => `${currency} ${formatAmount(n, currency)}`;
  let y = 20;
  const line = (text: string, x = 18, size = 10, bold = false) => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("courier", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(ascii(text), x, y);
  };
  const row = (left: string, right: string, bold = false) => {
    line(left, 18, 10, bold);
    doc.text(ascii(right), 192, y, { align: "right" });
    y += 6;
  };

  line(labels.title, 18, 18, true);
  y += 7;
  line(labels.subtitle, 18, 11);
  y += 10;
  const total = entries.reduce((s, e) => s + e.spent, 0);
  row(labels.total, money(total), true);
  row(labels.receipts, String(entries.length));
  y += 4;

  line(labels.byCategory, 18, 12, true);
  y += 7;
  for (const [k, v] of sumBy(entries, groupBy)) row(`  ${labels.group(k)}`, money(v));
  y += 4;

  const wallets = sumBy(entries, (e) => e.wallet || labels.noWallet);
  if (wallets.length > 1 || wallets[0]?.[0] !== labels.noWallet) {
    line(labels.byWallet, 18, 12, true);
    y += 7;
    for (const [k, v] of wallets) row(`  ${k}`, money(v));
    y += 4;
  }

  line(labels.list, 18, 12, true);
  y += 7;
  for (const e of [...entries].sort((a, b) => a.receiptDate.localeCompare(b.receiptDate))) {
    row(`  ${e.receiptDate.slice(0, 10)}  ${e.merchantName.slice(0, 34)}`, money(e.spent));
  }

  y += 6;
  line(labels.generated, 18, 8);
  return doc;
}

export async function downloadMonthlyReport(
  entries: HistoryEntry[],
  currency: Currency,
  labels: ReportLabels,
  filename: string,
) {
  const doc = await buildReport(entries, currency, labels, (e) => e.category);
  doc.save(filename);
}

export async function downloadTaxReport(
  entries: HistoryEntry[],
  currency: Currency,
  labels: ReportLabels,
  filename: string,
) {
  const doc = await buildReport(
    entries.filter((e) => e.taxRelief),
    currency,
    labels,
    (e) => e.taxRelief,
  );
  doc.save(filename);
}

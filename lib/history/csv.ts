import type { HistoryEntry } from "@/lib/history/entries";

const HEADER = ["Date", "Time", "Merchant", "Receipt no.", "Category", "Currency", "Total", "Warranty until"];

/**
 * Quote a CSV cell, and neutralise spreadsheet formulas (cells starting with
 * = + - @ or a tab/CR are prefixed with ') so opening the file can't run them.
 */
export function csvCell(value: string | number) {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function entriesToCsv(entries: HistoryEntry[]) {
  const rows = entries.map((e) => [
    e.receiptDate.slice(0, 10),
    e.receiptDate.slice(11, 16),
    e.merchantName,
    e.receiptNo,
    e.category,
    e.currency,
    e.total.toFixed(2),
    e.warrantyUntil,
  ]);
  // BOM so Excel opens UTF-8 (e.g. Chinese merchant names) correctly.
  return "﻿" + [HEADER, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

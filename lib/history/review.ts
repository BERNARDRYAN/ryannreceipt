import type { HistoryEntry } from "@/lib/history/entries";

export type YearReview = {
  year: string;
  total: number;
  count: number;
  /** Spending per month, January first. */
  months: number[];
  /** Total divided by the months that have passed (all 12 for past years). */
  monthlyAvg: number;
  biggestMonth: { index: number; total: number } | null;
  /** 0 = Sunday, by number of receipts. */
  busiestWeekday: { day: number; count: number } | null;
  topCategories: { key: string; total: number }[];
  topShops: { name: string; total: number; count: number }[];
  biggestReceipt: { name: string; total: number; date: string } | null;
  /** Previous year's total, for "vs last year" (null when there was none). */
  previousTotal: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A year's spending in one summary. Entries must already be in one currency;
 * amounts use `spent` (my share of split bills).
 */
export function yearReview(entries: HistoryEntry[], year: string, today: string): YearReview {
  const inYear = entries.filter((e) => e.receiptDate.startsWith(year) && e.spent > 0);
  const months = Array<number>(12).fill(0);
  const weekdays = Array<number>(7).fill(0);
  const cats = new Map<string, number>();
  const shops = new Map<string, { name: string; total: number; count: number }>();
  let biggestReceipt: YearReview["biggestReceipt"] = null;

  for (const e of inYear) {
    const [y, m, d] = e.receiptDate.slice(0, 10).split("-").map(Number);
    months[m - 1] += e.spent;
    weekdays[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]++;
    cats.set(e.category, (cats.get(e.category) ?? 0) + e.spent);
    const name = (e.merchantName || e.title).trim();
    if (name) {
      const key = name.toLowerCase();
      const s = shops.get(key) ?? { name, total: 0, count: 0 };
      shops.set(key, { name: s.name, total: s.total + e.spent, count: s.count + 1 });
    }
    if (!biggestReceipt || e.spent > biggestReceipt.total) {
      biggestReceipt = { name: name || "—", total: e.spent, date: e.receiptDate.slice(0, 10) };
    }
  }

  const total = round2(months.reduce((s, n) => s + n, 0));
  const elapsed = year < today.slice(0, 4) ? 12 : year === today.slice(0, 4) ? Number(today.slice(5, 7)) : 1;
  const bigIndex = months.reduce((best, n, i) => (n > months[best] ? i : best), 0);
  const busyDay = weekdays.reduce((best, n, i) => (n > weekdays[best] ? i : best), 0);
  const prev = String(Number(year) - 1);
  const prevEntries = entries.filter((e) => e.receiptDate.startsWith(prev));

  return {
    year,
    total,
    count: inYear.length,
    months: months.map(round2),
    monthlyAvg: round2(total / Math.max(1, elapsed)),
    biggestMonth: total > 0 ? { index: bigIndex, total: round2(months[bigIndex]) } : null,
    busiestWeekday: inYear.length ? { day: busyDay, count: weekdays[busyDay] } : null,
    topCategories: [...cats]
      .map(([key, t]) => ({ key, total: round2(t) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3),
    topShops: [...shops.values()]
      .map((s) => ({ ...s, total: round2(s.total) }))
      .sort((a, b) => b.count - a.count || b.total - a.total)
      .slice(0, 3),
    biggestReceipt: biggestReceipt && { ...biggestReceipt, total: round2(biggestReceipt.total) },
    previousTotal: prevEntries.length ? round2(prevEntries.reduce((s, e) => s + e.spent, 0)) : null,
  };
}

/** Years that have at least one receipt, newest first. */
export function reviewYears(entries: HistoryEntry[]) {
  return [...new Set(entries.map((e) => e.receiptDate.slice(0, 4)))].filter((y) => /^\d{4}$/.test(y)).sort().reverse();
}

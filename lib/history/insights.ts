import type { HistoryEntry } from "@/lib/history/entries";
import type { Category } from "@/lib/validators/receipt-schema";

export type Insight =
  | { kind: "month"; pct: number; direction: "up" | "down" }
  | { kind: "category"; category: Category; pct: number; direction: "up" | "down" }
  | { kind: "streak"; days: number };

const DAY = 86_400_000;
const keyOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * One short, true observation for the top of History, comparing this month so
 * far with the same days last month (1st → today's date), so a half-finished
 * month is never compared with a whole one. Entries must share one currency.
 */
export function pickInsight(entries: HistoryEntry[], today: string): Insight | null {
  const [y, m, d] = today.split("-").map(Number);
  const thisMonth = today.slice(0, 7);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  const prevMonth = keyOf(prev.getTime()).slice(0, 7);
  const prevDays = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  const prevCutoff = `${prevMonth}-${String(Math.min(d, prevDays)).padStart(2, "0")}`;

  const now: Partial<Record<Category, number>> = {};
  const before: Partial<Record<Category, number>> = {};
  let nowTotal = 0;
  let beforeTotal = 0;
  for (const e of entries) {
    const day = e.receiptDate.slice(0, 10);
    if (day.startsWith(thisMonth) && day <= today) {
      now[e.category] = (now[e.category] ?? 0) + e.spent;
      nowTotal += e.spent;
    } else if (day.startsWith(prevMonth) && day <= prevCutoff) {
      before[e.category] = (before[e.category] ?? 0) + e.spent;
      beforeTotal += e.spent;
    }
  }

  // A logging streak is encouraging, and works from day one.
  const days = new Set(entries.map((e) => e.receiptDate.slice(0, 10)));
  let streak = 0;
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  while (days.has(keyOf(todayMs - streak * DAY))) streak++;

  if (beforeTotal >= 20 && nowTotal > 0) {
    // Category with the biggest change in money terms, if it's meaningful.
    let best: { category: Category; diff: number; pct: number } | null = null;
    for (const c of new Set([...Object.keys(now), ...Object.keys(before)]) as Set<Category>) {
      const a = now[c] ?? 0;
      const b = before[c] ?? 0;
      if (b < 10) continue;
      const diff = a - b;
      if (!best || Math.abs(diff) > Math.abs(best.diff)) best = { category: c, diff, pct: Math.round((Math.abs(diff) / b) * 100) };
    }
    const monthPct = Math.round((Math.abs(nowTotal - beforeTotal) / beforeTotal) * 100);
    if (best && best.pct >= 15 && Math.abs(best.diff) >= Math.abs(nowTotal - beforeTotal) * 0.6) {
      return { kind: "category", category: best.category, pct: best.pct, direction: best.diff > 0 ? "up" : "down" };
    }
    if (monthPct >= 5) return { kind: "month", pct: monthPct, direction: nowTotal > beforeTotal ? "up" : "down" };
  }
  if (streak >= 3) return { kind: "streak", days: streak };
  return null;
}

import type { HistoryEntry } from "@/lib/history/entries";
import { normalizeName } from "@/lib/memory/merchants";
import type { Currency, ReceiptDraft, RecurringRule } from "@/lib/validators/receipt-schema";

export type RepeatSuggestion = {
  /** Stable key (normalised name + currency), used to dismiss it. */
  key: string;
  name: string;
  /** Typical amount (the median of the matched months). */
  amount: number;
  currency: Currency;
  category: HistoryEntry["category"];
  paymentMethod: ReceiptDraft["paymentMethod"];
  wallet: string;
  /** Day of month it usually lands on (1–28, as rules require). */
  day: number;
  /** The most recent occurrence; a rule should start after it. */
  lastDate: string;
};

const monthKey = (date: string) => date.slice(0, 7);
const prevMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Bills that look monthly: the same shop exactly once a month for at least two
 * months in a row (within the last three), with amounts within ±20% of each
 * other. Things already covered by a recurring rule, logged by one, or
 * dismissed are skipped. Biggest first, at most three.
 */
export function detectRepeats(
  entries: HistoryEntry[],
  rules: RecurringRule[],
  today: string,
  dismissed: string[] = [],
): RepeatSuggestion[] {
  const ruled = new Set(rules.map((r) => `${normalizeName(r.name)}|${r.currency}`));
  const skip = new Set(dismissed);
  const recentMonths = [monthKey(today), prevMonth(monthKey(today)), prevMonth(prevMonth(monthKey(today)))];

  const groups = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const name = normalizeName(e.merchantName);
    if (!name || e.tags.includes("recurring") || !recentMonths.includes(monthKey(e.receiptDate))) continue;
    const key = `${name}|${e.currency}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  const out: RepeatSuggestion[] = [];
  for (const [key, list] of groups) {
    if (ruled.has(key) || skip.has(key)) continue;
    const byMonth = new Map<string, HistoryEntry[]>();
    for (const e of list) byMonth.set(monthKey(e.receiptDate), [...(byMonth.get(monthKey(e.receiptDate)) ?? []), e]);
    // Bills come once a month; several visits a month is a habit, not a bill.
    if ([...byMonth.values()].some((xs) => xs.length > 1)) continue;
    const months = recentMonths.filter((m) => byMonth.has(m));
    const consecutive = months.some((m) => byMonth.has(prevMonth(m)));
    if (months.length < 2 || !consecutive) continue;

    const matched = months.map((m) => byMonth.get(m)![0]);
    const typical = median(matched.map((e) => e.spent));
    if (typical <= 0 || matched.some((e) => Math.abs(e.spent - typical) > typical * 0.2)) continue;

    const latest = [...matched].sort((a, b) => b.receiptDate.localeCompare(a.receiptDate))[0];
    out.push({
      key,
      name: latest.merchantName.trim(),
      amount: Math.round(typical * 100) / 100,
      currency: latest.currency,
      category: latest.category,
      paymentMethod: latest.paymentMethod as ReceiptDraft["paymentMethod"],
      wallet: latest.wallet,
      day: Math.min(28, Number(latest.receiptDate.slice(8, 10))),
      lastDate: latest.receiptDate.slice(0, 10),
    });
  }
  return out.sort((a, b) => b.amount - a.amount).slice(0, 3);
}

/** The recurring rule a suggestion turns into; it starts after the last bill. */
export function ruleFromSuggestion(s: RepeatSuggestion, id: string): RecurringRule {
  const start = new Date(Date.parse(`${s.lastDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return {
    id,
    name: s.name.slice(0, 60),
    amount: s.amount,
    currency: s.currency,
    category: s.category,
    paymentMethod: s.paymentMethod,
    wallet: s.wallet.slice(0, 30),
    frequency: "monthly",
    day: s.day,
    startDate: start,
    active: true,
    lastRun: "",
  };
}

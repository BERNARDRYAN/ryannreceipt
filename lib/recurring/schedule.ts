import { createBlankDraft } from "@/lib/receipts/defaults";
import type { ReceiptDraft, RecurringRule } from "@/lib/validators/receipt-schema";

const DAY_MS = 86_400_000;
/** Never back-fill more than this many occurrences in one go. */
export const MAX_BACKFILL = 24;

const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const parse = (key: string) => Date.parse(`${key}T00:00:00Z`);

/**
 * Dates (YYYY-MM-DD) on which `rule` is due, after its last run and up to and
 * including `today`. Monthly rules use day 1–28 so every month has the date.
 */
export function dueDates(rule: RecurringRule, today: string): string[] {
  if (!rule.active) return [];
  const start = rule.lastRun ? parse(rule.lastRun) + DAY_MS : parse(rule.startDate);
  const end = parse(today);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return [];

  const dates: string[] = [];
  // Walk at most ~2 years of days; cheap and avoids month-length edge cases.
  for (let t = Math.max(start, end - 730 * DAY_MS); t <= end; t += DAY_MS) {
    const d = new Date(t);
    const matches = rule.frequency === "monthly" ? d.getUTCDate() === rule.day : d.getUTCDay() === rule.day;
    if (matches) dates.push(toKey(t));
  }
  return dates.slice(-MAX_BACKFILL);
}

/**
 * Stable receipt id for one occurrence of a rule, so two devices generating the
 * same rent payment produce the same row instead of a duplicate.
 */
export async function occurrenceId(ruleId: string, date: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ruleId}:${date}`)));
  const b = digest.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4 layout
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function draftForOccurrence(rule: RecurringRule, date: string): ReceiptDraft {
  return {
    ...createBlankDraft(),
    title: "Receipt",
    merchantName: rule.name,
    receiptDate: `${date}T09:00`,
    currency: rule.currency,
    category: rule.category,
    paymentMethod: rule.paymentMethod,
    wallet: rule.wallet,
    roundCash: false,
    notes: "",
    tags: ["recurring"],
    items: [{ id: crypto.randomUUID(), name: rule.name, qty: 1, price: rule.amount }],
  };
}

/** Next date the rule will run after `today` (for display). */
export function nextDueDate(rule: RecurringRule, today: string): string {
  const base = Math.max(parse(today) + DAY_MS, parse(rule.startDate));
  for (let t = base; t < base + 40 * DAY_MS; t += DAY_MS) {
    const d = new Date(t);
    if (rule.frequency === "monthly" ? d.getUTCDate() === rule.day : d.getUTCDay() === rule.day) return toKey(t);
  }
  return today;
}

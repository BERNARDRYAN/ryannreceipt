import type { LocalReceipt } from "@/lib/store/receipt-store";
import { isDirty } from "@/lib/store/receipt-store";
import type { CloudSummary } from "@/lib/sync/cloud";
import { computeTotals } from "@/lib/utils/currency";
import type { Category, Currency, TaxRelief } from "@/lib/validators/receipt-schema";

/** One row in History, whether it lives on this device, in the cloud, or both. */
export type HistoryEntry = {
  id: string;
  title: string;
  merchantName: string;
  receiptNo: string;
  /** Wall-clock `YYYY-MM-DDTHH:mm`. */
  receiptDate: string;
  currency: Currency;
  total: number;
  category: Category;
  warrantyUntil: string;
  isPinned: boolean;
  paymentMethod: string;
  wallet: string;
  tags: string[];
  taxRelief: TaxRelief;
  /** False when the latest version exists only on this device. */
  synced: boolean;
  local: boolean;
};

export function fromLocal(r: LocalReceipt): HistoryEntry {
  const d = r.draft;
  return {
    id: r.id,
    title: d.title,
    merchantName: d.merchantName,
    receiptNo: d.receiptNo,
    receiptDate: d.receiptDate,
    currency: d.currency,
    total: computeTotals(d).payable,
    category: d.category,
    warrantyUntil: d.warrantyUntil,
    isPinned: r.isPinned,
    paymentMethod: d.paymentMethod,
    wallet: d.wallet,
    tags: d.tags,
    taxRelief: d.taxRelief,
    synced: !isDirty(r),
    local: true,
  };
}

/**
 * Signed-in view: the cloud list, overlaid with any local versions that have
 * unsynced edits (local wins, flagged as not synced), plus local-only drafts.
 */
export function mergeEntries(cloud: CloudSummary[], local: LocalReceipt[]): HistoryEntry[] {
  const byId = new Map<string, HistoryEntry>();
  const localIds = new Set(local.map((r) => r.id));
  for (const c of cloud) byId.set(c.id, { ...c, synced: true, local: localIds.has(c.id) });
  for (const r of local) if (isDirty(r)) byId.set(r.id, fromLocal(r));
  return [...byId.values()];
}

export function sortEntries(entries: HistoryEntry[]) {
  return [...entries].sort(
    (a, b) => Number(b.isPinned) - Number(a.isPinned) || b.receiptDate.localeCompare(a.receiptDate),
  );
}

export const monthKey = (date: string) => date.slice(0, 7);

/** "Oct" / "Oct 2026" (or 10月 / 2026年10月, Okt 2026) for a `YYYY-MM` key. */
export function monthLabel(key: string, long = false, intlLocale = "en-MY") {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  const date = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat(intlLocale, {
    month: "short",
    ...(long && { year: "numeric" }),
    timeZone: "UTC",
  }).format(date);
}

/** The `count` months ending at `endKey` (inclusive), oldest first. */
export function lastMonths(endKey: string, count: number) {
  const [y, m] = endKey.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export function sumBy<T>(items: T[], key: (t: T) => string, value: (t: T) => number) {
  const out = new Map<string, number>();
  for (const it of items) out.set(key(it), (out.get(key(it)) ?? 0) + value(it));
  return out;
}

/** Most common currency, so charts never add MYR to USD. */
export function dominantCurrency(entries: HistoryEntry[]): Currency | null {
  const counts = sumBy(entries, (e) => e.currency, () => 1);
  let best: Currency | null = null;
  let bestCount = 0;
  for (const [c, n] of counts) if (n > bestCount) [best, bestCount] = [c as Currency, n];
  return best;
}

export type WarrantyState = { kind: "expired" | "soon" | "active"; daysLeft: number };

const DAY_MS = 86_400_000;
export const SOON_DAYS = 30;

export function warrantyState(warrantyUntil: string, todayKey: string): WarrantyState {
  const days = Math.round((Date.parse(`${warrantyUntil}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / DAY_MS);
  if (days < 0) return { kind: "expired", daysLeft: days };
  if (days <= SOON_DAYS) return { kind: "soon", daysLeft: days };
  return { kind: "active", daysLeft: days };
}

/** Local calendar date `YYYY-MM-DD` (receipts and warranties are wall-clock). */
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

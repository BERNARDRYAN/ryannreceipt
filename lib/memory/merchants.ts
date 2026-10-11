import type { LocalReceipt } from "@/lib/store/receipt-store";
import type { CloudSummary } from "@/lib/sync/cloud";
import type { Category, ReceiptDraft } from "@/lib/validators/receipt-schema";

/** What we remember about a shop from past receipts, used to auto-fill. */
export type MerchantMemory = {
  name: string;
  address: string;
  phone: string;
  category: Category;
  paymentMethod: ReceiptDraft["paymentMethod"];
  wallet: string;
  taxRate: number;
  taxLabel: ReceiptDraft["taxLabel"];
  taxInclusive: boolean;
  serviceChargeRate: number;
  tags: string[];
  /** Distinct items bought here, most recent first, with their last price. */
  items: { name: string; price: number }[];
  visits: number;
  lastUsed: string;
};

export const normalizeName = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Index past receipts by shop. Local receipts carry full detail (address,
 * items); cloud summaries add shops only seen on other devices.
 */
export function buildMerchantMemory(local: LocalReceipt[], cloud: CloudSummary[] = []) {
  const memory = new Map<string, MerchantMemory>();
  const sorted = [...local].sort((a, b) => b.draft.receiptDate.localeCompare(a.draft.receiptDate));

  for (const r of sorted) {
    const d = r.draft;
    const key = normalizeName(d.merchantName);
    if (!key) continue;
    const existing = memory.get(key);
    if (existing) {
      existing.visits += 1;
      for (const item of d.items) {
        if (item.name.trim() && !existing.items.some((i) => normalizeName(i.name) === normalizeName(item.name))) {
          existing.items.push({ name: item.name.trim(), price: item.price });
        }
      }
      continue;
    }
    memory.set(key, {
      name: d.merchantName.trim(),
      address: d.merchantAddress,
      phone: d.merchantPhone,
      category: d.category,
      paymentMethod: d.paymentMethod,
      wallet: d.wallet,
      taxRate: d.taxRate,
      taxLabel: d.taxLabel,
      taxInclusive: d.taxInclusive,
      serviceChargeRate: d.serviceChargeRate,
      tags: d.tags.filter((t) => t !== "recurring"),
      items: d.items.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), price: i.price })),
      visits: 1,
      lastUsed: d.receiptDate,
    });
  }

  for (const c of cloud) {
    const key = normalizeName(c.merchantName);
    if (!key) continue;
    const existing = memory.get(key);
    if (existing) {
      existing.visits += 1;
      continue;
    }
    memory.set(key, {
      name: c.merchantName.trim(),
      address: "",
      phone: "",
      category: c.category,
      paymentMethod: c.paymentMethod as ReceiptDraft["paymentMethod"],
      wallet: c.wallet,
      taxRate: 0,
      taxLabel: "SST",
      taxInclusive: false,
      serviceChargeRate: 0,
      tags: c.tags.filter((t) => t !== "recurring"),
      items: [],
      visits: 1,
      lastUsed: c.receiptDate,
    });
  }
  return memory;
}

/** Shops matching what's typed: prefix matches first, then most visited. */
export function suggestMerchants(memory: Map<string, MerchantMemory>, query: string, limit = 5) {
  const q = normalizeName(query);
  if (!q) return [];
  return [...memory.entries()]
    .filter(([key]) => key.includes(q) && key !== q)
    .sort(([a, ma], [b, mb]) => Number(b.startsWith(q)) - Number(a.startsWith(q)) || mb.visits - ma.visits)
    .slice(0, limit)
    .map(([, m]) => m);
}

/** Every distinct item name with its most recent price, for item autocomplete. */
export function buildItemMemory(local: LocalReceipt[]) {
  const items = new Map<string, { name: string; price: number; at: string }>();
  for (const r of local) {
    for (const item of r.draft.items) {
      const key = normalizeName(item.name);
      if (!key || item.price <= 0) continue;
      const prev = items.get(key);
      if (!prev || r.draft.receiptDate > prev.at) items.set(key, { name: item.name.trim(), price: item.price, at: r.draft.receiptDate });
    }
  }
  return items;
}

/** All wallets and tags used so far (for suggestions), most used first. */
export function usedValues(local: LocalReceipt[], cloud: CloudSummary[] = []) {
  const wallets = new Map<string, number>();
  const tags = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => k && m.set(k, (m.get(k) ?? 0) + 1);
  for (const r of local) {
    bump(wallets, r.draft.wallet);
    r.draft.tags.forEach((t) => bump(tags, t));
  }
  for (const c of cloud) {
    bump(wallets, c.wallet);
    c.tags.forEach((t) => bump(tags, t));
  }
  const ranked = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return { wallets: ranked(wallets), tags: ranked(tags) };
}

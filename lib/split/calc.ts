import { computeTotals, lineTotal } from "@/lib/utils/currency";
import { ME, type ReceiptDraft, type ReceiptLineItem, type Split } from "@/lib/validators/receipt-schema";

export type PersonShare = {
  id: string;
  name: string;
  /** This person's portion of each line they had. */
  items: ReceiptLineItem[];
  subtotal: number;
  discount: number;
  serviceCharge: number;
  taxAmount: number;
  /** What this person owes for the bill (the payer's share absorbs rounding). */
  total: number;
  isPayer: boolean;
  /** Paid the payer back (always true for the payer). */
  paid: boolean;
  paidAt: string;
};

export type SplitResult = {
  people: PersonShare[];
  /** Lines nobody has been assigned to yet (counted on the payer). */
  unassigned: ReceiptLineItem[];
  /** Total still owed to the payer by others. */
  outstanding: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** A fresh split: me plus the people given, paid by me, nothing assigned. */
export function newSplit(meName: string, others: { id: string; name: string }[] = []): Split {
  return {
    people: [{ id: ME, name: meName }, ...others],
    payerId: ME,
    shares: {},
    paid: {},
  };
}

/** Everyone shares every line equally. */
export function splitEqually(draft: ReceiptDraft, split: Split): Split {
  const shares: Split["shares"] = {};
  for (const item of draft.items) {
    shares[item.id] = Object.fromEntries(split.people.map((p) => [p.id, 1]));
  }
  return { ...split, shares };
}

/**
 * Each person's portion of each line. When the units handed out equal the
 * line's quantity (2 × teh tarik → 1 each), people get whole units at the unit
 * price; otherwise the line is shared proportionally ("Fried rice ÷3").
 */
function portions(draft: ReceiptDraft, split: Split) {
  const byPerson = new Map<string, ReceiptLineItem[]>(split.people.map((p) => [p.id, []]));
  const unassigned: ReceiptLineItem[] = [];
  for (const item of draft.items) {
    if (!item.name.trim() && item.price <= 0) continue;
    const shares = split.shares[item.id] ?? {};
    const entries = Object.entries(shares).filter(([id, units]) => units > 0 && byPerson.has(id));
    const totalUnits = entries.reduce((s, [, u]) => s + u, 0);
    if (totalUnits === 0) {
      unassigned.push(item);
      continue;
    }
    const whole = totalUnits === item.qty;
    const line = lineTotal(item, draft.currency);
    for (const [id, units] of entries) {
      byPerson.get(id)!.push(
        whole
          ? { ...item, qty: units }
          : {
              ...item,
              name: entries.length > 1 ? `${item.name} (${units}/${totalUnits})` : item.name,
              qty: 1,
              price: round2((line * units) / totalUnits),
            },
      );
    }
  }
  return { byPerson, unassigned };
}

/**
 * Work out what everyone owes. Each person's share runs through the same
 * totals as the receipt (discount pro-rata, service charge, then tax), so the
 * maths matches what they see on their share image. Whatever cents are left
 * over from rounding, plus anything unassigned, sit with the payer, so the
 * shares always add up to the bill exactly.
 */
export function computeSplit(draft: ReceiptDraft, split: Split): SplitResult {
  const bill = computeTotals(draft);
  const { byPerson, unassigned } = portions(draft, split);
  const payerId = split.people.some((p) => p.id === split.payerId) ? split.payerId : split.people[0].id;

  const people: PersonShare[] = split.people.map((p) => {
    const items = byPerson.get(p.id) ?? [];
    const base = items.reduce((s, i) => s + lineTotal(i, draft.currency), 0);
    const discount = bill.subtotal > 0 ? round2((bill.discount * base) / bill.subtotal) : 0;
    const t = computeTotals({
      ...draft,
      items,
      discountAmount: discount,
      // Shares are settled by transfer; no cash rounding per person.
      roundCash: false,
      amountTendered: 0,
    });
    const paidAt = split.paid[p.id] ?? "";
    return {
      id: p.id,
      name: p.name,
      items,
      subtotal: t.subtotal,
      discount: t.discount,
      serviceCharge: t.serviceCharge,
      taxAmount: t.taxAmount,
      total: t.total,
      isPayer: p.id === payerId,
      paid: p.id === payerId || !!paidAt,
      paidAt,
    };
  });

  // The payer absorbs rounding and anything not yet assigned.
  const others = people.filter((p) => !p.isPayer).reduce((s, p) => s + p.total, 0);
  const payer = people.find((p) => p.isPayer)!;
  payer.total = round2(bill.payable - others);

  const outstanding = round2(people.filter((p) => !p.paid).reduce((s, p) => s + p.total, 0));
  return { people, unassigned, outstanding };
}

/** A receipt-shaped draft of one person's share (for their image). */
export function shareDraft(draft: ReceiptDraft, share: PersonShare, title: string, note: string): ReceiptDraft {
  return {
    ...draft,
    title,
    items: share.items,
    discountAmount: share.discount,
    roundCash: false,
    amountTendered: 0,
    paymentMethod: draft.paymentMethod,
    notes: note,
    warrantyUntil: "",
    split: null,
    styleConfig: { ...draft.styleConfig, showQr: false, showBarcode: false },
  };
}

/** Compact summary stored with the receipt for lists and balances. */
export function splitSummary(draft: ReceiptDraft) {
  if (!draft.split) return null;
  const result = computeSplit(draft, draft.split);
  return {
    payerId: result.people.find((p) => p.isPayer)?.id ?? ME,
    people: result.people.map((p) => ({ id: p.id, name: p.name, total: p.total, paid: p.paid, paidAt: p.paidAt })),
  };
}

export type SplitSummary = NonNullable<ReturnType<typeof splitSummary>>;

/** What counts as *my* spending: my share if I'm in the split, else the whole bill. */
export function myShareOf(draft: ReceiptDraft): number {
  const total = computeTotals(draft).payable;
  if (!draft.split) return total;
  const me = splitSummary(draft)?.people.find((p) => p.id === ME);
  return me ? me.total : total;
}

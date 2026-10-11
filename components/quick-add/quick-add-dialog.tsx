"use client";

import { Camera, CornerDownLeft, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CATEGORY_ICONS } from "@/components/quick-add/category-icons";
import { inputClass, NumberInput } from "@/components/receipt/editor/fields";
import { Combobox } from "@/components/ui/combobox";
import { buttonStyles, Dialog } from "@/components/ui/dialog";
import { todayKey } from "@/lib/history/entries";
import { useT, type MessageKey } from "@/lib/i18n/messages";
import { buildMerchantMemory, normalizeName } from "@/lib/memory/merchants";
import { COMMON_WALLETS } from "@/lib/quick-add/keywords";
import { parseQuickAdd } from "@/lib/quick-add/parse";
import { createBlankDraft } from "@/lib/receipts/defaults";
import { useAuthStore } from "@/lib/store/auth-store";
import { useReceiptStore } from "@/lib/store/receipt-store";
import { toast } from "@/lib/store/toast-store";
import { useUiStore } from "@/lib/store/ui-store";
import { pushReceipts } from "@/lib/sync/cloud";
import { computeTotals, formatAmount } from "@/lib/utils/currency";
import {
  CATEGORIES,
  PAYMENT_METHODS,
  type Category,
  type Currency,
  type ReceiptDraft,
} from "@/lib/validators/receipt-schema";

type Fields = {
  amount: number;
  name: string;
  category: Category;
  paymentMethod: ReceiptDraft["paymentMethod"];
  wallet: string;
  date: string;
  tags: string[];
};

/** Field values chosen by hand stop following the free-text line. */
type Locks = Partial<Record<keyof Fields, true>>;

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Log an expense in one line ("nasi lemak 12.90 tng yesterday #work").
 * Everything is parsed live, filled from the shop's history, and editable.
 */
function QuickAddForm({ onDone }: { onDone: () => void }) {
  const t = useT();
  const router = useRouter();
  const receipts = useReceiptStore((s) => s.receipts);
  const addReceipts = useReceiptStore((s) => s.addReceipts);
  const openScan = useUiStore((s) => s.openScan);
  const [today] = useState(todayKey);
  const [text, setText] = useState("");
  const [manual, setManual] = useState<Partial<Fields>>({});
  const [locks, setLocks] = useState<Locks>({});

  const local = useMemo(() => Object.values(receipts), [receipts]);
  const memory = useMemo(() => buildMerchantMemory(local), [local]);
  const currency: Currency =
    [...local].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.draft.currency ?? "MYR";

  // One-tap repeats: recent single-item receipts, distinct by name + price.
  const recent = useMemo(() => {
    const seen = new Set<string>();
    return [...local]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((r) => r.draft.items.length === 1 && r.draft.items[0].price > 0)
      .map((r) => r.draft)
      .filter((d) => {
        const key = `${normalizeName(d.items[0].name)}|${d.items[0].price}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5);
  }, [local]);

  // Parsed line + what we know about the shop, overridden by hand-edited fields.
  const parsed = parseQuickAdd(text, today);
  const known = memory.get(normalizeName(parsed.name));
  const fields: Fields = {
    amount: locks.amount ? (manual.amount ?? 0) : (parsed.amount ?? 0),
    name: locks.name ? (manual.name ?? "") : (known?.name ?? parsed.name),
    category: locks.category ? manual.category! : (parsed.category ?? known?.category ?? "General"),
    paymentMethod: locks.paymentMethod
      ? manual.paymentMethod!
      : (parsed.paymentMethod ?? known?.paymentMethod ?? "CASH"),
    wallet: locks.wallet ? (manual.wallet ?? "") : parsed.wallet || known?.wallet || "",
    date: locks.date ? (manual.date ?? today) : (parsed.date ?? today),
    tags: parsed.tags.length ? parsed.tags : (known?.tags ?? []),
  };

  function edit<K extends keyof Fields>(key: K, value: Fields[K]) {
    setManual((m) => ({ ...m, [key]: value }));
    setLocks((l) => ({ ...l, [key]: true }));
  }

  function save(source: Fields, open = false) {
    if (!(source.amount > 0) || !source.name.trim()) return;
    const shop = memory.get(normalizeName(source.name));
    const draft: ReceiptDraft = {
      ...createBlankDraft(),
      title: "Receipt",
      merchantName: source.name.trim().slice(0, 60),
      merchantAddress: shop?.address ?? "",
      merchantPhone: shop?.phone ?? "",
      receiptDate: `${source.date}T${source.date === today ? nowTime() : "12:00"}`,
      currency,
      category: source.category,
      paymentMethod: source.paymentMethod,
      wallet: source.wallet.slice(0, 30),
      tags: source.tags.slice(0, 10),
      // Keep the exact amount typed; no cash rounding on quick entries.
      roundCash: false,
      notes: "",
      items: [{ id: crypto.randomUUID(), name: source.name.trim().slice(0, 80), qty: 1, price: source.amount }],
    };
    const [id] = addReceipts([{ draft }]);
    if (!id) return;
    if (useAuthStore.getState().status === "signed-in") {
      const receipt = useReceiptStore.getState().receipts[id];
      if (receipt) void pushReceipts([receipt]).catch(() => undefined);
    }
    const amount = `${currency} ${formatAmount(computeTotals(draft).payable, currency)}`;
    toast(t("quick.added", { amount, category: t(`cat.${source.category}` as MessageKey) }), {
      tone: "success",
      action: { label: t("quick.open"), onClick: () => router.push(`/studio?id=${id}`) },
    });
    setText("");
    setManual({});
    setLocks({});
    if (open) router.push(`/studio?id=${id}`);
    onDone();
  }

  const canSave = fields.amount > 0 && !!fields.name.trim();
  const walletOptions = [...new Set([...local.map((r) => r.draft.wallet).filter(Boolean), ...COMMON_WALLETS])].map(
    (value) => ({ value }),
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(fields);
      }}
      className="space-y-4"
    >
      <div className="relative">
        <Zap className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-viz-accent" aria-hidden />
        <input
          autoFocus
          aria-label={t("quick.inputLabel")}
          placeholder={t("quick.placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          enterKeyHint="done"
          className={`${inputClass} py-3 pr-10 pl-10 text-base`}
        />
        <CornerDownLeft className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
      </div>

      {recent.length > 0 && !text && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-muted">{t("quick.again")}</p>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((d) => (
              <button
                key={`${d.items[0].name}-${d.items[0].price}`}
                type="button"
                onClick={() =>
                  save({
                    amount: d.items[0].price,
                    name: d.merchantName || d.items[0].name,
                    category: d.category,
                    paymentMethod: d.paymentMethod,
                    wallet: d.wallet,
                    date: today,
                    tags: d.tags.filter((tag) => tag !== "recurring"),
                  })
                }
                className="rounded-full px-3 py-1.5 text-xs ring-1 ring-border transition-colors hover:bg-surface-muted"
              >
                <span className="font-medium">{d.merchantName || d.items[0].name}</span>{" "}
                <span className="text-muted tabular-nums">{formatAmount(d.items[0].price, d.currency)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-[1fr_7.5rem] gap-3">
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">{t("quick.what")}</span>
          <input
            className={inputClass}
            value={fields.name}
            maxLength={60}
            onChange={(e) => edit("name", e.target.value)}
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">{t("quick.amount", { currency })}</span>
          <NumberInput
            value={fields.amount}
            decimals={2}
            max={1_000_000}
            onValueChange={(v) => edit("amount", v)}
            className="text-right font-semibold"
          />
        </label>
      </div>

      <div role="radiogroup" aria-label={t("field.category")} className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICONS[c];
          const active = fields.category === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => edit("category", c)}
              className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors ${
                active ? "bg-accent text-accent-contrast" : "text-muted ring-1 ring-border hover:text-foreground"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              <span className="line-clamp-1">{t(`cat.${c}` as MessageKey)}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">{t("field.paymentMethod")}</span>
          <select
            className={inputClass}
            value={fields.paymentMethod}
            onChange={(e) => edit("paymentMethod", e.target.value as Fields["paymentMethod"])}
          >
            {PAYMENT_METHODS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">{t("field.wallet")}</span>
          <Combobox
            className={inputClass}
            maxLength={30}
            value={fields.wallet}
            onChange={(v) => edit("wallet", v)}
            options={walletOptions}
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">{t("quick.date")}</span>
          <input
            type="date"
            className={inputClass}
            value={fields.date}
            max={today}
            onChange={(e) => e.target.value && edit("date", e.target.value)}
          />
        </label>
      </div>

      {fields.tags.length > 0 && (
        <p className="flex flex-wrap gap-1 text-xs text-muted">
          {fields.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-surface-muted px-2 py-0.5">
              #{tag}
            </span>
          ))}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <button type="button" onClick={() => openScan()} className={buttonStyles.ghost}>
          <Camera className="size-4" aria-hidden />
          {t("quick.scanInstead")}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => save(fields, true)}
            className={buttonStyles.secondary}
          >
            {t("quick.addAndEdit")}
          </button>
          <button type="submit" disabled={!canSave} className={buttonStyles.primary}>
            {t("quick.add")}
          </button>
        </div>
      </div>
    </form>
  );
}

export function QuickAddDialog() {
  const t = useT();
  const open = useUiStore((s) => s.quickAddOpen);
  const setOpen = useUiStore((s) => s.setQuickAddOpen);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t("quick.title")} description={t("quick.subtitle")}>
      {open && <QuickAddForm onDone={() => setOpen(false)} />}
    </Dialog>
  );
}

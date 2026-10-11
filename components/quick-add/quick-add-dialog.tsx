"use client";

import { Camera, ChevronDown, FileUp, PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { CATEGORY_ICONS } from "@/components/quick-add/category-icons";
import { inputClass } from "@/components/receipt/editor/fields";
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
  CURRENCIES,
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

/** "12.9" / "12,90" / "RM12.90" → 12.9; anything else → 0. */
function parseAmountText(text: string) {
  const n = Number(text.replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

/**
 * Amount first, then what it was for. The "what" box still understands a
 * whole note ("nasi lemak 12.90 tng yesterday #work"), shops are remembered,
 * and payment / wallet / date wait under "More" with sensible defaults.
 */
function QuickAddForm({ onDone }: { onDone: () => void }) {
  const t = useT();
  const router = useRouter();
  const receipts = useReceiptStore((s) => s.receipts);
  const addReceipts = useReceiptStore((s) => s.addReceipts);
  const ui = useUiStore.getState;
  const [today] = useState(todayKey);
  const [text, setText] = useState("");
  const [amountText, setAmountText] = useState("");
  const [manual, setManual] = useState<Partial<Fields>>({});
  const [locks, setLocks] = useState<Locks>({});
  const [more, setMore] = useState(false);
  const whatRef = useRef<HTMLInputElement>(null);

  const local = useMemo(() => Object.values(receipts), [receipts]);
  const memory = useMemo(() => buildMerchantMemory(local), [local]);
  const lastCurrency: Currency =
    [...local].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.draft.currency ?? "MYR";
  const [currencyChoice, setCurrencyChoice] = useState<Currency | null>(null);
  const currency = currencyChoice ?? lastCurrency;

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

  // Categories you use most come first.
  const categories = useMemo(() => {
    const count = new Map<Category, number>();
    for (const r of local) count.set(r.draft.category, (count.get(r.draft.category) ?? 0) + 1);
    return [...CATEGORIES].sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0));
  }, [local]);

  // Parsed note + what we know about the shop, overridden by hand-edited fields.
  const parsed = parseQuickAdd(text, today);
  const known = memory.get(normalizeName(parsed.name));
  const fields: Fields = {
    amount: locks.amount ? (manual.amount ?? 0) : (parsed.amount ?? 0),
    name: known?.name ?? parsed.name,
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
    // A tiny confirming tap on phones that support it.
    navigator.vibrate?.(10);
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
    setAmountText("");
    setManual({});
    setLocks({});
    if (open) router.push(`/studio?id=${id}`);
    onDone();
  }

  const canSave = fields.amount > 0 && !!fields.name.trim();
  const walletOptions = [...new Set([...local.map((r) => r.draft.wallet).filter(Boolean), ...COMMON_WALLETS])].map(
    (value) => ({ value }),
  );
  // Show the amount the note contains until the user types one themselves.
  const amountShown = locks.amount ? amountText : parsed.amount ? formatAmount(parsed.amount, currency) : "";
  const payLabel = (p: string) => t(`pm.${p}` as MessageKey);
  const summary = [
    payLabel(fields.paymentMethod),
    fields.wallet,
    fields.date === today ? t("list.today") : fields.date,
    ...fields.tags.map((tag) => `#${tag}`),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(fields);
      }}
      className="space-y-4"
    >
      {/* Amount: the one thing every expense needs. */}
      <div className="flex items-center justify-center gap-2 rounded-2xl bg-surface-muted px-4 py-3">
        <select
          aria-label={t("field.currency")}
          value={currency}
          onChange={(e) => setCurrencyChoice(e.target.value as Currency)}
          className="rounded-md border-0 bg-transparent p-1 text-sm font-semibold text-muted"
        >
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          autoFocus
          aria-label={t("quick.amountLabel")}
          inputMode="decimal"
          placeholder="0.00"
          value={amountShown}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d.,]/g, "").slice(0, 10);
            setAmountText(v);
            edit("amount", parseAmountText(v));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !canSave) {
              e.preventDefault();
              whatRef.current?.focus();
            }
          }}
          className="w-full min-w-0 bg-transparent text-center text-4xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-muted/40"
        />
      </div>

      <label className="block space-y-1.5">
        <span className="block text-xs font-medium text-muted">{t("quick.whatFor")}</span>
        <input
          ref={whatRef}
          aria-label={t("quick.inputLabel")}
          placeholder={t("quick.whatPh")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          enterKeyHint="done"
          maxLength={120}
          className={`${inputClass} py-2.5 text-base`}
        />
      </label>

      {recent.length > 0 && !text && !amountShown && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-muted">{t("quick.again")}</p>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
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
                className="shrink-0 rounded-full px-3 py-1.5 text-xs whitespace-nowrap ring-1 ring-border transition-colors hover:bg-surface-muted"
              >
                <span className="font-medium">{d.merchantName || d.items[0].name}</span>{" "}
                <span className="text-muted tabular-nums">{formatAmount(d.items[0].price, d.currency)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        role="radiogroup"
        aria-label={t("field.category")}
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
      >
        {categories.map((c) => {
          const Icon = CATEGORY_ICONS[c];
          const active = fields.category === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => edit("category", c)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                active ? "bg-accent text-accent-contrast" : "text-muted ring-1 ring-border hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" aria-hidden />
              {t(`cat.${c}` as MessageKey)}
            </button>
          );
        })}
      </div>

      {/* Payment, wallet and date: sensible defaults, one tap away. */}
      <div className="rounded-xl ring-1 ring-border">
        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore((m) => !m)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm"
        >
          <span className="min-w-0 truncate">
            <span className="text-muted">{t("quick.more")}: </span>
            {summary}
          </span>
          <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${more ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {more && (
          <div className="grid grid-cols-2 gap-3 border-t border-border p-3">
            <label className="space-y-1.5">
              <span className="block text-xs font-medium text-muted">{t("field.paymentMethod")}</span>
              <select
                className={inputClass}
                value={fields.paymentMethod}
                onChange={(e) => edit("paymentMethod", e.target.value as Fields["paymentMethod"])}
              >
                {PAYMENT_METHODS.map((p) => (
                  <option key={p} value={p}>
                    {payLabel(p)}
                  </option>
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
            <label className="col-span-2 space-y-1.5">
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
        )}
      </div>

      <button type="submit" disabled={!canSave} className={`${buttonStyles.primary} h-12 w-full rounded-xl text-base`}>
        {canSave
          ? t("quick.addAmount", { amount: `${currency} ${formatAmount(fields.amount, currency)}` })
          : t("quick.add")}
      </button>

      {/* Other ways to add, kept small. */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs">
        <button type="button" onClick={() => ui().openScan()} className="inline-flex items-center gap-1.5 py-1 text-muted hover:text-foreground">
          <Camera className="size-3.5" aria-hidden />
          {t("quick.scanInstead")}
        </button>
        <button
          type="button"
          onClick={() => {
            onDone();
            ui().setImportOpen(true);
          }}
          className="inline-flex items-center gap-1.5 py-1 text-muted hover:text-foreground"
        >
          <FileUp className="size-3.5" aria-hidden />
          {t("import.button")}
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => save(fields, true)}
          className="inline-flex items-center gap-1.5 py-1 text-muted hover:text-foreground disabled:opacity-40"
        >
          <PenLine className="size-3.5" aria-hidden />
          {t("quick.addAndEdit")}
        </button>
      </div>
    </form>
  );
}

export function QuickAddDialog() {
  const t = useT();
  const open = useUiStore((s) => s.quickAddOpen);
  const setOpen = useUiStore((s) => s.setQuickAddOpen);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t("quick.title")} sheet>
      {open && <QuickAddForm onDone={() => setOpen(false)} />}
    </Dialog>
  );
}

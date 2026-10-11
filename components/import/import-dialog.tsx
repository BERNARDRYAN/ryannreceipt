"use client";

import { FileUp, LoaderCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { inputClass, Toggle } from "@/components/receipt/editor/fields";
import { Combobox } from "@/components/ui/combobox";
import { buttonStyles, Dialog } from "@/components/ui/dialog";
import { useT, type MessageKey } from "@/lib/i18n/messages";
import { detectColumns, importId, parseCsv, statementToRows, type ColumnMap } from "@/lib/import/csv";
import { COMMON_WALLETS } from "@/lib/quick-add/keywords";
import { createBlankDraft } from "@/lib/receipts/defaults";
import { useAuthStore } from "@/lib/store/auth-store";
import { useReceiptStore } from "@/lib/store/receipt-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { toast } from "@/lib/store/toast-store";
import { useUiStore } from "@/lib/store/ui-store";
import { pushReceipts } from "@/lib/sync/cloud";
import { formatAmount } from "@/lib/utils/currency";
import { CATEGORIES, CURRENCIES, type Category, type Currency } from "@/lib/validators/receipt-schema";

const MAX_ROWS = 2000;

function Importer({ onDone }: { onDone: () => void }) {
  const t = useT();
  const addReceipts = useReceiptStore((s) => s.addReceipts);
  const home = useSettingsStore((s) => s.homeCurrency);
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState("");
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [monthFirst, setMonthFirst] = useState(false);
  const [currency, setCurrency] = useState<Currency>(home);
  const [wallet, setWallet] = useState("");
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => (rows && map ? statementToRows(rows, map, monthFirst) : []), [rows, map, monthFirst]);
  const chosen = parsed.filter((r) => !skipped.has(r.key));
  const total = chosen.reduce((s, r) => s + r.amount, 0);

  async function load(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast(t("import.tooBig"), { tone: "error" });
      return;
    }
    const all = parseCsv(await file.text()).slice(0, MAX_ROWS + 1);
    if (all.length < 2) {
      toast(t("import.empty"), { tone: "error" });
      return;
    }
    setFileName(file.name);
    setRows(all);
    setMap(detectColumns(all[0]));
    setSkipped(new Set());
    setCategories({});
  }

  async function run() {
    setBusy(true);
    try {
      const entries = await Promise.all(
        chosen.map(async (r) => ({
          id: await importId(r.key),
          draft: {
            ...createBlankDraft(),
            title: "Receipt",
            merchantName: r.merchant,
            receiptDate: `${r.date}T12:00`,
            currency,
            category: categories[r.key] ?? r.category,
            paymentMethod: r.paymentMethod ?? "CARD",
            wallet: wallet.slice(0, 30),
            roundCash: false,
            notes: r.description.slice(0, 280),
            tags: ["imported"],
            items: [{ id: crypto.randomUUID(), name: r.merchant.slice(0, 80), qty: 1, price: r.amount }],
          },
        })),
      );
      const added = addReceipts(entries);
      if (added.length && useAuthStore.getState().status === "signed-in") {
        const receipts = useReceiptStore.getState().receipts;
        await pushReceipts(added.map((id) => receipts[id]).filter(Boolean)).catch(() => undefined);
      }
      toast(t("import.done", { count: added.length, skipped: entries.length - added.length }), { tone: "success" });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  if (!rows || !map) {
    return (
      <div className="relative space-y-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void load(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 py-10 text-sm hover:border-foreground/40"
        >
          <FileUp className="size-6 text-muted" aria-hidden />
          <span className="font-medium">{t("import.choose")}</span>
          <span className="text-xs text-muted">{t("import.formats")}</span>
        </button>
        <p className="text-xs leading-relaxed text-muted">{t("import.privacy")}</p>
      </div>
    );
  }

  const header = rows[0];
  const columnSelect = (key: keyof ColumnMap, label: string) => (
    <label className="space-y-1">
      <span className="block text-xs font-medium text-muted">{label}</span>
      <select
        className={`${inputClass} py-1.5`}
        value={map[key]}
        onChange={(e) => setMap({ ...map, [key]: Number(e.target.value) })}
      >
        <option value={-1}>—</option>
        {header.map((h, i) => (
          <option key={i} value={i}>
            {h || `#${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-4">
      <p className="truncate text-xs text-muted">
        {fileName} · {t("import.rows", { count: rows.length - 1 })}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {columnSelect("date", t("import.colDate"))}
        {columnSelect("description", t("import.colDescription"))}
        {columnSelect("amount", t("import.colAmount"))}
        {columnSelect("debit", t("import.colDebit"))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-muted">{t("field.currency")}</span>
          <select className={`${inputClass} py-1.5`} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-muted">{t("field.wallet")}</span>
          <Combobox
            className={`${inputClass} py-1.5`}
            value={wallet}
            onChange={setWallet}
            placeholder="Maybank"
            options={COMMON_WALLETS.map((value) => ({ value }))}
          />
        </label>
      </div>
      <Toggle label={t("import.monthFirst")} checked={monthFirst} onChange={setMonthFirst} />

      {parsed.length === 0 ? (
        <p className="rounded-lg bg-surface-muted px-3 py-4 text-center text-sm text-muted">{t("import.nothing")}</p>
      ) : (
        <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl ring-1 ring-border">
          {parsed.slice(0, 300).map((r) => (
            <li key={r.key} className="flex items-center gap-2 px-3 py-2 text-xs">
              <input
                type="checkbox"
                aria-label={r.merchant}
                checked={!skipped.has(r.key)}
                onChange={(e) =>
                  setSkipped((s) => {
                    const next = new Set(s);
                    if (e.target.checked) next.delete(r.key);
                    else next.add(r.key);
                    return next;
                  })
                }
              />
              <span className="w-20 shrink-0 text-muted tabular-nums">{r.date}</span>
              <span className="min-w-0 flex-1 truncate" title={r.description}>
                {r.merchant}
              </span>
              <select
                aria-label={t("field.category")}
                value={categories[r.key] ?? r.category}
                onChange={(e) => setCategories((c) => ({ ...c, [r.key]: e.target.value as Category }))}
                className="w-28 shrink-0 rounded-md border border-border bg-surface px-1.5 py-1 text-xs"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`cat.${c}` as MessageKey)}
                  </option>
                ))}
              </select>
              <span className="w-16 shrink-0 text-right font-medium tabular-nums">{formatAmount(r.amount, currency)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <button type="button" onClick={() => setRows(null)} className={buttonStyles.ghost}>
          {t("import.another")}
        </button>
        <button type="button" disabled={busy || chosen.length === 0} onClick={() => void run()} className={buttonStyles.primary}>
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {t("import.go", { count: chosen.length, amount: `${currency} ${formatAmount(total, currency)}` })}
        </button>
      </div>
    </div>
  );
}

export function ImportDialog() {
  const t = useT();
  const open = useUiStore((s) => s.importOpen);
  const setOpen = useUiStore((s) => s.setImportOpen);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} size="lg" title={t("import.title")} description={t("import.subtitle")}>
      {open && <Importer onDone={() => setOpen(false)} />}
    </Dialog>
  );
}

"use client";

import { useState } from "react";

import { CATEGORY_ICONS } from "@/components/quick-add/category-icons";
import { NumberInput } from "@/components/receipt/editor/fields";
import { buttonStyles, Dialog } from "@/components/ui/dialog";
import { useT, type MessageKey } from "@/lib/i18n/messages";
import { useSettingsStore } from "@/lib/store/settings-store";
import { CATEGORIES, type Category, type Currency } from "@/lib/validators/receipt-schema";

/** Monthly total budget plus optional per-category limits (synced when signed in). */
function BudgetsForm({ currency, onClose }: { currency: Currency; onClose: () => void }) {
  const t = useT();
  const store = useSettingsStore();
  const [total, setTotal] = useState(store.budgets[currency] ?? 0);
  const [perCategory, setPerCategory] = useState<Partial<Record<Category, number>>>(
    () => store.categoryBudgets[currency] ?? {},
  );

  function save() {
    store.setBudget(currency, total || null);
    for (const c of CATEGORIES) store.setCategoryBudget(currency, c, perCategory[c] || null);
    onClose();
  }

  return (
    <div className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted">{t("budget.label", { currency })}</span>
        <NumberInput value={total} onValueChange={setTotal} decimals={2} max={1_000_000_000} autoFocus />
      </label>
      <div>
        <p className="mb-2 text-xs font-medium text-muted">{t("budget.perCategory")}</p>
        <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
          {CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c];
            return (
              <label key={c} className="flex items-center gap-2 text-xs">
                <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />
                <span className="w-20 shrink-0 truncate">{t(`cat.${c}` as MessageKey)}</span>
                <NumberInput
                  aria-label={t(`cat.${c}` as MessageKey)}
                  value={perCategory[c] ?? 0}
                  onValueChange={(v) => setPerCategory((p) => ({ ...p, [c]: v }))}
                  decimals={0}
                  max={1_000_000_000}
                  className="py-1.5 text-right text-xs"
                />
              </label>
            );
          })}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <button type="button" className={buttonStyles.ghost} onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button type="button" className={buttonStyles.primary} onClick={save}>
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}

export function BudgetsDialog({ currency, open, onClose }: { currency: Currency; open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t("budget.title")} description={t("budget.body", { currency })}>
      {open && <BudgetsForm currency={currency} onClose={onClose} />}
    </Dialog>
  );
}

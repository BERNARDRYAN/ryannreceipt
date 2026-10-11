"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { buttonStyles, Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/messages";
import { createSampleDraft } from "@/lib/receipts/defaults";
import { useAuthStore } from "@/lib/store/auth-store";
import { usePrefsHydrated, usePrefsStore } from "@/lib/store/prefs-store";
import { useLibraryHydrated, useReceiptStore, type LocalReceipt } from "@/lib/store/receipt-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { useUiStore } from "@/lib/store/ui-store";
import { formatAmount } from "@/lib/utils/currency";
import { CURRENCIES, type Currency } from "@/lib/validators/receipt-schema";

const SAMPLE_SHOP = createSampleDraft().merchantName;

/** The studio's demo receipt that nobody has touched (not real spending). */
export const isUntouchedSample = (r: LocalReceipt) =>
  r.createdAt === r.updatedAt && !r.syncedAt && r.draft.merchantName === SAMPLE_SHOP;

/** Common first choices; the rest are a tap away. */
const MAIN_CURRENCIES: Currency[] = ["MYR", "SGD", "USD", "EUR", "GBP", "AUD", "IDR", "THB"];

/**
 * First visit to Home: pick a currency, optionally a monthly budget, then add
 * the first expense. People who already have expenses never see it.
 */
export function WelcomeSetup() {
  const t = useT();
  const prefsReady = usePrefsHydrated();
  const libraryReady = useLibraryHydrated();
  const setupDone = usePrefsStore((s) => s.setupDone);
  const authStatus = useAuthStore((s) => s.status);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [currency, setCurrency] = useState<Currency>("MYR");
  const [budget, setBudget] = useState("");

  useEffect(() => {
    if (!prefsReady || !libraryReady || setupDone || authStatus === "loading") return;
    const receipts = Object.values(useReceiptStore.getState().receipts);
    const real = receipts.filter((r) => !isUntouchedSample(r) && r.draft.merchantName.trim());
    // Existing users (or anyone signed in, whose data lives in the cloud) skip it.
    if (real.length > 0 || authStatus === "signed-in") {
      usePrefsStore.getState().setSetupDone();
      return;
    }
    const id = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(id);
  }, [prefsReady, libraryReady, setupDone, authStatus]);

  function finish(addFirst: boolean) {
    const settings = useSettingsStore.getState();
    settings.setHomeCurrency(currency);
    const amount = Number(budget.replace(/[^\d.]/g, ""));
    if (amount > 0) settings.setBudget(currency, Math.round(amount * 100) / 100);
    // The demo receipt isn't real spending: clear it from a fresh Home.
    const store = useReceiptStore.getState();
    for (const r of Object.values(store.receipts)) if (isUntouchedSample(r)) store.deleteReceipt(r.id);
    usePrefsStore.getState().setSetupDone();
    setOpen(false);
    if (addFirst) useUiStore.getState().setQuickAddOpen(true);
  }

  return (
    <Dialog
      open={open}
      onClose={() => finish(false)}
      sheet
      title={step === 1 ? t("setup.title") : t("setup.budgetTitle")}
      description={step === 1 ? t("setup.sub") : t("setup.budgetSub")}
    >
      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">{t("setup.step", { n: step })}</p>
      {step === 1 ? (
        <div className="space-y-4">
          <div role="radiogroup" aria-label={t("field.currency")} className="grid grid-cols-4 gap-2">
            {MAIN_CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={currency === c}
                onClick={() => setCurrency(c)}
                className={`rounded-xl py-2.5 text-sm font-semibold ring-1 ${
                  currency === c ? "bg-accent text-accent-contrast ring-accent" : "ring-border hover:bg-surface-muted"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            {t("setup.other")}
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground"
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setStep(2)} className={`${buttonStyles.primary} h-11 w-full rounded-xl text-base`}>
            {t("setup.next")}
            <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-surface-muted px-4 py-3">
            <span className="text-sm font-semibold text-muted">{currency}</span>
            <input
              autoFocus
              aria-label={t("setup.budgetLabel")}
              inputMode="decimal"
              placeholder="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/[^\d.,]/g, "").slice(0, 10))}
              className="w-full min-w-0 bg-transparent text-center text-3xl font-semibold tabular-nums outline-none placeholder:text-muted/40"
            />
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {[1000, 2000, 3000, 5000].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setBudget(String(n))}
                className="rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-border hover:bg-surface-muted"
              >
                {formatAmount(n, currency)}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => finish(true)} className={`${buttonStyles.primary} h-11 w-full rounded-xl text-base`}>
            {t("setup.start")}
          </button>
          <button type="button" onClick={() => finish(false)} className="block w-full text-center text-sm text-muted hover:text-foreground">
            {budget ? t("setup.later") : t("setup.skip")}
          </button>
        </div>
      )}
    </Dialog>
  );
}

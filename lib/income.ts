import { convert, type FxRates } from "@/lib/fx/rates";
import type { Currency, Income } from "@/lib/validators/receipt-schema";

/**
 * Income that counts towards a month (YYYY-MM): one-offs dated in it, and
 * monthly amounts from their start month until they were stopped.
 */
export function incomeInMonth(list: Income[], month: string): Income[] {
  return list.filter((i) =>
    i.monthly ? i.date.slice(0, 7) <= month && (!i.until || month <= i.until) : i.date.startsWith(month),
  );
}

/** Total for a month in one currency; amounts we can't convert yet are left out. */
export function incomeTotal(list: Income[], month: string, currency: Currency, fx: FxRates | null) {
  let total = 0;
  for (const i of incomeInMonth(list, month)) total += convert(i.amount, i.currency, currency, fx) ?? 0;
  return Math.round(total * 100) / 100;
}

/** Left to spend and the share of income kept (null when there's no income). */
export function leftToSpend(income: number, spent: number) {
  if (income <= 0) return null;
  const left = Math.round((income - spent) * 100) / 100;
  return { left, savedPct: Math.round((left / income) * 100) };
}

"use client";

import { useMonthLabel } from "@/components/history/charts";
import { INTL_LOCALE, useLocale, useT } from "@/lib/i18n/messages";
import { formatAmount } from "@/lib/utils/currency";
import type { Currency } from "@/lib/validators/receipt-schema";

// Sequential ramp: one hue (the accent) stepped toward the surface; empty days stay neutral.
const LEVELS = [
  "bg-viz-grid",
  "bg-[color-mix(in_oklab,var(--viz-accent)_22%,var(--surface))]",
  "bg-[color-mix(in_oklab,var(--viz-accent)_45%,var(--surface))]",
  "bg-[color-mix(in_oklab,var(--viz-accent)_70%,var(--surface))]",
  "bg-viz-accent",
];

const DAY_MS = 86_400_000;

/** Weekday initials starting Monday, in the UI language. */
function useWeekdays() {
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "narrow", timeZone: "UTC" });
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))));
}

/**
 * Month calendar heatmap of daily spending. Days are buttons that filter the
 * list; each carries its amount in the accessible name, so nothing is
 * colour-only.
 */
export function SpendingCalendar({
  month,
  today,
  totals,
  currency,
  selectedDay,
  onSelectDay,
}: {
  month: string;
  today: string;
  /** Spend per `YYYY-MM-DD`. */
  totals: Map<string, number>;
  currency: Currency;
  selectedDay: string;
  onSelectDay: (day: string) => void;
}) {
  const t = useT();
  const ml = useMonthLabel();
  const weekdays = useWeekdays();
  const [y, m] = month.split("-").map(Number);
  const first = Date.UTC(y, m - 1, 1);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (new Date(first).getUTCDay() + 6) % 7; // Monday-first

  const values = [...totals.entries()].filter(([d, v]) => d.startsWith(month) && v > 0).map(([, v]) => v);
  const max = Math.max(...values, 0);
  const level = (v: number) => (v <= 0 || max <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));

  // This week (Mon–today) vs the same span last week.
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const weekStart = todayMs - ((new Date(todayMs).getUTCDay() + 6) % 7) * DAY_MS;
  const sumRange = (from: number, to: number) => {
    let s = 0;
    for (let d = from; d <= to; d += DAY_MS) s += totals.get(new Date(d).toISOString().slice(0, 10)) ?? 0;
    return s;
  };
  const thisWeek = sumRange(weekStart, todayMs);
  const lastWeek = sumRange(weekStart - 7 * DAY_MS, todayMs - 7 * DAY_MS);

  return (
    <figure className="rounded-2xl border border-border bg-surface p-4">
      <figcaption className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{t("calendar.title")}</p>
          <p className="text-xs text-muted">{t("calendar.sub", { month: ml(month, true) })}</p>
        </div>
        <p className="text-right text-xs text-muted">
          <span className="block font-semibold text-foreground tabular-nums">
            {currency} {formatAmount(thisWeek, currency)}
          </span>
          {t("calendar.week", { amount: formatAmount(lastWeek, currency) })}
        </p>
      </figcaption>
      <div className="mx-auto max-w-80">
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted" aria-hidden>
        {weekdays.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: offset }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, "0")}`;
          const value = totals.get(day) ?? 0;
          const lv = level(value);
          const future = day > today;
          const selected = day === selectedDay;
          return (
            <button
              key={day}
              type="button"
              disabled={future}
              onClick={() => onSelectDay(selected ? "" : day)}
              aria-pressed={selected}
              aria-label={`${day}: ${currency} ${formatAmount(value, currency)}`}
              title={value > 0 ? `${currency} ${formatAmount(value, currency)}` : undefined}
              className={`aspect-square rounded-md text-[11px] font-medium tabular-nums transition-transform hover:scale-110 disabled:opacity-30 disabled:hover:scale-100 ${
                LEVELS[lv]
              } ${lv >= 3 ? "text-neutral-950" : "text-foreground/80"} ${
                selected ? "ring-2 ring-foreground ring-offset-1 ring-offset-surface" : day === today ? "ring-1 ring-foreground/50" : ""
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted" aria-hidden>
        {t("calendar.less")}
        {LEVELS.map((cls, i) => (
          <span key={i} className={`size-2.5 rounded-sm ${cls}`} />
        ))}
        {t("calendar.more")}
      </div>
    </figure>
  );
}

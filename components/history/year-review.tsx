"use client";

import { Download, LoaderCircle, Share2 } from "lucide-react";
import { useRef, useState } from "react";

import { useMonthLabel } from "@/components/history/charts";
import { buttonStyles, Dialog } from "@/components/ui/dialog";
import type { HistoryEntry } from "@/lib/history/entries";
import { reviewYears, yearReview } from "@/lib/history/review";
import { INTL_LOCALE, useLocale, useT, type MessageKey } from "@/lib/i18n/messages";
import { toast } from "@/lib/store/toast-store";
import { useUiStore } from "@/lib/store/ui-store";
import { formatAmount } from "@/lib/utils/currency";
import { canShareFiles, downloadNodeAsPng, shareNodeAsImage } from "@/lib/utils/export-canvas";
import type { Currency } from "@/lib/validators/receipt-schema";

const Rule = () => <div className="my-2 border-t border-dashed border-current opacity-40" aria-hidden />;

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0">{value}</span>
    </div>
  );
}

/** The year's story as a thermal receipt, ready to screenshot or share. */
function ReviewCard({ entries, currency, year, today }: { entries: HistoryEntry[]; currency: Currency; year: string; today: string }) {
  const t = useT();
  const locale = useLocale();
  const ml = useMonthLabel();
  const r = yearReview(entries, year, today);
  const money = (n: number) => `${currency} ${formatAmount(n, currency)}`;
  const weekday = (day: number) =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2023, 0, 1 + day)));
  const peak = Math.max(...r.months, 1);
  const change = r.previousTotal ? Math.round(((r.total - r.previousTotal) / r.previousTotal) * 100) : null;

  return (
    <div className="receipt-paper mx-auto" data-tear="" style={{ ["--ink" as string]: "#1f1d1a" }}>
      <p className="text-center text-sm font-bold tracking-widest">RYANNRECEIPT</p>
      <p className="text-center uppercase">{t("review.heading", { year })}</p>
      <Rule />
      {r.count === 0 ? (
        <p className="py-6 text-center">{t("review.empty")}</p>
      ) : (
        <>
          <Line label={t("review.spent")} value={money(r.total)} />
          <Line label={t("review.receipts")} value={String(r.count)} />
          <Line label={t("review.monthlyAvg")} value={money(r.monthlyAvg)} />
          {change !== null && (
            <Line label={t("review.vsLast", { year: Number(year) - 1 })} value={`${change > 0 ? "+" : ""}${change}%`} />
          )}
          <Rule />
          {/* One series, so no legend: month names sit under the bars, values on hover. */}
          <div className="flex h-16 items-end gap-[3px]" role="img" aria-label={t("review.byMonth")}>
            {r.months.map((n, i) => (
              <div key={i} className="flex h-full flex-1 flex-col justify-end" title={`${ml(`${year}-${String(i + 1).padStart(2, "0")}`)} · ${money(n)}`}>
                <div
                  className="rounded-t-[2px] bg-current"
                  style={{ height: n > 0 ? `${Math.max(4, (n / peak) * 100)}%` : "1px", opacity: i === r.biggestMonth?.index ? 1 : 0.45 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-[3px] text-center text-[8px] opacity-70" aria-hidden>
            {r.months.map((_, i) => (
              <span key={i} className="flex-1 overflow-hidden">
                {ml(`${year}-${String(i + 1).padStart(2, "0")}`).slice(0, 1)}
              </span>
            ))}
          </div>
          <Rule />
          {r.biggestMonth && (
            <Line label={t("review.biggestMonth")} value={ml(`${year}-${String(r.biggestMonth.index + 1).padStart(2, "0")}`)} />
          )}
          {r.busiestWeekday && <Line label={t("review.busiestDay")} value={weekday(r.busiestWeekday.day)} />}
          {r.biggestReceipt && (
            <>
              <Line label={t("review.biggestReceipt")} value={money(r.biggestReceipt.total)} />
              <p className="truncate text-right opacity-70">
                {r.biggestReceipt.name} · {r.biggestReceipt.date}
              </p>
            </>
          )}
          <Rule />
          <p className="font-bold">{t("review.topCategories")}</p>
          {r.topCategories.map((c, i) => (
            <Line key={c.key} label={`${i + 1}. ${t(`cat.${c.key}` as MessageKey)}`} value={money(c.total)} />
          ))}
          <Rule />
          <p className="font-bold">{t("review.topShops")}</p>
          {r.topShops.map((s, i) => (
            <Line key={s.name} label={`${i + 1}. ${s.name}`} value={`${s.count}×`} />
          ))}
        </>
      )}
      <Rule />
      <p className="text-center">{t("review.thanks")}</p>
    </div>
  );
}

export function YearReviewDialog({ entries, currency, today }: { entries: HistoryEntry[]; currency: Currency; today: string }) {
  const t = useT();
  const year = useUiStore((s) => s.reviewYear);
  const setYear = useUiStore((s) => s.setReviewYear);
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const years = reviewYears(entries);

  async function exportImage(share: boolean) {
    const node = cardRef.current?.querySelector<HTMLElement>(".receipt-paper");
    if (!node || !year) return;
    setBusy(true);
    try {
      if (share) await shareNodeAsImage(node, `ryannreceipt-${year}-review`, t("review.heading", { year }));
      else await downloadNodeAsPng(node, `ryannreceipt-${year}-review`, 4);
    } catch {
      toast(t("review.failed"), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={year !== null} onClose={() => setYear(null)} title={t("review.title")} description={t("review.subtitle", { currency })}>
      {year && (
        <div className="space-y-4">
          {years.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("review.year")}>
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  aria-pressed={y === year}
                  onClick={() => setYear(y)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${y === year ? "bg-foreground text-background ring-foreground" : "ring-border hover:bg-surface-muted"}`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
          <div ref={cardRef} className="max-h-[60vh] overflow-y-auto rounded-xl bg-surface-muted py-4">
            <ReviewCard entries={entries} currency={currency} year={year} today={today} />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={busy} onClick={() => void exportImage(false)} className={buttonStyles.secondary}>
              {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
              {t("review.download")}
            </button>
            {canShareFiles() && (
              <button type="button" disabled={busy} onClick={() => void exportImage(true)} className={buttonStyles.primary}>
                <Share2 className="size-4" aria-hidden />
                {t("review.share")}
              </button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

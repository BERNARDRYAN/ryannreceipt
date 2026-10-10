"use client";

import { ArrowLeft, ArrowRight, Download } from "lucide-react";
import { useEffect, useRef } from "react";

import { fieldDomId } from "@/components/receipt/editor/fields";
import { ItemsEditor } from "@/components/receipt/editor/items-editor";
import { LookStep, PaymentStep, ShopStep } from "@/components/receipt/editor/steps";
import { useT, type MessageKey } from "@/lib/i18n/messages";
import { exportActions, STEPS, useEditorStore, type Step } from "@/lib/store/editor-store";

const STEP_LABEL: Record<Step, MessageKey> = {
  shop: "step.shop",
  items: "step.items",
  payment: "step.payment",
  look: "step.look",
};

/** Find the input for a field requested from a click on the paper. */
function targetFor(field: string): HTMLElement | null {
  if (field === "logo") return document.getElementById("field-logo");
  return document.getElementById(fieldDomId(field));
}

/**
 * Four short steps instead of one long form. Clicking a line on the receipt
 * jumps to its step, opens any collapsed group, then focuses and flashes the field.
 */
export function StepEditor() {
  const t = useT();
  const step = useEditorStore((s) => s.step);
  const setStep = useEditorStore((s) => s.setStep);
  const focusRequest = useEditorStore((s) => s.focusRequest);
  const scrollRef = useRef<HTMLDivElement>(null);
  const index = STEPS.indexOf(step);

  useEffect(() => {
    if (!focusRequest) return;
    const el = targetFor(focusRequest.field);
    if (!el) return;
    // Open collapsed "More options" around the target.
    for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) d.open = true;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
    if (el instanceof HTMLInputElement && el.type === "text") el.select();
    el.classList.add("field-flash");
    const timer = window.setTimeout(() => el.classList.remove("field-flash"), 1900);
    return () => window.clearTimeout(timer);
  }, [focusRequest]);

  function go(next: Step) {
    setStep(next);
    scrollRef.current?.scrollTo({ top: 0 });
    // The aside itself scrolls on desktop; reset it too.
    scrollRef.current?.closest("aside")?.scrollTo({ top: 0 });
  }

  const prev = STEPS[index - 1];
  const next = STEPS[index + 1];

  return (
    <div ref={scrollRef} className="flex min-h-full flex-col">
      <nav
        aria-label={t("studio.editor")}
        className="sticky top-0 z-10 border-b border-border bg-surface/95 px-4 pt-3 pb-0 backdrop-blur"
      >
        <ol className="grid grid-cols-4 gap-1">
          {STEPS.map((s, i) => {
            const current = s === step;
            const done = i < index;
            return (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => go(s)}
                  aria-current={current ? "step" : undefined}
                  className={`flex w-full flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-xs font-medium transition-colors ${
                    current ? "text-foreground" : "text-muted hover:text-foreground"
                  }`}
                >
                  <span
                    className={`flex size-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors ${
                      current
                        ? "bg-accent text-accent-contrast"
                        : done
                          ? "bg-foreground/15 text-foreground"
                          : "bg-surface-muted text-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {t(STEP_LABEL[s])}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
          <div
            className="h-full rounded-full bg-viz-accent transition-[width] duration-300"
            style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </nav>

      <div key={step} className="flex-1 px-5 pt-5 pb-6 animate-[fade-up_200ms_ease-out]">
        <p className="mb-4 text-[11px] font-medium text-muted">{t("step.of", { n: index + 1, total: STEPS.length })}</p>
        {step === "shop" && <ShopStep />}
        {step === "items" && <ItemsEditor />}
        {step === "payment" && <PaymentStep />}
        {step === "look" && <LookStep />}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-surface/95 px-5 py-3 backdrop-blur max-lg:bottom-16">
        {prev ? (
          <button
            type="button"
            onClick={() => go(prev)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("common.back")}
          </button>
        ) : (
          <span />
        )}
        {next ? (
          <button
            type="button"
            onClick={() => go(next)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast shadow-sm hover:opacity-90"
          >
            {t("step.nextTo", { step: t(STEP_LABEL[next]) })}
            <ArrowRight className="size-4" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => exportActions.png?.()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast shadow-sm hover:opacity-90"
          >
            <Download className="size-4" aria-hidden />
            {t("step.finish")}
          </button>
        )}
      </div>
    </div>
  );
}

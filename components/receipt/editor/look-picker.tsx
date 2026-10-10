"use client";

import { Check } from "lucide-react";

import { useT, type MessageKey } from "@/lib/i18n/messages";
import { useActiveDraft, useReceiptStore } from "@/lib/store/receipt-store";
import type { ReceiptStyle } from "@/lib/validators/receipt-schema";

type LookStyle = Pick<ReceiptStyle, "paperTheme" | "fontFamily" | "tearEdge" | "monochromeDither">;

/** One-click combinations of paper, typeface, edge and grain. */
export const LOOKS: { id: string; label: MessageKey; style: LookStyle }[] = [
  {
    id: "classic",
    label: "look.classic",
    style: { paperTheme: "clean", fontFamily: "mono", tearEdge: true, monochromeDither: false },
  },
  {
    id: "vintage",
    label: "look.vintage",
    style: { paperTheme: "aged", fontFamily: "typewriter", tearEdge: true, monochromeDither: true },
  },
  {
    id: "pastel",
    label: "look.pastel",
    style: { paperTheme: "pink", fontFamily: "mono", tearEdge: true, monochromeDither: false },
  },
  {
    id: "dotmatrix",
    label: "look.dotmatrix",
    style: { paperTheme: "clean", fontFamily: "dotmatrix", tearEdge: true, monochromeDither: false },
  },
  {
    id: "cool",
    label: "look.cool",
    style: { paperTheme: "blue", fontFamily: "typewriter", tearEdge: true, monochromeDither: false },
  },
  {
    id: "minimal",
    label: "look.minimal",
    style: { paperTheme: "clean", fontFamily: "mono", tearEdge: false, monochromeDither: false },
  },
];

const matches = (s: ReceiptStyle, look: LookStyle) =>
  s.paperTheme === look.paperTheme &&
  s.fontFamily === look.fontFamily &&
  s.tearEdge === look.tearEdge &&
  s.monochromeDither === look.monochromeDither;

/** Miniature slip rendered with the real paper/typeface CSS. */
function LookSwatch({ look }: { look: LookStyle }) {
  return (
    <div
      aria-hidden
      className="receipt-paper pointer-events-none"
      data-theme={look.paperTheme}
      data-font={look.fontFamily}
      data-tear={look.tearEdge || undefined}
      data-dither={look.monochromeDither || undefined}
      style={{ width: "100%", padding: "10px 8px 12px", fontSize: 7, ["--tooth" as string]: "6px" }}
    >
      <div className="receipt-ink space-y-[3px]">
        <p className="text-center text-[9px] font-bold tracking-wider">KOPITIAM</p>
        <div className="receipt-divider" />
        <div className="flex justify-between">
          <span>KOPI O</span>
          <span>5.60</span>
        </div>
        <div className="flex justify-between">
          <span>ROTI</span>
          <span>4.50</span>
        </div>
        <div className="receipt-divider" data-double />
        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span>10.10</span>
        </div>
      </div>
    </div>
  );
}

export function LookPicker() {
  const t = useT();
  const draft = useActiveDraft();
  const setStyles = useReceiptStore((s) => s.setStyles);
  if (!draft) return null;

  return (
    <div role="radiogroup" aria-label={t("section.style")} className="grid grid-cols-3 gap-2.5">
      {LOOKS.map((look) => {
        const active = matches(draft.styleConfig, look.style);
        return (
          <button
            key={look.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setStyles(look.style)}
            className={`group relative flex flex-col items-center gap-1.5 rounded-xl p-2 pb-1.5 text-xs font-medium transition-all ${
              active
                ? "bg-surface-muted ring-2 ring-foreground"
                : "ring-1 ring-border hover:-translate-y-0.5 hover:ring-foreground/40"
            }`}
          >
            <span className="desk-surface flex w-full justify-center rounded-lg px-2.5 pt-2.5 pb-1">
              <span className="block w-full drop-shadow-sm">
                <LookSwatch look={look.style} />
              </span>
            </span>
            <span className={active ? "text-foreground" : "text-muted group-hover:text-foreground"}>
              {t(look.label)}
            </span>
            {active && (
              <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-accent text-accent-contrast">
                <Check className="size-3" aria-hidden />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { Minus, MousePointerClick, Plus } from "lucide-react";
import type { Ref } from "react";

import { ReceiptCanvas } from "@/components/receipt/receipt-canvas";
import { useT } from "@/lib/i18n/messages";
import { DEFAULT_ZOOM, useEditorStore, ZOOM_LEVELS } from "@/lib/store/editor-store";
import type { ReceiptDraft } from "@/lib/validators/receipt-schema";

const PAPER_PX = { "80mm": 302, "58mm": 220 } as const;

/**
 * The desk the receipt sits on: a thermal printer the paper feeds out of
 * (replayed via `printKey`), an "Exported" stamp, zoom, and click-to-edit.
 */
export function PreviewStage({ draft, paperRef }: { draft: ReceiptDraft; paperRef: Ref<HTMLDivElement> }) {
  const t = useT();
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const printKey = useEditorStore((s) => s.printKey);
  const stampKey = useEditorStore((s) => s.stampKey);
  const focusField = useEditorStore((s) => s.focusField);
  const paperWidth = PAPER_PX[draft.styleConfig.width];
  const zoomIndex = ZOOM_LEVELS.indexOf(zoom as (typeof ZOOM_LEVELS)[number]);

  return (
    <div className="relative flex min-h-full flex-col items-center px-4 pt-8 pb-24 lg:pt-10">
      {/* Zoom applies on desktop only; phones always fit the paper to the screen. */}
      <div className="flex flex-col items-center lg:[zoom:var(--stage-zoom)]" style={{ ["--stage-zoom" as string]: zoom }}>
        <div className="printer" style={{ width: paperWidth + 44 }} aria-hidden>
          <span className="printer-label">RYANN·{draft.styleConfig.width === "58mm" ? "58" : "80"}</span>
          <span className="printer-led" />
        </div>
        {/* Clips the paper at the slot so it appears to feed out of the printer. */}
        <div className="relative -mt-2.5 overflow-hidden px-8 pb-12" data-guide="preview">
          <div key={printKey} className="receipt-shadow receipt-feed">
            <ReceiptCanvas ref={paperRef} draft={draft} onFieldClick={focusField} />
          </div>
          {stampKey > 0 && (
            <span key={stampKey} className="export-stamp" aria-hidden>
              {t("studio.stamp")} ✓
            </span>
          )}
        </div>
      </div>

      <p className="pointer-events-none mt-1 hidden items-center gap-1.5 rounded-full bg-surface/70 px-3 py-1 text-xs text-muted backdrop-blur lg:inline-flex">
        <MousePointerClick className="size-3.5" aria-hidden />
        {t("studio.clickHint")}
      </p>

      <div className="sticky bottom-5 z-10 mt-auto hidden items-center gap-0.5 self-end rounded-full border border-border bg-surface/90 p-1 shadow-lg backdrop-blur lg:flex">
        <button
          type="button"
          onClick={() => setZoom(ZOOM_LEVELS[Math.max(0, zoomIndex - 1)])}
          disabled={zoomIndex <= 0}
          aria-label={t("zoom.out")}
          className="rounded-full p-1.5 text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-30"
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setZoom(DEFAULT_ZOOM)}
          aria-label={t("zoom.reset")}
          className="min-w-12 rounded-full px-1.5 py-1 text-xs font-medium tabular-nums hover:bg-surface-muted"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => setZoom(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, zoomIndex + 1)])}
          disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
          aria-label={t("zoom.in")}
          className="rounded-full p-1.5 text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-30"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

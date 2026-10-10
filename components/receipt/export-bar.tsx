"use client";

import { Download, FileText, LoaderCircle } from "lucide-react";
import { useState, type RefObject } from "react";

import {
  downloadNodeAsPdf,
  downloadNodeAsPng,
  exportBasename,
  PNG_SCALES,
  type PngScale,
} from "@/lib/utils/export-canvas";
import type { ReceiptDraft } from "@/lib/validators/receipt-schema";

type ExportBarProps = {
  targetRef: RefObject<HTMLDivElement | null>;
  draft: ReceiptDraft;
  disabled?: boolean;
  onError: (message: string | null) => void;
};

type Job = "png" | "pdf" | null;

export function ExportBar({ targetRef, draft, disabled, onError }: ExportBarProps) {
  const [scale, setScale] = useState<PngScale>(2);
  const [job, setJob] = useState<Job>(null);
  const busy = job !== null;

  async function run(kind: Exclude<Job, null>) {
    const node = targetRef.current;
    if (!node || busy) return;
    setJob(kind);
    onError(null);
    const basename = exportBasename(draft.merchantName, draft.receiptNo);
    try {
      if (kind === "png") await downloadNodeAsPng(node, basename, scale);
      else await downloadNodeAsPdf(node, basename, draft.styleConfig.width === "58mm" ? 58 : 80);
    } catch {
      onError(`${kind.toUpperCase()} export failed. Try again.`);
    } finally {
      setJob(null);
    }
  }

  const spinner = <LoaderCircle className="size-4 animate-spin" aria-hidden />;

  return (
    <div className="flex items-center gap-1.5">
      <div role="radiogroup" aria-label="PNG resolution" className="hidden rounded-md bg-surface-muted p-0.5 sm:flex">
        {PNG_SCALES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={scale === s}
            onClick={() => setScale(s)}
            className={`rounded px-2 py-1 text-xs font-medium tabular-nums transition-colors ${
              scale === s ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => run("pdf")}
        disabled={disabled || busy}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-foreground hover:bg-surface-muted disabled:opacity-50"
      >
        {job === "pdf" ? spinner : <FileText className="size-4" aria-hidden />}
        PDF
      </button>
      <button
        type="button"
        onClick={() => run("png")}
        disabled={disabled || busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast hover:opacity-90 disabled:opacity-50"
      >
        {job === "png" ? spinner : <Download className="size-4" aria-hidden />}
        PNG
      </button>
    </div>
  );
}

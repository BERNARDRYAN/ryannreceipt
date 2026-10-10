"use client";

import { ChevronDown, Copy, Download, FileText, LoaderCircle, Printer, Share2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

import { menuItemClass, menuLabelClass, useAnchoredPopover } from "@/components/ui/use-anchored-popover";
import { useT } from "@/lib/i18n/messages";
import { exportActions, useEditorStore } from "@/lib/store/editor-store";
import { toast } from "@/lib/store/toast-store";
import {
  canCopyImage,
  canShareFiles,
  copyNodeAsImage,
  downloadNodeAsPdf,
  downloadNodeAsPng,
  exportBasename,
  PNG_SCALES,
  printNode,
  shareNodeAsImage,
  type PngScale,
} from "@/lib/utils/export-canvas";
import type { ReceiptDraft } from "@/lib/validators/receipt-schema";

type ExportBarProps = {
  targetRef: RefObject<HTMLDivElement | null>;
  draft: ReceiptDraft;
  disabled?: boolean;
  /** Registers keyboard-shortcut actions; only one mounted bar should. */
  primary?: boolean;
  /** Larger "Export" label for the phone bottom bar. */
  variant?: "header" | "bar";
};

type Job = "png" | "pdf" | "copy" | "share" | null;

const noopSubscribe = () => () => {};

/** Feature support never changes after load; read it without a hydration mismatch. */
function useClientCapabilities() {
  const copy = useSyncExternalStore(noopSubscribe, canCopyImage, () => false);
  const share = useSyncExternalStore(noopSubscribe, canShareFiles, () => false);
  return { copy, share };
}

/** Primary PNG button plus a menu: resolution, copy, share, PDF and print. */
export function ExportBar({ targetRef, draft, disabled, primary = true, variant = "header" }: ExportBarProps) {
  const t = useT();
  const [scale, setScale] = useState<PngScale>(2);
  const [job, setJob] = useState<Job>(null);
  const caps = useClientCapabilities();
  const showStamp = useEditorStore((s) => s.showStamp);
  const { triggerProps, popoverProps, close } = useAnchoredPopover({ align: "end", width: 248 });
  const busy = job !== null;
  const paperMm = draft.styleConfig.width === "58mm" ? 58 : 80;
  const basename = exportBasename(draft.merchantName, draft.receiptNo);

  async function run(kind: Exclude<Job, null>, task: (node: HTMLElement) => Promise<unknown>) {
    const node = targetRef.current;
    if (!node || busy) return;
    close();
    setJob(kind);
    try {
      await task(node);
      if (kind === "png" || kind === "pdf") showStamp();
    } catch {
      toast(t("export.failed"), { tone: "error" });
    } finally {
      setJob(null);
    }
  }

  function print() {
    const node = targetRef.current;
    close();
    if (node) printNode(node, paperMm);
  }

  const exportPng = () => run("png", (node) => downloadNodeAsPng(node, basename, scale));

  // Expose the latest handlers to keyboard shortcuts (Ctrl+S / Ctrl+P).
  useEffect(() => {
    if (!primary) return;
    exportActions.png = () => void exportPng();
    exportActions.print = print;
    return () => {
      exportActions.png = undefined;
      exportActions.print = undefined;
    };
  });

  const spinner = <LoaderCircle className="size-4 animate-spin" aria-hidden />;
  const big = variant === "bar";

  return (
    <div className="flex items-center" data-guide="export">
      <button
        type="button"
        onClick={() => void exportPng()}
        disabled={disabled || busy}
        className={`inline-flex items-center gap-1.5 rounded-l-lg bg-accent font-medium text-accent-contrast shadow-sm hover:opacity-90 disabled:opacity-50 ${
          big ? "py-2.5 pr-3 pl-4 text-sm" : "py-1.5 pr-2.5 pl-3 text-sm"
        }`}
      >
        {job === "png" ? spinner : <Download className="size-4" aria-hidden />}
        <span>
          {big ? t("export.button") : t("export.png")} <span className="font-normal opacity-70">{scale}x</span>
        </span>
      </button>
      <button
        {...triggerProps}
        type="button"
        disabled={disabled}
        aria-label={t("export.more")}
        className={`inline-flex items-center self-stretch rounded-r-lg border-l border-accent-contrast/20 bg-accent px-1.5 text-accent-contrast shadow-sm hover:opacity-90 disabled:opacity-50 ${
          big ? "px-2.5" : ""
        }`}
      >
        {busy && job !== "png" ? spinner : <ChevronDown className="size-4" aria-hidden />}
      </button>

      <div {...popoverProps} style={{ width: 248 }}>
        <p className={menuLabelClass}>{t("export.resolution")}</p>
        <div
          role="radiogroup"
          aria-label={t("export.resolution")}
          className="mx-1.5 mb-1.5 flex rounded-lg bg-surface-muted p-0.5"
        >
          {PNG_SCALES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scale === s}
              onClick={() => setScale(s)}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium tabular-nums transition-colors ${
                scale === s ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
        <div className="my-1 border-t border-border" />
        {caps.copy && (
          <button
            type="button"
            className={menuItemClass}
            onClick={() =>
              run("copy", async (node) => {
                await copyNodeAsImage(node, scale);
                toast(t("export.copied"), { tone: "success" });
              })
            }
          >
            <Copy className="size-4" aria-hidden />
            {t("export.copy")}
          </button>
        )}
        {caps.share && (
          <button
            type="button"
            className={menuItemClass}
            onClick={() => run("share", (node) => shareNodeAsImage(node, basename, draft.merchantName || "Receipt"))}
          >
            <Share2 className="size-4" aria-hidden />
            {t("export.share")}
          </button>
        )}
        <button
          type="button"
          className={menuItemClass}
          onClick={() => run("pdf", (node) => downloadNodeAsPdf(node, basename, paperMm))}
        >
          <FileText className="size-4" aria-hidden />
          {t("export.pdf")}
        </button>
        <button type="button" className={menuItemClass} onClick={print}>
          <Printer className="size-4" aria-hidden />
          {t("export.print", { mm: paperMm })}
        </button>
      </div>
    </div>
  );
}

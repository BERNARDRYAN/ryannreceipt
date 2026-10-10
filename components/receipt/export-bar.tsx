"use client";

import { ChevronDown, Copy, Download, FileText, LoaderCircle, Printer, Share2 } from "lucide-react";
import { useId, useState, useSyncExternalStore, type RefObject } from "react";

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
};

type Job = "png" | "pdf" | "copy" | "share" | null;

const noopSubscribe = () => () => {};

/** Feature support never changes after load; read it without a hydration mismatch. */
function useClientCapabilities() {
  const copy = useSyncExternalStore(noopSubscribe, canCopyImage, () => false);
  const share = useSyncExternalStore(noopSubscribe, canShareFiles, () => false);
  return { copy, share };
}

const menuItem =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-50";

/**
 * Primary "PNG" button plus a menu: resolution, copy, share, PDF and print.
 * The menu is a native popover (light-dismiss and Esc for free).
 */
export function ExportBar({ targetRef, draft, disabled }: ExportBarProps) {
  const [scale, setScale] = useState<PngScale>(2);
  const [job, setJob] = useState<Job>(null);
  const caps = useClientCapabilities();
  const menuId = useId();
  const busy = job !== null;
  const paperMm = draft.styleConfig.width === "58mm" ? 58 : 80;
  const basename = exportBasename(draft.merchantName, draft.receiptNo);

  function closeMenu() {
    document.getElementById(menuId)?.hidePopover();
  }

  async function run(kind: Exclude<Job, null>, task: (node: HTMLElement) => Promise<unknown>) {
    const node = targetRef.current;
    if (!node || busy) return;
    closeMenu();
    setJob(kind);
    try {
      await task(node);
    } catch {
      toast(`Couldn't ${kind === "copy" ? "copy" : kind === "share" ? "share" : `export ${kind.toUpperCase()}`}. Try again.`, {
        tone: "error",
      });
    } finally {
      setJob(null);
    }
  }

  const spinner = <LoaderCircle className="size-4 animate-spin" aria-hidden />;

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => run("png", (node) => downloadNodeAsPng(node, basename, scale))}
        disabled={disabled || busy}
        className="inline-flex items-center gap-1.5 rounded-l-md bg-accent py-1.5 pr-2.5 pl-3 text-sm font-medium text-accent-contrast hover:opacity-90 disabled:opacity-50"
      >
        {job === "png" ? spinner : <Download className="size-4" aria-hidden />}
        <span>
          PNG <span className="font-normal opacity-70">{scale}x</span>
        </span>
      </button>
      <button
        type="button"
        popoverTarget={menuId}
        disabled={disabled}
        aria-label="More export options"
        className="inline-flex items-center self-stretch rounded-r-md border-l border-accent-contrast/20 bg-accent px-1.5 text-accent-contrast hover:opacity-90 disabled:opacity-50"
      >
        {busy && job !== "png" ? spinner : <ChevronDown className="size-4" aria-hidden />}
      </button>

      <div
        id={menuId}
        popover="auto"
        className="fixed inset-auto top-14 right-4 m-0 w-60 rounded-lg border border-border bg-surface p-1.5 text-foreground shadow-lg"
      >
        <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">
          PNG resolution
        </p>
        <div role="radiogroup" aria-label="PNG resolution" className="mx-1.5 mb-1.5 flex rounded-md bg-surface-muted p-0.5">
          {PNG_SCALES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scale === s}
              onClick={() => setScale(s)}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium tabular-nums transition-colors ${
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
            className={menuItem}
            onClick={() =>
              run("copy", async (node) => {
                await copyNodeAsImage(node, scale);
                toast("Receipt image copied", { tone: "success" });
              })
            }
          >
            <Copy className="size-4" aria-hidden />
            Copy image
          </button>
        )}
        {caps.share && (
          <button
            type="button"
            className={menuItem}
            onClick={() => run("share", (node) => shareNodeAsImage(node, basename, draft.merchantName || "Receipt"))}
          >
            <Share2 className="size-4" aria-hidden />
            Share…
          </button>
        )}
        <button
          type="button"
          className={menuItem}
          onClick={() => run("pdf", (node) => downloadNodeAsPdf(node, basename, paperMm))}
        >
          <FileText className="size-4" aria-hidden />
          Download PDF
        </button>
        <button
          type="button"
          className={menuItem}
          onClick={() => {
            const node = targetRef.current;
            closeMenu();
            if (node) printNode(node, paperMm);
          }}
        >
          <Printer className="size-4" aria-hidden />
          Print ({paperMm}mm roll)
        </button>
      </div>
    </div>
  );
}

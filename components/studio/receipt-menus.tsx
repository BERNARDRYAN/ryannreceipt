"use client";

import { ChevronDown, Clock, Copy, FilePlus2, LayoutTemplate, Plus } from "lucide-react";
import Link from "next/link";

import { menuItemClass, menuLabelClass, useAnchoredPopover } from "@/components/ui/use-anchored-popover";
import { useT } from "@/lib/i18n/messages";
import { useEditorStore } from "@/lib/store/editor-store";
import { useReceiptStore } from "@/lib/store/receipt-store";
import { toast } from "@/lib/store/toast-store";
import { computeTotals, formatAmount } from "@/lib/utils/currency";

/** "New ▾": blank receipt (undoable), from a template, or duplicate the open one. */
export function NewMenu({ onNew }: { onNew: () => void }) {
  const t = useT();
  const { triggerProps, popoverProps, close } = useAnchoredPopover({ align: "end", width: 224 });
  const setTemplatesOpen = useEditorStore((s) => s.setTemplatesOpen);
  const replayPrint = useEditorStore((s) => s.replayPrint);

  function duplicate() {
    const store = useReceiptStore.getState();
    const id = store.duplicateReceipt(store.activeId);
    if (!id) return;
    store.openReceipt(id);
    replayPrint();
    toast(t("studio.duplicated"));
  }

  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <>
      <button
        {...triggerProps}
        type="button"
        aria-label={t("studio.newReceipt")}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-surface-muted hover:text-foreground"
      >
        <Plus className="size-4" aria-hidden />
        <span className="hidden md:inline">{t("studio.new")}</span>
        <ChevronDown className="hidden size-3.5 md:block" aria-hidden />
      </button>
      <div {...popoverProps} style={{ width: 224 }}>
        <button type="button" className={menuItemClass} onClick={run(onNew)}>
          <FilePlus2 className="size-4" aria-hidden />
          {t("studio.newBlank")}
        </button>
        <button type="button" className={menuItemClass} onClick={run(() => setTemplatesOpen(true))}>
          <LayoutTemplate className="size-4" aria-hidden />
          {t("studio.newFromTemplate")}
        </button>
        <div className="my-1 border-t border-border" />
        <button type="button" className={menuItemClass} onClick={run(duplicate)}>
          <Copy className="size-4" aria-hidden />
          {t("studio.duplicate")}
        </button>
      </div>
    </>
  );
}

/** Quick switcher between the most recently edited receipts on this device. */
export function RecentMenu() {
  const t = useT();
  const { triggerProps, popoverProps, close } = useAnchoredPopover({ align: "end", width: 288 });
  const receipts = useReceiptStore((s) => s.receipts);
  const activeId = useReceiptStore((s) => s.activeId);
  const openReceipt = useReceiptStore((s) => s.openReceipt);
  const replayPrint = useEditorStore((s) => s.replayPrint);
  const recent = Object.values(receipts)
    .filter((r) => r.id !== activeId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);

  return (
    <>
      <button
        {...triggerProps}
        type="button"
        aria-label={t("studio.recent")}
        title={t("studio.recent")}
        className="hidden rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground sm:inline-flex"
      >
        <Clock className="size-4" aria-hidden />
      </button>
      <div {...popoverProps} style={{ width: 288 }}>
        <p className={menuLabelClass}>{t("studio.recent")}</p>
        {recent.length === 0 && <p className="px-2.5 py-3 text-sm text-muted">{t("studio.recentEmpty")}</p>}
        {recent.map((r) => (
          <button
            key={r.id}
            type="button"
            className={menuItemClass}
            onClick={() => {
              close();
              openReceipt(r.id);
              replayPrint();
            }}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.draft.merchantName || t("list.untitled")}</span>
              <span className="block truncate text-xs text-muted">
                {r.draft.receiptNo} · {r.draft.receiptDate.slice(0, 10)}
              </span>
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {formatAmount(computeTotals(r.draft).payable, r.draft.currency)}
            </span>
          </button>
        ))}
        <div className="my-1 border-t border-border" />
        <Link href="/history" className={menuItemClass} onClick={close}>
          {t("studio.allReceipts")} →
        </Link>
      </div>
    </>
  );
}

"use client";

import { useEffect, useSyncExternalStore } from "react";

import { buttonStyles, Dialog } from "@/components/ui/dialog";
import { useT, type MessageKey } from "@/lib/i18n/messages";
import { exportActions, useEditorStore } from "@/lib/store/editor-store";
import { useReceiptStore } from "@/lib/store/receipt-store";

const noop = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** "⌘" on Apple devices, "Ctrl" elsewhere (read after hydration). */
function useModKey() {
  return useSyncExternalStore(noop, () => (isMac() ? "⌘" : "Ctrl"), () => "Ctrl");
}

function isTypingTarget(el: EventTarget | null) {
  return el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/**
 * Studio keyboard shortcuts. Undo/redo always act on the receipt (inputs are
 * controlled, so native field undo would fight the store anyway).
 */
export function useStudioShortcuts({ onNew }: { onNew: () => void }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const store = useReceiptStore.getState();

      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      } else if (mod && ((key === "z" && e.shiftKey) || key === "y")) {
        e.preventDefault();
        store.redo();
      } else if (mod && key === "s") {
        e.preventDefault();
        exportActions.png?.();
      } else if (mod && key === "p") {
        e.preventDefault();
        exportActions.print?.();
      } else if (e.altKey && key === "n") {
        e.preventDefault();
        onNew();
      } else if (e.key === "?" && !isTypingTarget(e.target)) {
        e.preventDefault();
        useEditorStore.getState().setShortcutsOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onNew]);
}

const LIST: { keys: (mod: string) => string[]; label: MessageKey }[] = [
  { keys: (m) => [m, "Z"], label: "shortcuts.undo" },
  { keys: (m) => [m, "Shift", "Z"], label: "shortcuts.redo" },
  { keys: (m) => [m, "S"], label: "shortcuts.export" },
  { keys: (m) => [m, "P"], label: "shortcuts.print" },
  { keys: () => ["Alt", "N"], label: "shortcuts.new" },
  { keys: () => ["?"], label: "shortcuts.help" },
];

export function ShortcutsDialog() {
  const t = useT();
  const mod = useModKey();
  const open = useEditorStore((s) => s.shortcutsOpen);
  const setOpen = useEditorStore((s) => s.setShortcutsOpen);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title={t("shortcuts.title")}
      actions={
        <button type="button" onClick={() => setOpen(false)} className={buttonStyles.secondary}>
          {t("common.done")}
        </button>
      }
    >
      <dl className="divide-y divide-border">
        {LIST.map(({ keys, label }) => (
          <div key={label} className="flex items-center justify-between py-2.5 text-sm">
            <dt>{t(label)}</dt>
            <dd className="flex gap-1">
              {keys(mod).map((k) => (
                <kbd
                  key={k}
                  className="min-w-7 rounded-md border border-border bg-surface-muted px-1.5 py-0.5 text-center font-mono text-xs shadow-[0_1px_0_var(--border)]"
                >
                  {k}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}

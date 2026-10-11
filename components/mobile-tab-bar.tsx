"use client";

import { Camera, FileUp, History, PenLine, Plus, X, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useT, type MessageKey } from "@/lib/i18n/messages";
import { useUiStore } from "@/lib/store/ui-store";

type Action = { key: string; icon: LucideIcon; label: MessageKey; hint: MessageKey; run?: () => void; href?: string };

/**
 * Phone-only bottom navigation with a big "+" in the middle, like a native
 * app. The "+" opens a sheet with every way to add spending.
 */
export function MobileTabBar({ current }: { current: "history" | "studio" }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const ui = useUiStore.getState;
  const actions: Action[] = [
    { key: "quick", icon: Zap, label: "quick.title", hint: "tab.quickHint", run: () => ui().setQuickAddOpen(true) },
    { key: "scan", icon: Camera, label: "scan.title", hint: "tab.scanHint", run: () => ui().openScan() },
    { key: "new", icon: PenLine, label: "studio.newReceipt", hint: "tab.newHint", href: "/studio" },
    { key: "import", icon: FileUp, label: "import.button", hint: "tab.importHint", run: () => ui().setImportOpen(true) },
  ];

  const tab = (href: string, key: "history" | "studio", Icon: LucideIcon, label: MessageKey) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className={`flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-medium ${
        current === key ? "text-foreground" : "text-muted"
      }`}
    >
      <Icon className="size-5" strokeWidth={current === key ? 2.25 : 1.75} aria-hidden />
      {t(label)}
    </Link>
  );

  return (
    <>
      <nav
        aria-label={t("nav.main")}
        className="mobile-tabbar fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg sm:hidden"
      >
        {tab("/history", "history", History, "nav.history")}
        <div className="flex flex-1 items-start justify-center">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("tab.add")}
            aria-haspopup="dialog"
            className="-mt-5 flex size-14 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-lg ring-4 ring-background transition-transform active:scale-95"
          >
            <Plus className="size-6" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
        {tab("/studio", "studio", PenLine, "nav.studio")}
      </nav>

      <dialog
        ref={sheetRef}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        aria-label={t("tab.add")}
        className="sheet mx-0 mt-auto mb-0 w-full max-w-none rounded-t-3xl border-t border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
      >
        <div className="px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-base font-semibold">{t("tab.add")}</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("common.close")} className="rounded-full p-1.5 text-muted hover:bg-surface-muted">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-2">
            {actions.map(({ key, icon: Icon, label, hint, run, href }) => {
              const body = (
                <>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-surface text-foreground shadow-sm ring-1 ring-border">
                    <Icon className={`size-5 ${key === "quick" ? "text-viz-accent" : ""}`} aria-hidden />
                  </span>
                  <span className="text-sm font-semibold">{t(label)}</span>
                  <span className="text-xs leading-snug text-muted">{t(hint)}</span>
                </>
              );
              const cls = "flex h-full flex-col items-start gap-1.5 rounded-2xl bg-surface-muted p-3.5 text-left active:scale-[0.98] transition-transform";
              return (
                <li key={key}>
                  {href ? (
                    <Link href={href} className={cls} onClick={() => setOpen(false)}>
                      {body}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={`${cls} w-full`}
                      onClick={() => {
                        setOpen(false);
                        run?.();
                      }}
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </dialog>
    </>
  );
}

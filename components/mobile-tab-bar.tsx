"use client";

import { Home, PenLine, Plus, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { useT, type MessageKey } from "@/lib/i18n/messages";
import { useUiStore } from "@/lib/store/ui-store";

/**
 * Phone-only bottom navigation, like a native app: Home, a big "+" that opens
 * Add expense straight away, and the receipt maker.
 */
export function MobileTabBar({ current }: { current: "history" | "studio" }) {
  const t = useT();

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
    <nav
      aria-label={t("nav.main")}
      className="mobile-tabbar fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg sm:hidden"
    >
      {tab("/history", "history", Home, "nav.history")}
      <div className="flex flex-1 items-start justify-center">
        <button
          type="button"
          onClick={() => useUiStore.getState().setQuickAddOpen(true)}
          aria-label={t("tab.add")}
          className="-mt-5 flex size-14 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-lg ring-4 ring-background transition-transform active:scale-95"
        >
          <Plus className="size-6" strokeWidth={2.5} aria-hidden />
        </button>
      </div>
      {tab("/studio", "studio", PenLine, "nav.studio")}
    </nav>
  );
}

"use client";

import { Home, PenLine, Zap } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AuthControl } from "@/components/auth/auth-control";
import { SyncPrompt } from "@/components/auth/sync-prompt";
import { BrandMark } from "@/components/brand-mark";
import { GlobalFeatures } from "@/components/global-features";
import { RemindersBell } from "@/components/reminders-bell";
import { SettingsMenu } from "@/components/settings-menu";
import { useT } from "@/lib/i18n/messages";
import { useUiStore } from "@/lib/store/ui-store";

const NAV = [
  { href: "/history", label: "nav.history", icon: Home, key: "history" },
  { href: "/studio", label: "nav.studio", icon: PenLine, key: "studio" },
] as const;

/** `tabBar`: the page shows the phone tab bar, so nav and Quick add move there on small screens. */
export function AppHeader({ section, actions, tabBar = false }: { section: "studio" | "history"; actions?: ReactNode; tabBar?: boolean }) {
  const t = useT();
  const setQuickAddOpen = useUiStore((s) => s.setQuickAddOpen);
  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur sm:px-4">
      <div className="flex min-w-0 items-center gap-1 sm:gap-3">
        <Link href="/history" aria-label={t("nav.home")} className="flex shrink-0 items-center gap-2 rounded-md p-1">
          <BrandMark className="size-6" />
          <span className="hidden font-mono text-sm font-bold tracking-tight md:inline">RyannReceipt</span>
        </Link>
        <nav aria-label={t("nav.main")} className={`flex items-center gap-0.5 ${tabBar ? "max-sm:hidden" : ""}`}>
          {NAV.map(({ href, label, icon: Icon, key }) => {
            const current = section === key;
            return (
              <Link
                key={key}
                href={href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                  current ? "bg-surface-muted font-medium text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-4" aria-hidden />
                <span className="hidden sm:inline">{t(label)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-0.5 sm:gap-1">
        <button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          aria-label={t("quick.title")}
          title={`${t("quick.title")} (Alt+Q)`}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground ring-1 ring-border hover:bg-surface-muted ${tabBar ? "max-sm:hidden" : ""}`}
        >
          <Zap className="size-4 text-viz-accent" aria-hidden />
          <span className="hidden sm:inline">{t("quick.title")}</span>
        </button>
        {actions}
        <RemindersBell />
        <SettingsMenu studio={section === "studio"} />
        <div aria-hidden className="mx-1 h-6 w-px bg-border" />
        <div data-guide="sign-in" className="rounded-full">
          <AuthControl />
        </div>
      </div>
      <SyncPrompt />
      <GlobalFeatures />
    </header>
  );
}

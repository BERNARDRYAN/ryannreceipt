"use client";

import { History, PenLine } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AuthControl } from "@/components/auth/auth-control";
import { SyncPrompt } from "@/components/auth/sync-prompt";
import { BrandMark } from "@/components/brand-mark";

const NAV = [
  { href: "/studio", label: "Studio", icon: PenLine, key: "studio" },
  { href: "/history", label: "History", icon: History, key: "history" },
] as const;

export function AppHeader({ section, actions }: { section: "studio" | "history"; actions?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-1 sm:gap-3">
        <Link href="/" aria-label="RyannReceipt home" className="flex shrink-0 items-center gap-2 rounded-md p-1">
          <BrandMark className="size-6" />
          <span className="hidden font-mono text-sm font-bold tracking-tight md:inline">RyannReceipt</span>
        </Link>
        <nav aria-label="Main" className="flex items-center">
          {NAV.map(({ href, label, icon: Icon, key }) => {
            const current = section === key;
            return (
              <Link
                key={key}
                href={href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  current ? "bg-surface-muted font-medium text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-4" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5">
        {actions}
        <div aria-hidden className="mx-0.5 h-6 w-px bg-border sm:mx-1" />
        <AuthControl />
      </div>
      <SyncPrompt />
    </header>
  );
}

"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";

import { useT } from "@/lib/i18n/messages";

export type Tool = { key: string; icon: LucideIcon; title: string; sub: string; onOpen: () => void };

/**
 * Tools that have nothing to show yet, folded into one compact card instead
 * of a stack of empty boxes. Choosing one opens it (or starts it).
 */
export function MoreTools({ tools }: { tools: Tool[] }) {
  const t = useT();
  if (tools.length === 0) return null;
  return (
    <section aria-labelledby="more-tools-heading" className="rounded-2xl border border-border bg-surface p-2">
      <h2 id="more-tools-heading" className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
        {t("tools.heading")}
      </h2>
      <ul>
        {tools.map(({ key, icon: Icon, title, sub, onOpen }) => (
          <li key={key}>
            <button
              type="button"
              onClick={onOpen}
              className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left hover:bg-surface-muted"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-foreground group-hover:bg-surface">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs leading-snug text-muted">{sub}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

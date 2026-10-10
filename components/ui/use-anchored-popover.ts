"use client";

import { useEffect, useId, useRef } from "react";

type Align = "start" | "end";

/**
 * Native `popover` positioned against its trigger (no CSS anchor positioning,
 * which Firefox lacks). Opens below the trigger, flipping above when there's
 * no room, and stays inside the viewport horizontally.
 */
export function useAnchoredPopover<T extends HTMLElement = HTMLButtonElement>({
  align = "end",
  width,
}: { align?: Align; width?: number } = {}) {
  const id = useId();
  const triggerRef = useRef<T>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pop = popoverRef.current;
    if (!pop) return;
    const place = (e: Event) => {
      if ((e as ToggleEvent).newState !== "open" || !triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      const w = width ?? (pop.offsetWidth || 240);
      const h = pop.offsetHeight || 200;
      const margin = 8;
      const below = r.bottom + 6 + h <= window.innerHeight - margin || r.top < h + margin;
      const left = align === "end" ? r.right - w : r.left;
      pop.style.top = `${below ? r.bottom + 6 : r.top - 6 - h}px`;
      pop.style.left = `${Math.min(Math.max(margin, left), window.innerWidth - w - margin)}px`;
    };
    pop.addEventListener("beforetoggle", place);
    return () => pop.removeEventListener("beforetoggle", place);
  }, [align, width]);

  const close = () => popoverRef.current?.hidePopover();

  return {
    id,
    triggerRef,
    popoverRef,
    close,
    triggerProps: { ref: triggerRef, popoverTarget: id } as const,
    popoverProps: {
      ref: popoverRef,
      id,
      popover: "auto" as const,
      className:
        "fixed inset-auto m-0 rounded-xl border border-border bg-surface p-1.5 text-foreground shadow-xl shadow-black/10",
    },
  };
}

export const menuItemClass =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-50";

export const menuLabelClass = "px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase";

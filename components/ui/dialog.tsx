"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Footer buttons. */
  actions?: ReactNode;
  size?: "md" | "lg";
  /** On phones, slide up from the bottom like a native sheet (centred on larger screens). */
  sheet?: boolean;
};

/** Modal built on native <dialog>: focus trap, Esc and inert background for free. */
export function Dialog({ open, onClose, title, description, children, actions, size = "md", sheet = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes.
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby={titleId}
      className={`m-auto w-[calc(100%-2rem)] ${
        size === "lg" ? "max-w-3xl" : "max-w-md"
      } max-h-[calc(100dvh-2rem)] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px] open:animate-[dialog-in_180ms_ease-out] ${
        sheet
          ? "max-sm:mt-auto max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[env(safe-area-inset-bottom)] max-sm:open:animate-[sheet-in_280ms_cubic-bezier(0.2,0.8,0.2,1)]"
          : ""
      }`}
    >
      <div className="space-y-3 p-5">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        {description && <div className="text-sm text-muted">{description}</div>}
        {children}
      </div>
      {actions && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{actions}</div>}
    </dialog>
  );
}

export const buttonStyles = {
  primary:
    "inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast hover:opacity-90 disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-foreground ring-1 ring-border hover:bg-surface-muted disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-1.5 rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50",
};

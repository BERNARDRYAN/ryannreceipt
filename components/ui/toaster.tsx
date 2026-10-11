"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useToastStore, type Toast } from "@/lib/store/toast-store";

const GAP = 8;
const HEIGHT = 48;

function ToastItem({ toast, depth, expanded }: { toast: Toast; depth: number; expanded: boolean }) {
  const dismiss = useToastStore((s) => s.dismiss);

  // Timers pause while the stack is open, so there's time to hit "Undo".
  useEffect(() => {
    if (expanded) return;
    const timer = window.setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, dismiss, expanded]);

  const Icon = toast.tone === "error" ? CircleAlert : toast.tone === "success" ? CircleCheck : null;
  // Collapsed: older toasts peek out above the newest one, slightly smaller.
  const transform = expanded
    ? `translateY(${-depth * (HEIGHT + GAP)}px)`
    : `translateY(${-depth * 10}px) scale(${1 - depth * 0.05})`;

  return (
    <li
      role={toast.tone === "error" ? "alert" : "status"}
      aria-hidden={!expanded && depth > 0 ? true : undefined}
      style={{ transform, zIndex: 10 - depth, opacity: depth > 2 ? 0 : 1 }}
      className="toast-in pointer-events-auto absolute right-0 bottom-0 flex w-full origin-bottom items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground shadow-lg transition-[transform,opacity] duration-300 ease-out sm:w-auto sm:min-w-80"
    >
      {Icon && (
        <Icon className={`size-4 shrink-0 ${toast.tone === "error" ? "text-danger" : "text-success"}`} aria-hidden />
      )}
      <span className={`min-w-0 flex-1 ${!expanded && depth > 0 ? "invisible" : ""}`}>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          tabIndex={!expanded && depth > 0 ? -1 : undefined}
          onClick={() => {
            toast.action?.onClick();
            dismiss(toast.id);
          }}
          className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold underline-offset-2 hover:underline"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        tabIndex={!expanded && depth > 0 ? -1 : undefined}
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-muted hover:bg-surface-muted hover:text-foreground"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}

/** Notifications stack like cards: the newest in front, hover or focus to fan them out. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const [hovered, setHovered] = useState(false);
  const expanded = hovered && toasts.length > 1;
  return (
    <ol
      aria-live="polite"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovered(false);
      }}
      style={{ height: toasts.length ? HEIGHT + (expanded ? (toasts.length - 1) * (HEIGHT + GAP) : (toasts.length - 1) * 10) : 0 }}
      className="toaster pointer-events-none fixed inset-x-4 z-50 sm:inset-x-auto sm:right-4 sm:w-96"
    >
      {toasts.map((t, i) => (
        <ToastItem key={t.id} toast={t} depth={toasts.length - 1 - i} expanded={expanded} />
      ))}
    </ol>
  );
}

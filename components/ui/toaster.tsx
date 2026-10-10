"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useEffect } from "react";

import { useToastStore, type Toast } from "@/lib/store/toast-store";

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, dismiss]);

  const Icon = toast.tone === "error" ? CircleAlert : toast.tone === "success" ? CircleCheck : null;

  return (
    <li
      role={toast.tone === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground shadow-lg sm:w-auto sm:min-w-72"
    >
      {Icon && (
        <Icon
          className={`size-4 shrink-0 ${toast.tone === "error" ? "text-danger" : "text-success"}`}
          aria-hidden
        />
      )}
      <span className="min-w-0 flex-1">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
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
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-muted hover:bg-surface-muted hover:text-foreground"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <ol
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </ol>
  );
}

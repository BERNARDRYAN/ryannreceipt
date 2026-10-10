"use client";

import { ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { AuthControl } from "@/components/auth/auth-control";
import { ExportBar } from "@/components/receipt/export-bar";
import { ReceiptCanvas } from "@/components/receipt/receipt-canvas";
import { ReceiptEditorForm } from "@/components/receipt/receipt-editor-form";
import { useReceiptStore } from "@/lib/store/receipt-store";

const persistApi = useReceiptStore.persist;

function useStoreHydrated() {
  return useSyncExternalStore(
    (onChange) => persistApi.onFinishHydration(onChange),
    () => persistApi.hasHydrated(),
    () => false,
  );
}

export function StudioClient() {
  const hydrated = useStoreHydrated();
  const draft = useReceiptStore((s) => s.draft);
  const reset = useReceiptStore((s) => s.reset);
  const paperRef = useRef<HTMLDivElement>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    void persistApi.rehydrate();
  }, []);

  function handleReset() {
    if (window.confirm("Start a new receipt? Your current draft will be replaced.")) reset();
  }

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            aria-label="Back to home"
            className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <p className="truncate font-mono text-sm font-bold tracking-tight">
            RyannReceipt <span className="font-normal text-muted">/ studio</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden text-xs text-muted sm:inline">Draft saved on this device</span>
          <button
            type="button"
            onClick={handleReset}
            disabled={!hydrated}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-40"
          >
            <RotateCcw className="size-4" aria-hidden />
            <span className="hidden sm:inline">New</span>
          </button>
          <ExportBar targetRef={paperRef} draft={draft} disabled={!hydrated} onError={setExportError} />
          <div aria-hidden className="mx-1 h-6 w-px bg-border" />
          <AuthControl />
        </div>
      </header>

      {exportError && (
        <p role="alert" className="border-b border-border bg-surface-muted px-4 py-2 text-sm">
          {exportError}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main
          aria-label="Receipt preview"
          className="flex justify-center overflow-auto bg-desk px-4 py-8 lg:order-2 lg:flex-1 lg:items-start lg:py-12"
        >
          {hydrated ? (
            <div className="receipt-shadow lg:[zoom:1.25]">
              <ReceiptCanvas ref={paperRef} draft={draft} />
            </div>
          ) : (
            <div aria-hidden className="h-[520px] w-[302px] animate-pulse rounded-sm bg-surface/40" />
          )}
        </main>

        <aside
          aria-label="Receipt editor"
          className="border-t border-border bg-surface lg:order-1 lg:w-[400px] lg:shrink-0 lg:overflow-y-auto lg:border-t-0 lg:border-r"
        >
          {hydrated ? <ReceiptEditorForm /> : <div className="h-96" />}
        </aside>
      </div>
    </div>
  );
}

"use client";

import { Cloud, CloudAlert, CloudUpload, HardDrive, LoaderCircle, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { ExportBar } from "@/components/receipt/export-bar";
import { ReceiptCanvas } from "@/components/receipt/receipt-canvas";
import { ReceiptEditorForm } from "@/components/receipt/receipt-editor-form";
import { useAuthStore } from "@/lib/store/auth-store";
import { useActiveDraft, useLibraryHydrated, useReceiptStore } from "@/lib/store/receipt-store";
import { toast } from "@/lib/store/toast-store";
import { pullReceipt } from "@/lib/sync/cloud";
import { useCloudAutosave, type SaveStatus } from "@/lib/sync/use-cloud-autosave";

const STATUS: Record<SaveStatus, { label: string; icon: typeof Cloud; spin?: boolean; tone?: string }> = {
  local: { label: "Saved on this device", icon: HardDrive },
  pending: { label: "Unsaved changes", icon: CloudUpload },
  saving: { label: "Saving…", icon: LoaderCircle, spin: true },
  saved: { label: "Saved to cloud", icon: Cloud },
  error: { label: "Sync failed, will retry", icon: CloudAlert, tone: "text-danger" },
};

function SaveIndicator({ status }: { status: SaveStatus }) {
  const { label, icon: Icon, spin, tone } = STATUS[status];
  return (
    <span role="status" className={`inline-flex items-center gap-1.5 px-1 text-xs ${tone ?? "text-muted"}`} title={label}>
      <Icon className={`size-3.5 ${spin ? "animate-spin" : ""}`} aria-hidden />
      <span className="hidden xl:inline">{label}</span>
      <span className="sr-only xl:hidden">{label}</span>
    </span>
  );
}

/** Open `/studio?id=<uuid>`: from the local library, else from the cloud. */
function useOpenFromQuery(hydrated: boolean) {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const authStatus = useAuthStore((s) => s.status);

  useEffect(() => {
    if (!hydrated || !id) return;
    const { receipts, openReceipt } = useReceiptStore.getState();
    if (receipts[id]) {
      openReceipt(id);
      router.replace("/studio");
      return;
    }
    if (authStatus === "loading") return;
    if (authStatus === "signed-out") {
      toast("Sign in to open receipts from your account.");
      router.replace("/studio");
      return;
    }
    let cancelled = false;
    pullReceipt(id)
      .then(() => {
        if (!cancelled) useReceiptStore.getState().openReceipt(id);
      })
      .catch(() => {
        if (!cancelled) toast("Couldn't open that receipt.", { tone: "error" });
      })
      .finally(() => {
        if (!cancelled) router.replace("/studio");
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, id, authStatus, router]);
}

export function StudioClient() {
  const hydrated = useLibraryHydrated();
  const draft = useActiveDraft();
  const newReceipt = useReceiptStore((s) => s.newReceipt);
  const paperRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const saveStatus = useCloudAutosave();
  useOpenFromQuery(hydrated);

  function handleNew() {
    const { activeId: previousId } = useReceiptStore.getState();
    const id = newReceipt();
    toast("Started a new receipt", {
      action: {
        label: "Undo",
        onClick: () => {
          const store = useReceiptStore.getState();
          store.openReceipt(previousId);
          store.deleteReceipt(id);
        },
      },
    });
  }

  const ready = hydrated && draft;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <AppHeader
        section="studio"
        actions={
          <>
            <SaveIndicator status={hydrated ? saveStatus : "local"} />
            <button
              type="button"
              onClick={handleNew}
              disabled={!ready}
              aria-label="New receipt"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-40"
            >
              <Plus className="size-4" aria-hidden />
              <span className="hidden md:inline">New</span>
            </button>
            {draft && <ExportBar targetRef={paperRef} draft={draft} disabled={!ready} />}
          </>
        }
      />

      {/* Phones/tablets: switch between editor and preview. */}
      <div
        role="tablist"
        aria-label="Studio view"
        className="sticky top-0 z-10 flex border-b border-border bg-surface px-3 py-2 lg:hidden"
      >
        <div className="flex w-full rounded-md bg-surface-muted p-0.5">
          {(["edit", "preview"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              aria-controls={`studio-${key}`}
              onClick={() => setTab(key)}
              className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === key ? "bg-surface text-foreground shadow-sm" : "text-muted"
              }`}
            >
              {key === "edit" ? "Edit" : "Preview"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main
          id="studio-preview"
          aria-label="Receipt preview"
          // Off-screen (not display:none) when hidden on phones, so export can still render it.
          className={`flex justify-center overflow-auto bg-desk px-4 py-8 lg:static lg:order-2 lg:flex-1 lg:items-start lg:py-12 ${
            tab === "preview" ? "flex-1" : "pointer-events-none fixed top-0 left-[-200vw] lg:pointer-events-auto"
          }`}
        >
          {ready ? (
            <div className="receipt-shadow lg:[zoom:1.25]">
              <ReceiptCanvas ref={paperRef} draft={draft} />
            </div>
          ) : (
            <div aria-hidden className="h-[520px] w-[302px] animate-pulse rounded-sm bg-surface/40" />
          )}
        </main>

        <aside
          id="studio-edit"
          aria-label="Receipt editor"
          className={`relative bg-surface lg:order-1 lg:block lg:w-105 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-border ${
            tab === "edit" ? "block" : "hidden"
          }`}
        >
          {ready ? <ReceiptEditorForm /> : <div className="h-96" />}
        </aside>
      </div>
    </div>
  );
}

"use client";

import { Cloud, CloudAlert, CloudUpload, HardDrive, LoaderCircle, PenLine, Receipt, Redo2, Undo2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { AppHeader } from "@/components/app-header";
import { ExportBar } from "@/components/receipt/export-bar";
import { StepEditor } from "@/components/receipt/step-editor";
import { PreviewStage } from "@/components/studio/preview-stage";
import { NewMenu, RecentMenu } from "@/components/studio/receipt-menus";
import { ShortcutsDialog, useStudioShortcuts } from "@/components/studio/shortcuts";
import { SignInBanner } from "@/components/studio/sign-in-banner";
import { TemplatePicker } from "@/components/studio/template-picker";
import { StudioTour } from "@/components/studio/tour";
import { useT, type MessageKey } from "@/lib/i18n/messages";
import { useAuthStore } from "@/lib/store/auth-store";
import { useEditorStore } from "@/lib/store/editor-store";
import { usePrefsHydrated, usePrefsStore } from "@/lib/store/prefs-store";
import { useActiveDraft, useLibraryHydrated, useReceiptStore } from "@/lib/store/receipt-store";
import { toast } from "@/lib/store/toast-store";
import { pullReceipt } from "@/lib/sync/cloud";
import { useCloudAutosave, type SaveStatus } from "@/lib/sync/use-cloud-autosave";

const STATUS: Record<SaveStatus, { label: MessageKey; icon: typeof Cloud; spin?: boolean; tone?: string }> = {
  local: { label: "save.local", icon: HardDrive },
  pending: { label: "save.pending", icon: CloudUpload },
  saving: { label: "save.saving", icon: LoaderCircle, spin: true },
  saved: { label: "save.saved", icon: Cloud },
  error: { label: "save.error", icon: CloudAlert, tone: "text-danger" },
};

function SaveIndicator({ status }: { status: SaveStatus }) {
  const t = useT();
  const { label, icon: Icon, spin, tone } = STATUS[status];
  return (
    <span
      role="status"
      className={`hidden items-center gap-1.5 px-1.5 text-xs sm:inline-flex ${tone ?? "text-muted"}`}
      title={t(label)}
    >
      <Icon className={`size-3.5 ${spin ? "animate-spin" : ""}`} aria-hidden />
      <span className="hidden 2xl:inline">{t(label)}</span>
      <span className="sr-only 2xl:hidden">{t(label)}</span>
    </span>
  );
}

function UndoRedo() {
  const t = useT();
  const canUndo = useReceiptStore((s) => s.past.length > 0);
  const canRedo = useReceiptStore((s) => s.future.length > 0);
  const undo = useReceiptStore((s) => s.undo);
  const redo = useReceiptStore((s) => s.redo);
  const btn = "rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-30";
  return (
    <span className="hidden items-center lg:flex">
      <button type="button" onClick={undo} disabled={!canUndo} aria-label={t("studio.undo")} title={t("studio.undo")} className={btn}>
        <Undo2 className="size-4" aria-hidden />
      </button>
      <button type="button" onClick={redo} disabled={!canRedo} aria-label={t("studio.redo")} title={t("studio.redo")} className={btn}>
        <Redo2 className="size-4" aria-hidden />
      </button>
    </span>
  );
}

/** Open `/studio?id=<uuid>`: from the local library, else from the cloud. */
function useOpenFromQuery(hydrated: boolean) {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const authStatus = useAuthStore((s) => s.status);

  useEffect(() => {
    if (!hydrated || !id) return;
    const { receipts, openReceipt } = useReceiptStore.getState();
    const { replayPrint } = useEditorStore.getState();
    if (receipts[id]) {
      openReceipt(id);
      replayPrint();
      router.replace("/studio");
      return;
    }
    if (authStatus === "loading") return;
    if (authStatus === "signed-out") {
      toast(t("studio.signInToOpen"));
      router.replace("/studio");
      return;
    }
    let cancelled = false;
    pullReceipt(id)
      .then(() => {
        if (cancelled) return;
        useReceiptStore.getState().openReceipt(id);
        replayPrint();
      })
      .catch(() => {
        if (!cancelled) toast(t("studio.openFailed"), { tone: "error" });
      })
      .finally(() => {
        if (!cancelled) router.replace("/studio");
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, id, authStatus, router, t]);
}

/** First visit: template gallery, then the three-step tour. */
function useFirstVisit(ready: boolean) {
  const prefsReady = usePrefsHydrated();
  const templatesSeen = usePrefsStore((s) => s.templatesSeen);
  const guideDone = usePrefsStore((s) => s.guideDone);
  const templatesOpen = useEditorStore((s) => s.templatesOpen);
  const tourStep = useEditorStore((s) => s.tourStep);

  useEffect(() => {
    if (!ready || !prefsReady) return;
    const editor = useEditorStore.getState();
    if (!templatesSeen) editor.setTemplatesOpen(true);
    else if (!guideDone && !templatesOpen && tourStep === null) {
      // Let the printer animation finish before the spotlight appears.
      const timer = window.setTimeout(() => useEditorStore.getState().setTourStep(0), 900);
      return () => window.clearTimeout(timer);
    }
  }, [ready, prefsReady, templatesSeen, guideDone, templatesOpen, tourStep]);
}

export function StudioClient() {
  const t = useT();
  const hydrated = useLibraryHydrated();
  const draft = useActiveDraft();
  const newReceipt = useReceiptStore((s) => s.newReceipt);
  const tab = useEditorStore((s) => s.mobileTab);
  const setTab = useEditorStore((s) => s.setMobileTab);
  const paperRef = useRef<HTMLDivElement>(null);
  const saveStatus = useCloudAutosave();
  const ready = !!(hydrated && draft);
  useOpenFromQuery(hydrated);
  useFirstVisit(ready);

  const handleNew = useCallback(() => {
    const store = useReceiptStore.getState();
    const previousId = store.activeId;
    const id = newReceipt();
    useEditorStore.getState().setStep("shop");
    useEditorStore.getState().replayPrint();
    toast(t("studio.started"), {
      action: {
        label: t("common.undo"),
        onClick: () => {
          const s = useReceiptStore.getState();
          s.openReceipt(previousId);
          s.deleteReceipt(id);
        },
      },
    });
  }, [newReceipt, t]);

  useStudioShortcuts({ onNew: handleNew });

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <AppHeader
        section="studio"
        actions={
          ready && (
            <>
              <UndoRedo />
              <SaveIndicator status={saveStatus} />
              <RecentMenu />
              <NewMenu onNew={handleNew} />
              <span className="hidden lg:flex">
                <ExportBar targetRef={paperRef} draft={draft} />
              </span>
            </>
          )
        }
      />
      <SignInBanner />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main
          id="studio-preview"
          aria-label={t("studio.preview")}
          // Off-screen (not display:none) when hidden on phones, so export can still render it.
          className={`desk-surface overflow-auto lg:static lg:order-2 lg:flex-1 ${
            tab === "preview" ? "flex-1 pb-16" : "pointer-events-none fixed top-0 left-[-200vw] lg:pointer-events-auto"
          }`}
        >
          {ready ? (
            <PreviewStage draft={draft} paperRef={paperRef} />
          ) : (
            <div className="flex justify-center pt-12">
              <div aria-hidden className="h-130 w-75.5 animate-pulse rounded-sm bg-surface/40" />
            </div>
          )}
        </main>

        <aside
          id="studio-edit"
          aria-label={t("studio.editor")}
          data-guide="editor"
          className={`relative bg-surface pb-16 lg:order-1 lg:block lg:w-110 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-border lg:pb-0 ${
            tab === "edit" ? "block" : "hidden"
          }`}
        >
          {ready ? <StepEditor /> : <div className="h-96" />}
        </aside>
      </div>

      {/* Phones/tablets: tabs and export where thumbs reach. */}
      <nav
        aria-label={t("studio.view")}
        className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-border bg-surface/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      >
        <div role="tablist" className="flex flex-1 rounded-xl bg-surface-muted p-1">
          {(["edit", "preview"] as const).map((key) => {
            const Icon = key === "edit" ? PenLine : Receipt;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                aria-controls={`studio-${key}`}
                data-guide={key === "preview" ? "preview-tab" : undefined}
                onClick={() => setTab(key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  tab === key ? "bg-surface text-foreground shadow-sm" : "text-muted"
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {key === "edit" ? t("studio.tabEdit") : t("studio.tabPreview")}
              </button>
            );
          })}
        </div>
        {ready && <ExportBar targetRef={paperRef} draft={draft} primary={false} variant="bar" />}
      </nav>

      {hydrated && (
        <>
          <TemplatePicker />
          <ShortcutsDialog />
          <StudioTour />
        </>
      )}
    </div>
  );
}

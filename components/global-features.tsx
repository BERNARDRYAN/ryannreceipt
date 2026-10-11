"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import { QuickAddDialog } from "@/components/quick-add/quick-add-dialog";
import { useRecurringRunner } from "@/lib/recurring/use-recurring-runner";
import { useLibraryHydrated } from "@/lib/store/receipt-store";
import { useUiStore } from "@/lib/store/ui-store";
import { useSettingsSync } from "@/lib/sync/use-settings-sync";

// Browser-only: keeps the OCR engine (Tesseract.js) out of the server bundle,
// which matters for the 3 MB Cloudflare Workers free-plan limit.
const ScanDialog = dynamic(() => import("@/components/scan/scan-dialog").then((m) => m.ScanDialog), {
  ssr: false,
});

export const SHARE_CACHE = "rr-share";
export const SHARED_FILE_PATH = "/__shared-receipt";

/**
 * Features available on every app page: Quick Add (Alt+Q), the receipt
 * scanner, settings sync, recurring expenses, and receiving photos from the
 * phone's share sheet (see public/sw.js).
 */
export function GlobalFeatures() {
  const hydrated = useLibraryHydrated();
  useSettingsSync();
  useRecurringRunner();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key.toLowerCase() === "q") {
        e.preventDefault();
        useUiStore.getState().setQuickAddOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Opened from the share sheet: the service worker stashed the photo in Cache Storage.
  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("scan") === null) return;
    const shared = params.get("scan") === "shared";
    params.delete("scan");
    const clean = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
    window.history.replaceState(null, "", clean);

    (async () => {
      let file: File | null = null;
      if (shared && "caches" in window) {
        const cache = await caches.open(SHARE_CACHE);
        const res = await cache.match(SHARED_FILE_PATH);
        if (res) {
          const blob = await res.blob();
          file = new File([blob], "shared-receipt", { type: blob.type || "image/jpeg" });
          await cache.delete(SHARED_FILE_PATH);
        }
      }
      useUiStore.getState().openScan(file);
    })();
  }, [hydrated]);

  return (
    <>
      <QuickAddDialog />
      <ScanDialog />
    </>
  );
}

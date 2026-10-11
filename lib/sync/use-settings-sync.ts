"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/lib/store/auth-store";
import { settingsSnapshot, useSettingsHydrated, useSettingsStore } from "@/lib/store/settings-store";
import { useSyncState } from "@/lib/sync/cloud";
import type { UserSettings } from "@/lib/validators/receipt-schema";

const PUSH_DELAY_MS = 1500;

async function pushSettings(settings: UserSettings) {
  await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}

/**
 * Keep budgets and recurring expenses in sync across devices while signed in:
 * on sign-in the newer copy wins (cloud vs this device), then local changes
 * are pushed shortly after they happen.
 */
export function useSettingsSync() {
  const signedIn = useAuthStore((s) => s.status === "signed-in");
  const hydrated = useSettingsHydrated();

  useEffect(() => {
    if (!signedIn || !hydrated) return;
    let cancelled = false;
    let timer: number | undefined;
    let ready = false;

    fetch("/api/settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(({ settings }: { settings: UserSettings | null }) => {
        if (cancelled) return;
        const local = settingsSnapshot();
        if (settings && settings.updatedAt > local.updatedAt) useSettingsStore.getState().replaceFromCloud(settings);
        else if (!settings || local.updatedAt > settings.updatedAt) void pushSettings(local);
        ready = true;
      })
      .catch(() => {
        // Offline or not migrated yet: keep working locally.
      })
      .finally(() => {
        if (!cancelled) useSyncState.getState().set({ settingsChecked: true });
      });

    const unsubscribe = useSettingsStore.subscribe((state, prev) => {
      if (!ready || state.updatedAt === prev.updatedAt) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void pushSettings(settingsSnapshot()).catch(() => undefined), PUSH_DELAY_MS);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [signedIn, hydrated]);
}

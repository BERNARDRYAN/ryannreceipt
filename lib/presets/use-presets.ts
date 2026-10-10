"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuthStore } from "@/lib/store/auth-store";
import { useReceiptStore } from "@/lib/store/receipt-store";
import type { Preset, PresetInput } from "@/lib/validators/receipt-schema";

/**
 * Merchant presets. Signed-in users keep them in Supabase (via /api/presets);
 * guests keep them in the local store. Same interface either way.
 */
export function usePresets() {
  const status = useAuthStore((s) => s.status);
  const localPresets = useReceiptStore((s) => s.presets);
  const addLocal = useReceiptStore((s) => s.addLocalPreset);
  const removeLocal = useReceiptStore((s) => s.removeLocalPreset);
  const [cloudPresets, setCloudPresets] = useState<Preset[] | null>(null);
  const signedIn = status === "signed-in";

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetch("/api/presets", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(({ presets }: { presets: Preset[] }) => {
        if (!cancelled) setCloudPresets(presets);
      })
      .catch(() => {
        if (!cancelled) setCloudPresets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const save = useCallback(
    async (preset: PresetInput) => {
      if (!signedIn) return addLocal(preset);
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preset),
      });
      if (!res.ok) throw new Error("Couldn't save preset");
      const { preset: created } = (await res.json()) as { preset: Preset };
      setCloudPresets((prev) => [...(prev ?? []), created]);
    },
    [signedIn, addLocal],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!signedIn) return removeLocal(id);
      const res = await fetch(`/api/presets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't delete preset");
      setCloudPresets((prev) => (prev ?? []).filter((p) => p.id !== id));
    },
    [signedIn, removeLocal],
  );

  return {
    presets: signedIn ? (cloudPresets ?? []) : localPresets,
    loading: signedIn && cloudPresets === null,
    cloud: signedIn,
    save,
    remove,
  };
}

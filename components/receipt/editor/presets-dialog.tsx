"use client";

import { Cloud, HardDrive, Trash2 } from "lucide-react";
import { useState } from "react";

import { inputClass } from "@/components/receipt/editor/fields";
import { buttonStyles, Dialog } from "@/components/ui/dialog";
import { usePresets } from "@/lib/presets/use-presets";
import { useActiveDraft, useReceiptStore } from "@/lib/store/receipt-store";
import { toast } from "@/lib/store/toast-store";

export function PresetsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const draft = useActiveDraft();
  const applyPreset = useReceiptStore((s) => s.applyPreset);
  const { presets, loading, cloud, save, remove } = usePresets();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!draft || !name.trim()) return;
    setSaving(true);
    try {
      await save({
        name: name.trim(),
        merchantName: draft.merchantName,
        merchantAddress: draft.merchantAddress,
        merchantPhone: draft.merchantPhone,
        currency: draft.currency,
        styleConfig: draft.styleConfig,
      });
      setName("");
      toast("Preset saved", { tone: "success" });
    } catch {
      toast("Couldn't save the preset. Try again.", { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await remove(id);
    } catch {
      toast("Couldn't delete the preset.", { tone: "error" });
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Merchant presets"
      description={
        <span className="inline-flex items-center gap-1.5">
          {cloud ? <Cloud className="size-3.5" aria-hidden /> : <HardDrive className="size-3.5" aria-hidden />}
          {cloud ? "Synced to your account." : "Saved on this device. Sign in to sync them."}
        </span>
      }
      actions={
        <button type="button" onClick={onClose} className={buttonStyles.secondary}>
          Done
        </button>
      }
    >
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {loading && <p className="py-3 text-center text-sm text-muted">Loading…</p>}
        {!loading && presets.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted">
            No presets yet. Save the current merchant, logo and paper style below.
          </p>
        )}
        {presets.map((preset) => (
          <div key={preset.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-muted">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{preset.name}</p>
              <p className="truncate text-xs text-muted">
                {preset.merchantName || "No merchant"} · {preset.currency}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                applyPreset(preset);
                toast(`Applied “${preset.name}”`);
                onClose();
              }}
              className={buttonStyles.secondary}
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => handleRemove(preset.id)}
              aria-label={`Delete preset ${preset.name}`}
              className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-foreground"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
        className="flex gap-2 border-t border-border pt-3"
      >
        <input
          aria-label="New preset name"
          placeholder="Name, e.g. Kopitiam KL"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <button type="submit" disabled={!name.trim() || saving} className={`${buttonStyles.primary} shrink-0`}>
          Save current
        </button>
      </form>
    </Dialog>
  );
}

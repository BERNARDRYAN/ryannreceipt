"use client";

import { Cloud, HardDrive, Trash2 } from "lucide-react";
import { useState } from "react";

import { inputClass } from "@/components/receipt/editor/fields";
import { buttonStyles, Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/messages";
import { usePresets } from "@/lib/presets/use-presets";
import { useActiveDraft, useReceiptStore } from "@/lib/store/receipt-store";
import { toast } from "@/lib/store/toast-store";

export function PresetsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
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
      toast(t("presets.saved"), { tone: "success" });
    } catch {
      toast(t("presets.saveFailed"), { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await remove(id);
    } catch {
      toast(t("presets.deleteFailed"), { tone: "error" });
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("presets.title")}
      description={
        <span className="inline-flex items-center gap-1.5">
          {cloud ? <Cloud className="size-3.5" aria-hidden /> : <HardDrive className="size-3.5" aria-hidden />}
          {cloud ? t("presets.cloud") : t("presets.local")}
        </span>
      }
      actions={
        <button type="button" onClick={onClose} className={buttonStyles.secondary}>
          {t("common.done")}
        </button>
      }
    >
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {loading && <p className="py-3 text-center text-sm text-muted">{t("common.loading")}</p>}
        {!loading && presets.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted">
            {t("presets.empty")}
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
                toast(t("presets.applied", { name: preset.name }));
                onClose();
              }}
              className={buttonStyles.secondary}
            >
              {t("presets.apply")}
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
          placeholder={t("presets.namePh")}
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <button type="submit" disabled={!name.trim() || saving} className={`${buttonStyles.primary} shrink-0`}>
          {t("presets.save")}
        </button>
      </form>
    </Dialog>
  );
}

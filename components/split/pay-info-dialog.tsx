"use client";

import { useState } from "react";

import { inputClass } from "@/components/receipt/editor/fields";
import { buttonStyles, Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/messages";
import { payInfoLine } from "@/lib/split/message";
import { useSettingsStore } from "@/lib/store/settings-store";
import { useUiStore } from "@/lib/store/ui-store";
import type { PayInfo } from "@/lib/validators/receipt-schema";

function PayInfoForm({ onClose }: { onClose: () => void }) {
  const t = useT();
  const current = useSettingsStore((s) => s.payInfo);
  const setPayInfo = useSettingsStore((s) => s.setPayInfo);
  const [info, setInfo] = useState<PayInfo>(current);
  const field = (key: keyof PayInfo, label: string, placeholder: string) => (
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium text-muted">{label}</span>
      <input
        className={inputClass}
        value={info[key]}
        maxLength={key === "note" ? 120 : key === "name" ? 60 : 40}
        placeholder={placeholder}
        onChange={(e) => setInfo((i) => ({ ...i, [key]: e.target.value }))}
      />
    </label>
  );
  const preview = payInfoLine(info);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setPayInfo(info);
        onClose();
      }}
      className="space-y-3"
    >
      {field("duitnow", t("pay.duitnow"), "012-345 6789")}
      <div className="grid grid-cols-2 gap-3">
        {field("bank", t("pay.bank"), "Maybank")}
        {field("account", t("pay.account"), "1234 5678 9012")}
      </div>
      {field("name", t("pay.name"), "Ryan Sim")}
      {field("note", t("pay.note"), t("pay.notePh"))}
      {preview && (
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted">
          {t("split.msgPayMe", { info: preview })}
        </p>
      )}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <button type="button" onClick={onClose} className={buttonStyles.ghost}>
          {t("common.cancel")}
        </button>
        <button type="submit" className={buttonStyles.primary}>
          {t("common.save")}
        </button>
      </div>
    </form>
  );
}

/** Optional details friends use to pay you back (shown in split-bill messages). */
export function PayInfoDialog() {
  const t = useT();
  const open = useUiStore((s) => s.payInfoOpen);
  const setOpen = useUiStore((s) => s.setPayInfoOpen);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t("pay.title")} description={t("pay.body")}>
      {open && <PayInfoForm onClose={() => setOpen(false)} />}
    </Dialog>
  );
}

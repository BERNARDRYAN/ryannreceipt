"use client";

import { Fingerprint, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { inputClass, Toggle } from "@/components/receipt/editor/fields";
import { buttonStyles, Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/messages";
import { biometricAvailable, hashPin, registerBiometric, verifyPin } from "@/lib/lock/crypto";
import { LOCK_OFF, usePrefsStore } from "@/lib/store/prefs-store";
import { toast } from "@/lib/store/toast-store";
import { useUiStore } from "@/lib/store/ui-store";

const TIMEOUTS = [0, 1, 5, 15];

function PinInput({ label, value, onChange, autoFocus }: { label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium text-muted">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className={`${inputClass} text-center font-mono text-lg tracking-[0.5em]`}
      />
    </label>
  );
}

function LockSettings({ onClose }: { onClose: () => void }) {
  const t = useT();
  const lock = usePrefsStore((s) => s.lock);
  const setLock = usePrefsStore((s) => s.setLock);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [current, setCurrent] = useState("");
  const [canBio, setCanBio] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void biometricAvailable().then((ok) => {
      if (!cancelled) setCanBio(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (pin.length < 4 || pin !== confirm) return;
    setBusy(true);
    const { salt, hash } = await hashPin(pin);
    setLock({ ...lock, enabled: true, salt, hash, pinLength: pin.length });
    // Already unlocked in this session; don't lock the person out immediately.
    sessionStorage.setItem("rr:unlocked", "1");
    setBusy(false);
    toast(t("lock.enabled"), { tone: "success" });
    onClose();
  }

  async function disable() {
    setBusy(true);
    const ok = await verifyPin(current, lock.salt, lock.hash);
    setBusy(false);
    if (!ok) {
      toast(t("lock.wrong"), { tone: "error" });
      return;
    }
    setLock(LOCK_OFF);
    toast(t("lock.disabled"));
    onClose();
  }

  async function toggleBiometric(on: boolean) {
    if (!on) {
      setLock({ ...lock, biometricId: "" });
      return;
    }
    const id = await registerBiometric();
    if (id) setLock({ ...lock, biometricId: id });
    else toast(t("lock.bioFailed"), { tone: "error" });
  }

  const timeoutPicker = (
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium text-muted">{t("lock.after")}</span>
      <select
        className={inputClass}
        value={lock.timeoutMin}
        onChange={(e) => setLock({ ...lock, timeoutMin: Number(e.target.value) })}
      >
        {TIMEOUTS.map((m) => (
          <option key={m} value={m}>
            {m === 0 ? t("lock.immediately") : t("lock.minutes", { n: m })}
          </option>
        ))}
      </select>
    </label>
  );

  if (!lock.enabled) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enable();
        }}
        className="space-y-3"
      >
        <PinInput label={t("lock.newPin")} value={pin} onChange={setPin} autoFocus />
        <PinInput label={t("lock.confirmPin")} value={confirm} onChange={setConfirm} />
        {confirm.length >= 4 && pin !== confirm && <p className="text-xs text-danger">{t("lock.mismatch")}</p>}
        {timeoutPicker}
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("lock.privacyNote")}
        </p>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" onClick={onClose} className={buttonStyles.ghost}>
            {t("common.cancel")}
          </button>
          <button type="submit" disabled={busy || pin.length < 4 || pin !== confirm} className={buttonStyles.primary}>
            {t("lock.turnOn")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      {timeoutPicker}
      {canBio && (
        <div className="flex items-center gap-2">
          <Fingerprint className="size-4 shrink-0 text-muted" aria-hidden />
          <div className="flex-1">
            <Toggle label={t("lock.useBiometric")} checked={!!lock.biometricId} onChange={(v) => void toggleBiometric(v)} />
          </div>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void disable();
        }}
        className="space-y-3 border-t border-border pt-3"
      >
        <PinInput label={t("lock.currentPin")} value={current} onChange={setCurrent} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonStyles.ghost}>
            {t("common.done")}
          </button>
          <button type="submit" disabled={busy || current.length < 4} className={buttonStyles.danger}>
            {t("lock.turnOff")}
          </button>
        </div>
      </form>
    </div>
  );
}

export function LockSettingsDialog() {
  const t = useT();
  const open = useUiStore((s) => s.lockSettingsOpen);
  const setOpen = useUiStore((s) => s.setLockSettingsOpen);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t("lock.settingsTitle")} description={t("lock.settingsBody")}>
      {open && <LockSettings onClose={() => setOpen(false)} />}
    </Dialog>
  );
}

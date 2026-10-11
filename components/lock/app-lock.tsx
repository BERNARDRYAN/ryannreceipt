"use client";

import { Delete, Fingerprint, LockKeyhole } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { useT } from "@/lib/i18n/messages";
import { verifyBiometric, verifyPin } from "@/lib/lock/crypto";
import { usePrefsHydrated, usePrefsStore } from "@/lib/store/prefs-store";

const UNLOCKED_KEY = "rr:unlocked";
const HIDDEN_AT_KEY = "rr:hidden-at";
const MAX_TRIES = 5;
const LOCKOUT_MS = 30_000;

function sessionGet(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function sessionSet(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // private mode: lock still works for this page
  }
}

/**
 * Full-screen PIN / biometric lock. Locks on a fresh visit and after the app
 * has been in the background longer than the chosen timeout. The boot script
 * hides the page before React runs (html[data-locked]), so nothing flashes.
 */
export function AppLock() {
  const t = useT();
  const hydrated = usePrefsHydrated();
  const lock = usePrefsStore((s) => s.lock);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [tries, setTries] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [checking, setChecking] = useState(false);
  const biometricTried = useRef(false);

  const unlock = useCallback(() => {
    sessionSet(UNLOCKED_KEY, "1");
    delete document.documentElement.dataset.locked;
    setLocked(false);
    setPin("");
    setTries(0);
    biometricTried.current = false;
  }, []);

  const relock = useCallback(() => {
    sessionSet(UNLOCKED_KEY, null);
    document.documentElement.dataset.locked = "1";
    setLocked(true);
  }, []);

  // Decide on load: lock if enabled and not unlocked this session.
  useEffect(() => {
    if (!hydrated) return;
    if (!lock.enabled) {
      delete document.documentElement.dataset.locked;
      return;
    }
    if (sessionGet(UNLOCKED_KEY) !== "1") void Promise.resolve().then(relock);
  }, [hydrated, lock.enabled, relock]);

  // Re-lock after being in the background too long.
  useEffect(() => {
    if (!lock.enabled) return;
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        sessionSet(HIDDEN_AT_KEY, String(Date.now()));
      } else {
        const hiddenAt = Number(sessionGet(HIDDEN_AT_KEY) ?? 0);
        if (hiddenAt && Date.now() - hiddenAt >= lock.timeoutMin * 60_000) relock();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [lock.enabled, lock.timeoutMin, relock]);

  const tryBiometric = useCallback(async () => {
    if (!lock.biometricId) return;
    if (await verifyBiometric(lock.biometricId)) unlock();
  }, [lock.biometricId, unlock]);

  // Offer biometrics once automatically when the lock appears.
  useEffect(() => {
    if (!locked || !lock.biometricId || biometricTried.current) return;
    biometricTried.current = true;
    void tryBiometric();
  }, [locked, lock.biometricId, tryBiometric]);

  const submit = useCallback(
    async (candidate: string) => {
      if (waiting) return;
      setChecking(true);
      const ok = await verifyPin(candidate, lock.salt, lock.hash);
      setChecking(false);
      if (ok) {
        unlock();
        return;
      }
      const next = tries + 1;
      setTries(next);
      setError(true);
      setPin("");
      if (next >= MAX_TRIES) {
        setWaiting(true);
        setTries(0);
        window.setTimeout(() => setWaiting(false), LOCKOUT_MS);
      }
      window.setTimeout(() => setError(false), 500);
    },
    [lock.salt, lock.hash, waiting, tries, unlock],
  );

  const press = useCallback(
    (digit: string) => {
      if (checking || waiting || pin.length >= lock.pinLength) return;
      const next = pin + digit;
      setPin(next);
      if (next.length === lock.pinLength) void submit(next);
    },
    [checking, waiting, lock.pinLength, pin, submit],
  );

  // Physical keyboard support.
  useEffect(() => {
    if (!locked) return;
    function onKey(e: KeyboardEvent) {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, press]);

  if (!locked) return null;

  return (
    <div
      data-app-lock
      role="dialog"
      aria-modal="true"
      aria-label={t("lock.title")}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-background px-6 text-foreground"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandMark className="size-12" />
        <p className="inline-flex items-center gap-1.5 text-lg font-semibold">
          <LockKeyhole className="size-4" aria-hidden />
          {t("lock.title")}
        </p>
        <p className="text-sm text-muted" aria-live="polite">
          {waiting ? t("lock.wait") : error ? t("lock.wrong") : t("lock.enterPin")}
        </p>
      </div>

      <div className={`flex gap-3 ${error ? "animate-[shake_400ms_ease-in-out]" : ""}`} aria-hidden>
        {Array.from({ length: lock.pinLength }, (_, i) => (
          <span
            key={i}
            className={`size-3.5 rounded-full transition-colors ${i < pin.length ? "bg-foreground" : "bg-border"}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            disabled={waiting}
            className="flex size-16 items-center justify-center rounded-full bg-surface text-2xl font-medium shadow-sm ring-1 ring-border transition-transform active:scale-95 disabled:opacity-40"
          >
            {d}
          </button>
        ))}
        {lock.biometricId ? (
          <button
            type="button"
            onClick={() => void tryBiometric()}
            aria-label={t("lock.biometric")}
            className="flex size-16 items-center justify-center rounded-full text-muted hover:text-foreground"
          >
            <Fingerprint className="size-7" aria-hidden />
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => press("0")}
          disabled={waiting}
          className="flex size-16 items-center justify-center rounded-full bg-surface text-2xl font-medium shadow-sm ring-1 ring-border transition-transform active:scale-95 disabled:opacity-40"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => setPin((p) => p.slice(0, -1))}
          aria-label={t("lock.delete")}
          className="flex size-16 items-center justify-center rounded-full text-muted hover:text-foreground"
        >
          <Delete className="size-6" aria-hidden />
        </button>
      </div>
    </div>
  );
}

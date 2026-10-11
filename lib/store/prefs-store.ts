"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Locale } from "@/lib/i18n/messages";
import type { Currency } from "@/lib/validators/receipt-schema";

export type ThemeChoice = "system" | "light" | "dark";

/** Device-only app lock (never synced). */
export type LockPrefs = {
  enabled: boolean;
  salt: string;
  hash: string;
  pinLength: number;
  /** WebAuthn credential id for fingerprint/face unlock ("" = off). */
  biometricId: string;
  /** Lock again after the app has been in the background this long. */
  timeoutMin: number;
};

export const LOCK_OFF: LockPrefs = { enabled: false, salt: "", hash: "", pinLength: 4, biometricId: "", timeoutMin: 1 };

export const PREFS_KEY = "ryannreceipt:prefs";

type PrefsStore = {
  locale: Locale;
  theme: ThemeChoice;
  /** First-visit studio guide finished or skipped. */
  guideDone: boolean;
  /** Template picker shown on first studio visit. */
  templatesSeen: boolean;
  signInBannerDismissed: boolean;
  /** Monthly spending budget per currency (History). */
  budgets: Partial<Record<Currency, number>>;
  /** Last sequential receipt number issued on this device. */
  lastSerial: number;
  lock: LockPrefs;
  setLock: (lock: LockPrefs) => void;
  /** When this device last downloaded a backup ("" = never). */
  lastBackupAt: string;
  setLastBackupAt: (iso: string) => void;
  /** Repeating-bill suggestions the user said no to (detect.ts keys). */
  dismissedRepeats: string[];
  dismissRepeat: (key: string) => void;

  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemeChoice) => void;
  setGuideDone: (done: boolean) => void;
  setTemplatesSeen: () => void;
  dismissSignInBanner: () => void;
  setBudget: (currency: Currency, amount: number | null) => void;
  /** Next number in the device's sequence, e.g. 125 -> "RR-000125". */
  nextSerial: () => number;
};

/** Pick the UI language from the browser on first visit. */
function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("zh")) return "zh";
  if (lang.startsWith("ms") || lang.startsWith("id")) return "ms";
  return "en";
}

export const usePrefsStore = create<PrefsStore>()(
  persist(
    (set, get) => ({
      locale: "en",
      theme: "system",
      guideDone: false,
      templatesSeen: false,
      signInBannerDismissed: false,
      budgets: {},
      lastSerial: 0,
      lock: LOCK_OFF,
      setLock: (lock) => set({ lock }),
      lastBackupAt: "",
      setLastBackupAt: (lastBackupAt) => set({ lastBackupAt }),
      dismissedRepeats: [],
      dismissRepeat: (key) => set((s) => ({ dismissedRepeats: [key, ...s.dismissedRepeats.filter((k) => k !== key)].slice(0, 50) })),

      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
      setGuideDone: (guideDone) => set({ guideDone }),
      setTemplatesSeen: () => set({ templatesSeen: true }),
      dismissSignInBanner: () => set({ signInBannerDismissed: true }),
      setBudget: (currency, amount) =>
        set((s) => {
          const budgets = { ...s.budgets };
          if (amount && amount > 0) budgets[currency] = amount;
          else delete budgets[currency];
          return { budgets };
        }),
      nextSerial: () => {
        // Start somewhere that looks like a shop that's been open a while.
        const next = (get().lastSerial || 100) + 1;
        set({ lastSerial: next });
        return next;
      },
    }),
    {
      name: PREFS_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ locale, theme, guideDone, templatesSeen, signInBannerDismissed, budgets, lastSerial, lock, lastBackupAt, dismissedRepeats }) => ({
        locale,
        theme,
        guideDone,
        templatesSeen,
        signInBannerDismissed,
        budgets,
        lastSerial,
        lock,
        lastBackupAt,
        dismissedRepeats,
      }),
      // First visit: nothing stored yet, so adopt the browser language.
      merge: (persisted, current) =>
        persisted ? { ...current, ...(persisted as object) } : { ...current, locale: detectLocale() },
      skipHydration: true,
    },
  ),
);

const persistApi = usePrefsStore.persist;
const subscribe = (cb: () => void) => persistApi.onFinishHydration(cb);

/** True once prefs are loaded from localStorage (false on the server). */
export function usePrefsHydrated() {
  return useSyncExternalStore(subscribe, () => persistApi.hasHydrated(), () => false);
}

/**
 * Mounted once in the root layout: loads prefs, then keeps <html lang> and
 * data-theme in sync. (An inline script applies the theme before first paint.)
 */
export function PrefsSync() {
  const locale = usePrefsStore((s) => s.locale);
  const theme = usePrefsStore((s) => s.theme);
  const hydrated = usePrefsHydrated();

  useEffect(() => {
    if (!persistApi.hasHydrated()) void persistApi.rehydrate();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.lang = locale === "zh" ? "zh-Hans" : locale;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [hydrated, locale, theme]);

  return null;
}

/**
 * Runs before React: applies the theme (no light/dark flash) and, if the app
 * lock is on, hides the page until the lock screen takes over. Tiny and
 * dependency-free on purpose.
 */
export const themeBootScript = `try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  PREFS_KEY,
)})||"{}");var s=p.state||{};var t=s.theme;if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;if(s.lock&&s.lock.enabled&&sessionStorage.getItem("rr:unlocked")!=="1")document.documentElement.dataset.locked="1"}catch(e){}`;

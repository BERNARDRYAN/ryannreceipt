"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { PREFS_KEY } from "@/lib/store/prefs-store";
import type { Category, Currency, RecurringRule, UserSettings } from "@/lib/validators/receipt-schema";

const nowIso = () => new Date().toISOString();

type SettingsStore = UserSettings & {
  setBudget: (currency: Currency, amount: number | null) => void;
  setCategoryBudget: (currency: Currency, category: Category, amount: number | null) => void;
  upsertRule: (rule: RecurringRule) => void;
  removeRule: (id: string) => void;
  markRuleRun: (id: string, date: string) => void;
  /** Remember people from split bills (most recent first, deduped by name). */
  rememberFriends: (people: { id: string; name: string }[]) => void;
  setPayInfo: (info: UserSettings["payInfo"]) => void;
  setHomeCurrency: (currency: Currency) => void;
  /** Adopt a newer copy from the cloud without bumping updatedAt. */
  replaceFromCloud: (settings: UserSettings) => void;
};

export const EMPTY_PAY_INFO = { duitnow: "", bank: "", account: "", name: "", note: "" };

export const EMPTY_SETTINGS: UserSettings = {
  budgets: {},
  categoryBudgets: {},
  recurring: [],
  friends: [],
  payInfo: EMPTY_PAY_INFO,
  homeCurrency: "MYR",
  updatedAt: "1970-01-01T00:00:00.000Z",
};

/** Budgets used to live in device prefs; carry them over once. */
function legacyBudgets(): UserSettings["budgets"] {
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    const budgets = prefs?.state?.budgets;
    return budgets && typeof budgets === "object" ? budgets : {};
  } catch {
    return {};
  }
}

/**
 * Settings that follow the user across devices when signed in (see
 * useSettingsSync). Stored locally first, so guests get them too.
 */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...EMPTY_SETTINGS,
      setBudget: (currency, amount) =>
        set((s) => {
          const budgets = { ...s.budgets };
          if (amount && amount > 0) budgets[currency] = amount;
          else delete budgets[currency];
          return { budgets, updatedAt: nowIso() };
        }),
      setCategoryBudget: (currency, category, amount) =>
        set((s) => {
          const forCurrency = { ...s.categoryBudgets[currency] };
          if (amount && amount > 0) forCurrency[category] = amount;
          else delete forCurrency[category];
          return { categoryBudgets: { ...s.categoryBudgets, [currency]: forCurrency }, updatedAt: nowIso() };
        }),
      upsertRule: (rule) =>
        set((s) => {
          const exists = s.recurring.some((r) => r.id === rule.id);
          const recurring = exists ? s.recurring.map((r) => (r.id === rule.id ? rule : r)) : [...s.recurring, rule];
          return { recurring: recurring.slice(0, 50), updatedAt: nowIso() };
        }),
      removeRule: (id) => set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id), updatedAt: nowIso() })),
      markRuleRun: (id, date) =>
        set((s) => ({
          recurring: s.recurring.map((r) => (r.id === id ? { ...r, lastRun: date } : r)),
          updatedAt: nowIso(),
        })),
      rememberFriends: (people) =>
        set((s) => {
          const incoming = people.filter((p) => p.id !== "me");
          if (!incoming.length) return s;
          const names = new Set(incoming.map((p) => p.name.toLowerCase()));
          const friends = [...incoming, ...s.friends.filter((f) => !names.has(f.name.toLowerCase()))].slice(0, 100);
          return { friends, updatedAt: nowIso() };
        }),
      setPayInfo: (payInfo) => set({ payInfo, updatedAt: nowIso() }),
      setHomeCurrency: (homeCurrency) => set({ homeCurrency, updatedAt: nowIso() }),
      // Older settings documents lack newer fields; fill them from defaults.
      replaceFromCloud: (settings) => set({ ...EMPTY_SETTINGS, ...settings }),
    }),
    {
      name: "ryannreceipt:settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ budgets, categoryBudgets, recurring, friends, payInfo, homeCurrency, updatedAt }) => ({
        budgets,
        categoryBudgets,
        recurring,
        friends,
        payInfo,
        homeCurrency,
        updatedAt,
      }),
      merge: (persisted, current) =>
        persisted
          ? { ...current, ...(persisted as Partial<UserSettings>) }
          : { ...current, budgets: legacyBudgets() },
      skipHydration: true,
    },
  ),
);

const persistApi = useSettingsStore.persist;
const subscribe = (cb: () => void) => persistApi.onFinishHydration(cb);

/** Load settings from localStorage once; false until then (and on the server). */
export function useSettingsHydrated() {
  const hydrated = useSyncExternalStore(subscribe, () => persistApi.hasHydrated(), () => false);
  useEffect(() => {
    if (!persistApi.hasHydrated()) void persistApi.rehydrate();
  }, []);
  return hydrated;
}

/** The settings document as stored/synced (no actions). */
export function settingsSnapshot(): UserSettings {
  const { budgets, categoryBudgets, recurring, friends, payInfo, homeCurrency, updatedAt } = useSettingsStore.getState();
  return { budgets, categoryBudgets, recurring, friends, payInfo, homeCurrency, updatedAt };
}

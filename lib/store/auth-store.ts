"use client";

import { create } from "zustand";

import type { PublicUser } from "@/lib/auth/public-user";

type AuthStatus = "loading" | "signed-in" | "signed-out";

type AuthStore = {
  status: AuthStatus;
  user: PublicUser | null;
  /** Ask the BFF who is signed in (the session lives in httpOnly cookies). */
  load: () => Promise<void>;
  setUser: (user: PublicUser) => void;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>()((set) => ({
  status: "loading",
  user: null,
  load: async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const { user } = (await res.json()) as { user: PublicUser | null };
      set(user ? { status: "signed-in", user } : { status: "signed-out", user: null });
    } catch {
      set({ status: "signed-out", user: null });
    }
  },
  setUser: (user) => set({ status: "signed-in", user }),
  signOut: async () => {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
    window.google?.accounts.id.disableAutoSelect();
    set({ status: "signed-out", user: null });
  },
}));

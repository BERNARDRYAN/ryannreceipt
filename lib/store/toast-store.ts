"use client";

import { create } from "zustand";

export type Toast = {
  id: number;
  message: string;
  tone: "default" | "error" | "success";
  action?: { label: string; onClick: () => void };
  durationMs: number;
};

type ToastStore = {
  toasts: Toast[];
  show: (toast: Omit<Toast, "id" | "tone" | "durationMs"> & Partial<Pick<Toast, "tone" | "durationMs">>) => number;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],
  show: ({ tone = "default", durationMs = 4000, ...rest }) => {
    const id = nextId++;
    // Keep at most three on screen; the newest wins.
    set((s) => ({ toasts: [...s.toasts, { id, tone, durationMs, ...rest }].slice(-3) }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Fire-and-forget helper usable outside React components. */
export const toast = (message: string, options?: Partial<Omit<Toast, "id" | "message">>) =>
  useToastStore.getState().show({ message, ...options });

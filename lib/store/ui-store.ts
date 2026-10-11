"use client";

import { create } from "zustand";

/** App-wide dialogs that can open from any page (header, shortcuts, share target). */
type UiStore = {
  quickAddOpen: boolean;
  scanOpen: boolean;
  /** Image handed to the scanner (from the share sheet or Quick Add). */
  scanFile: File | null;
  recurringOpen: boolean;
  setQuickAddOpen: (open: boolean) => void;
  openScan: (file?: File | null) => void;
  closeScan: () => void;
  setRecurringOpen: (open: boolean) => void;
};

export const useUiStore = create<UiStore>()((set) => ({
  quickAddOpen: false,
  scanOpen: false,
  scanFile: null,
  recurringOpen: false,
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
  openScan: (file = null) => set({ scanOpen: true, scanFile: file, quickAddOpen: false }),
  closeScan: () => set({ scanOpen: false, scanFile: null }),
  setRecurringOpen: (recurringOpen) => set({ recurringOpen }),
}));

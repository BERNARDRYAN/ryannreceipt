"use client";

import { create } from "zustand";

/** App-wide dialogs that can open from any page (header, shortcuts, share target). */
type UiStore = {
  quickAddOpen: boolean;
  scanOpen: boolean;
  /** Image handed to the scanner (from the share sheet or Quick Add). */
  scanFile: File | null;
  recurringOpen: boolean;
  /** Receipt whose bill is being split (must exist in the local library). */
  splitReceiptId: string | null;
  payInfoOpen: boolean;
  setQuickAddOpen: (open: boolean) => void;
  openScan: (file?: File | null) => void;
  closeScan: () => void;
  setRecurringOpen: (open: boolean) => void;
  setSplitReceiptId: (id: string | null) => void;
  setPayInfoOpen: (open: boolean) => void;
};

export const useUiStore = create<UiStore>()((set) => ({
  quickAddOpen: false,
  scanOpen: false,
  scanFile: null,
  recurringOpen: false,
  splitReceiptId: null,
  payInfoOpen: false,
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
  openScan: (file = null) => set({ scanOpen: true, scanFile: file, quickAddOpen: false }),
  closeScan: () => set({ scanOpen: false, scanFile: null }),
  setRecurringOpen: (recurringOpen) => set({ recurringOpen }),
  setSplitReceiptId: (splitReceiptId) => set({ splitReceiptId }),
  setPayInfoOpen: (payInfoOpen) => set({ payInfoOpen }),
}));

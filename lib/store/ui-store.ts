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
  lockSettingsOpen: boolean;
  shareLinkReceiptId: string | null;
  importOpen: boolean;
  reviewYear: string | null;
  setQuickAddOpen: (open: boolean) => void;
  openScan: (file?: File | null) => void;
  closeScan: () => void;
  setRecurringOpen: (open: boolean) => void;
  setSplitReceiptId: (id: string | null) => void;
  setPayInfoOpen: (open: boolean) => void;
  setLockSettingsOpen: (open: boolean) => void;
  setShareLinkReceiptId: (id: string | null) => void;
  setImportOpen: (open: boolean) => void;
  setReviewYear: (year: string | null) => void;
};

export const useUiStore = create<UiStore>()((set) => ({
  quickAddOpen: false,
  scanOpen: false,
  scanFile: null,
  recurringOpen: false,
  splitReceiptId: null,
  payInfoOpen: false,
  lockSettingsOpen: false,
  shareLinkReceiptId: null,
  importOpen: false,
  reviewYear: null,
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
  openScan: (file = null) => set({ scanOpen: true, scanFile: file, quickAddOpen: false }),
  closeScan: () => set({ scanOpen: false, scanFile: null }),
  setRecurringOpen: (recurringOpen) => set({ recurringOpen }),
  setSplitReceiptId: (splitReceiptId) => set({ splitReceiptId }),
  setPayInfoOpen: (payInfoOpen) => set({ payInfoOpen }),
  setLockSettingsOpen: (lockSettingsOpen) => set({ lockSettingsOpen }),
  setShareLinkReceiptId: (shareLinkReceiptId) => set({ shareLinkReceiptId }),
  setImportOpen: (importOpen) => set({ importOpen }),
  setReviewYear: (reviewYear) => set({ reviewYear }),
}));

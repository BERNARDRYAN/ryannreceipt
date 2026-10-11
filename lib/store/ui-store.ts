"use client";

import { create } from "zustand";

/** App-wide dialogs that can open from any page (header, shortcuts, share target). */
type UiStore = {
  quickAddOpen: boolean;
  /** Which tab the add sheet opens on. */
  quickAddMode: "expense" | "income";
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
  backupOpen: boolean;
  reviewYear: string | null;
  setQuickAddOpen: (open: boolean, mode?: "expense" | "income") => void;
  openScan: (file?: File | null) => void;
  closeScan: () => void;
  setRecurringOpen: (open: boolean) => void;
  setSplitReceiptId: (id: string | null) => void;
  setPayInfoOpen: (open: boolean) => void;
  setLockSettingsOpen: (open: boolean) => void;
  setShareLinkReceiptId: (id: string | null) => void;
  setImportOpen: (open: boolean) => void;
  setBackupOpen: (open: boolean) => void;
  setReviewYear: (year: string | null) => void;
};

export const useUiStore = create<UiStore>()((set) => ({
  quickAddOpen: false,
  quickAddMode: "expense",
  scanOpen: false,
  scanFile: null,
  recurringOpen: false,
  splitReceiptId: null,
  payInfoOpen: false,
  lockSettingsOpen: false,
  shareLinkReceiptId: null,
  importOpen: false,
  backupOpen: false,
  reviewYear: null,
  setQuickAddOpen: (quickAddOpen, quickAddMode = "expense") => set({ quickAddOpen, quickAddMode }),
  openScan: (file = null) => set({ scanOpen: true, scanFile: file, quickAddOpen: false }),
  closeScan: () => set({ scanOpen: false, scanFile: null }),
  setRecurringOpen: (recurringOpen) => set({ recurringOpen }),
  setSplitReceiptId: (splitReceiptId) => set({ splitReceiptId }),
  setPayInfoOpen: (payInfoOpen) => set({ payInfoOpen }),
  setLockSettingsOpen: (lockSettingsOpen) => set({ lockSettingsOpen }),
  setShareLinkReceiptId: (shareLinkReceiptId) => set({ shareLinkReceiptId }),
  setImportOpen: (importOpen) => set({ importOpen }),
  setBackupOpen: (backupOpen) => set({ backupOpen }),
  setReviewYear: (reviewYear) => set({ reviewYear }),
}));

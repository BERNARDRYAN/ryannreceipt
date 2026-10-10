"use client";

import { create } from "zustand";

export const STEPS = ["shop", "items", "payment", "look"] as const;
export type Step = (typeof STEPS)[number];

/** Which editor step owns each clickable receipt field. */
const FIELD_STEP: Record<string, Step> = {
  logo: "shop",
  merchantName: "shop",
  merchantAddress: "shop",
  merchantPhone: "shop",
  title: "shop",
  receiptNo: "shop",
  receiptDate: "shop",
  cashier: "shop",
  tableNo: "shop",
  orderType: "shop",
  currency: "shop",
  items: "items",
  discountAmount: "payment",
  serviceChargeRate: "payment",
  taxRate: "payment",
  roundCash: "payment",
  paymentMethod: "payment",
  amountTendered: "payment",
  category: "payment",
  warrantyUntil: "payment",
  notes: "look",
  barcodeData: "look",
  qrData: "look",
};

export function stepForField(field: string): Step {
  return field.startsWith("item-") ? "items" : (FIELD_STEP[field] ?? "shop");
}

type EditorStore = {
  step: Step;
  /** Field to focus once its step is on screen (from a click on the paper). */
  focusRequest: { field: string; nonce: number } | null;
  mobileTab: "edit" | "preview";
  zoom: number;
  /** Bumped to replay the printer feed animation. */
  printKey: number;
  /** Bumped to show the "Exported" stamp. */
  stampKey: number;
  templatesOpen: boolean;
  shortcutsOpen: boolean;
  /** Index of the active quick-tour step, or null when the tour is closed. */
  tourStep: number | null;

  setStep: (step: Step) => void;
  focusField: (field: string) => void;
  setMobileTab: (tab: "edit" | "preview") => void;
  setZoom: (zoom: number) => void;
  replayPrint: () => void;
  showStamp: () => void;
  setTemplatesOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setTourStep: (step: number | null) => void;
};

export const ZOOM_LEVELS = [0.75, 1, 1.25, 1.5] as const;
export const DEFAULT_ZOOM = 1.25;

let nonce = 0;

export const useEditorStore = create<EditorStore>()((set) => ({
  step: "shop",
  focusRequest: null,
  mobileTab: "edit",
  zoom: DEFAULT_ZOOM,
  printKey: 1,
  stampKey: 0,
  templatesOpen: false,
  shortcutsOpen: false,
  tourStep: null,

  setStep: (step) => set({ step }),
  focusField: (field) =>
    set({ step: stepForField(field), mobileTab: "edit", focusRequest: { field, nonce: ++nonce } }),
  setMobileTab: (mobileTab) => set({ mobileTab }),
  setZoom: (zoom) => set({ zoom }),
  replayPrint: () => set((s) => ({ printKey: s.printKey + 1 })),
  showStamp: () => set((s) => ({ stampKey: s.stampKey + 1 })),
  setTemplatesOpen: (templatesOpen) => set({ templatesOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setTourStep: (tourStep) => set({ tourStep }),
}));

/**
 * Export actions registered by the mounted ExportBar, so keyboard shortcuts can
 * trigger them without lifting all export state up.
 */
export const exportActions: { png?: () => void; print?: () => void } = {};

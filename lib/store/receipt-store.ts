"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ReceiptDraft, ReceiptLineItem, ReceiptStyle } from "@/lib/validators/receipt-schema";

function newId() {
  return crypto.randomUUID();
}

/** `YYYY-MM-DDTHH:mm` in local time, the format `<input type="datetime-local">` expects. */
export function localDateTimeNow() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const DEFAULT_STYLE: ReceiptStyle = {
  width: "80mm",
  fontFamily: "mono",
  paperTheme: "clean",
  showBarcode: true,
  showQr: false,
  tearEdge: true,
  monochromeDither: false,
};

export function createDefaultDraft(): ReceiptDraft {
  const serial = String(Math.floor(100000 + Math.random() * 900000));
  return {
    title: "Sales Receipt",
    merchantName: "Ryann Kopitiam",
    merchantAddress: "12 Jalan Bukit Bintang, 55100 Kuala Lumpur",
    merchantPhone: "+60 3-2141 0000",
    receiptNo: `RR-${serial}`,
    receiptDate: localDateTimeNow(),
    currency: "MYR",
    taxRate: 6,
    discountAmount: 0,
    paymentMethod: "CASH",
    category: "Food & Drink",
    notes: "Thank you! Please come again.",
    barcodeData: `RR${serial}`,
    qrData: "",
    warrantyUntil: "",
    items: [
      { id: newId(), name: "Kopi O Kosong", qty: 2, price: 2.8 },
      { id: newId(), name: "Roti Bakar Kaya", qty: 1, price: 4.5 },
      { id: newId(), name: "Nasi Lemak Ayam", qty: 1, price: 12.9 },
    ],
    styleConfig: DEFAULT_STYLE,
  };
}

type ScalarField = Exclude<keyof ReceiptDraft, "items" | "styleConfig">;

type ReceiptStore = {
  draft: ReceiptDraft;
  setField: <K extends ScalarField>(key: K, value: ReceiptDraft[K]) => void;
  setStyle: <K extends keyof ReceiptStyle>(key: K, value: ReceiptStyle[K]) => void;
  addItem: () => void;
  updateItem: (id: string, patch: Partial<Omit<ReceiptLineItem, "id">>) => void;
  removeItem: (id: string) => void;
  reset: () => void;
};

/**
 * Guest-mode store: the working draft lives in localStorage so first-time
 * visitors can design and export without an account. Hydration is manual
 * (`skipHydration`) so server and first client render always match.
 */
export const useReceiptStore = create<ReceiptStore>()(
  persist(
    (set) => ({
      draft: createDefaultDraft(),
      setField: (key, value) => set((s) => ({ draft: { ...s.draft, [key]: value } })),
      setStyle: (key, value) =>
        set((s) => ({
          draft: { ...s.draft, styleConfig: { ...s.draft.styleConfig, [key]: value } },
        })),
      addItem: () =>
        set((s) =>
          s.draft.items.length >= 100
            ? s
            : { draft: { ...s.draft, items: [...s.draft.items, { id: newId(), name: "", qty: 1, price: 0 }] } },
        ),
      updateItem: (id, patch) =>
        set((s) => ({
          draft: {
            ...s.draft,
            items: s.draft.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
          },
        })),
      removeItem: (id) =>
        set((s) => ({ draft: { ...s.draft, items: s.draft.items.filter((item) => item.id !== id) } })),
      reset: () => set({ draft: createDefaultDraft() }),
    }),
    {
      name: "ryannreceipt:draft",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ draft: s.draft }),
      // Fill any fields added in later versions from defaults.
      merge: (persisted, current) => {
        const draft = (persisted as Partial<ReceiptStore> | undefined)?.draft;
        if (!draft) return current;
        return {
          ...current,
          draft: {
            ...current.draft,
            ...draft,
            styleConfig: { ...DEFAULT_STYLE, ...draft.styleConfig },
          },
        };
      },
      skipHydration: true,
    },
  ),
);

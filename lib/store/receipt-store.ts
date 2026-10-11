"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { usePrefsStore } from "@/lib/store/prefs-store";

import {
  createBlankDraft,
  createSampleDraft,
  DEFAULT_STYLE,
  newId,
  normalizeDraft,
} from "@/lib/receipts/defaults";
import type {
  Preset,
  PresetInput,
  ReceiptDraft,
  ReceiptLineItem,
  ReceiptStyle,
} from "@/lib/validators/receipt-schema";

export { createBlankDraft, createSampleDraft, DEFAULT_STYLE, normalizeDraft } from "@/lib/receipts/defaults";

const nowIso = () => new Date().toISOString();

export type LocalReceipt = {
  id: string;
  draft: ReceiptDraft;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  /** When this exact version was last confirmed by the cloud; null = never synced. */
  syncedAt: string | null;
};

export const isDirty = (r: LocalReceipt) => !r.syncedAt || r.updatedAt > r.syncedAt;

const MAX_LOCAL_RECEIPTS = 300;

type ScalarField = Exclude<keyof ReceiptDraft, "items" | "styleConfig">;

const MAX_UNDO = 100;
/** Consecutive edits to the same field within this window form one undo step. */
const COALESCE_MS = 800;
let lastEdit: { key: string; at: number } | null = null;

/** Sequential, zero-padded receipt number from this device's counter. */
function issueSerial() {
  return String(usePrefsStore.getState().nextSerial()).padStart(6, "0");
}

type ReceiptStore = {
  receipts: Record<string, LocalReceipt>;
  activeId: string;
  presets: Preset[];
  /** Undo/redo history for the active receipt (session only, not persisted). */
  past: ReceiptDraft[];
  future: ReceiptDraft[];
  undo: () => void;
  redo: () => void;

  // Active-draft editing
  setField: <K extends ScalarField>(key: K, value: ReceiptDraft[K]) => void;
  setStyle: <K extends keyof ReceiptStyle>(key: K, value: ReceiptStyle[K]) => void;
  /** Several style keys as one undo step (e.g. a "look"). */
  setStyles: (patch: Partial<ReceiptStyle>) => void;
  addItem: () => string | null;
  updateItem: (id: string, patch: Partial<Omit<ReceiptLineItem, "id">>) => void;
  removeItem: (id: string) => void;
  moveItem: (from: number, to: number) => void;
  applyPreset: (preset: PresetInput) => void;

  // Library
  newReceipt: () => string;
  /** Add a receipt built elsewhere (templates) and open it. */
  createReceipt: (draft: ReceiptDraft) => string;
  /**
   * Add receipts in the background (quick add, recurring, scans) without
   * changing the open one. Ids that already exist are skipped.
   */
  addReceipts: (entries: { id?: string; draft: ReceiptDraft }[]) => string[];
  /** Patch any receipt by id (no undo step), e.g. after a background photo upload. */
  patchDraft: (id: string, patch: Partial<ReceiptDraft>) => void;
  /** Fill shop details remembered from earlier receipts, as one undo step. */
  applyMerchant: (patch: Partial<ReceiptDraft>) => void;
  openReceipt: (id: string) => void;
  duplicateReceipt: (id: string) => string | null;
  deleteReceipt: (id: string) => LocalReceipt | null;
  restoreReceipt: (receipt: LocalReceipt) => void;
  setPinned: (id: string, pinned: boolean) => void;
  /** Cache a cloud receipt locally, marked as in sync. */
  upsertFromCloud: (record: { id: string; isPinned: boolean; draft: ReceiptDraft; updatedAt: string }) => void;
  markSynced: (versions: { id: string; updatedAt: string }[]) => void;
  clearLibrary: () => void;

  // Guest presets (signed-in users keep presets in the cloud)
  addLocalPreset: (preset: PresetInput) => void;
  removeLocalPreset: (id: string) => void;
};

function makeReceipt(draft: ReceiptDraft): LocalReceipt {
  const at = nowIso();
  return { id: newId(), draft, isPinned: false, createdAt: at, updatedAt: at, syncedAt: null };
}

/** Drop the oldest unpinned, already-synced receipts once the local cap is hit. */
function prune(receipts: Record<string, LocalReceipt>, keepId: string) {
  const list = Object.values(receipts);
  if (list.length <= MAX_LOCAL_RECEIPTS) return receipts;
  const removable = list
    .filter((r) => r.id !== keepId && !r.isPinned && !isDirty(r))
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const next = { ...receipts };
  for (const r of removable.slice(0, list.length - MAX_LOCAL_RECEIPTS)) delete next[r.id];
  return next;
}

const initialReceipt = makeReceipt(createSampleDraft());

export const useReceiptStore = create<ReceiptStore>()(
  persist(
    (set, get) => {
      /**
       * Apply `fn` to the active draft, bump its updatedAt and record an undo
       * step. Rapid edits with the same `key` (typing) coalesce into one step.
       */
      const editActive = (fn: (draft: ReceiptDraft) => ReceiptDraft, key?: string) =>
        set((s) => {
          const current = s.receipts[s.activeId];
          if (!current) return s;
          const next = fn(current.draft);
          if (next === current.draft) return s;
          const now = Date.now();
          const coalesce = !!key && lastEdit?.key === key && now - lastEdit.at < COALESCE_MS;
          lastEdit = key ? { key, at: now } : null;
          return {
            receipts: { ...s.receipts, [s.activeId]: { ...current, draft: next, updatedAt: nowIso() } },
            past: coalesce ? s.past : [...s.past, current.draft].slice(-MAX_UNDO),
            future: [],
          };
        });

      /** Swap the active draft for one from history. */
      const restore = (draft: ReceiptDraft, past: ReceiptDraft[], future: ReceiptDraft[]) =>
        set((s) => {
          const current = s.receipts[s.activeId];
          if (!current) return s;
          lastEdit = null;
          return {
            receipts: { ...s.receipts, [s.activeId]: { ...current, draft, updatedAt: nowIso() } },
            past,
            future,
          };
        });

      /** Switching receipts starts a fresh history. */
      const resetHistory = { past: [] as ReceiptDraft[], future: [] as ReceiptDraft[] };

      return {
        receipts: { [initialReceipt.id]: initialReceipt },
        activeId: initialReceipt.id,
        presets: [],
        past: [],
        future: [],
        undo: () => {
          const s = get();
          const current = s.receipts[s.activeId]?.draft;
          const previous = s.past[s.past.length - 1];
          if (!current || !previous) return;
          restore(previous, s.past.slice(0, -1), [current, ...s.future].slice(0, MAX_UNDO));
        },
        redo: () => {
          const s = get();
          const current = s.receipts[s.activeId]?.draft;
          const next = s.future[0];
          if (!current || !next) return;
          restore(next, [...s.past, current].slice(-MAX_UNDO), s.future.slice(1));
        },

        setField: (key, value) => editActive((d) => (d[key] === value ? d : { ...d, [key]: value }), `f:${key}`),
        setStyle: (key, value) =>
          editActive(
            (d) => (d.styleConfig[key] === value ? d : { ...d, styleConfig: { ...d.styleConfig, [key]: value } }),
            `s:${key}`,
          ),
        addItem: () => {
          const active = get().receipts[get().activeId];
          if (!active || active.draft.items.length >= 100) return null;
          const id = newId();
          editActive((d) => ({ ...d, items: [...d.items, { id, name: "", qty: 1, price: 0 }] }));
          return id;
        },
        setStyles: (patch) => editActive((d) => ({ ...d, styleConfig: { ...d.styleConfig, ...patch } })),
        updateItem: (id, patch) =>
          editActive(
            (d) => ({ ...d, items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }),
            `i:${id}:${Object.keys(patch).join(",")}`,
          ),
        removeItem: (id) => editActive((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) })),
        moveItem: (from, to) =>
          editActive((d) => {
            if (from === to || from < 0 || to < 0 || from >= d.items.length || to >= d.items.length) return d;
            const items = [...d.items];
            const [moved] = items.splice(from, 1);
            items.splice(to, 0, moved);
            return { ...d, items };
          }),
        applyPreset: (preset) =>
          editActive((d) => ({
            ...d,
            merchantName: preset.merchantName,
            merchantAddress: preset.merchantAddress,
            merchantPhone: preset.merchantPhone,
            currency: preset.currency,
            styleConfig: { ...DEFAULT_STYLE, ...preset.styleConfig },
          })),

        newReceipt: () => {
          const s = get();
          const current = s.receipts[s.activeId]?.draft;
          // Keep the merchant and look; start fresh items, number and date.
          const draft: ReceiptDraft = {
            ...createBlankDraft(issueSerial()),
            ...(current && {
              merchantName: current.merchantName,
              merchantAddress: current.merchantAddress,
              merchantPhone: current.merchantPhone,
              currency: current.currency,
              taxRate: current.taxRate,
              taxLabel: current.taxLabel,
              taxInclusive: current.taxInclusive,
              serviceChargeRate: current.serviceChargeRate,
              roundCash: current.roundCash,
              category: current.category,
              notes: current.notes,
              styleConfig: current.styleConfig,
            }),
          };
          const receipt = makeReceipt(draft);
          set({
            receipts: prune({ ...s.receipts, [receipt.id]: receipt }, receipt.id),
            activeId: receipt.id,
            ...resetHistory,
          });
          return receipt.id;
        },
        createReceipt: (draft) => {
          const serial = issueSerial();
          const receipt = makeReceipt({ ...draft, receiptNo: `RR-${serial}`, barcodeData: `RR${serial}` });
          set((s) => ({
            receipts: prune({ ...s.receipts, [receipt.id]: receipt }, receipt.id),
            activeId: receipt.id,
            ...resetHistory,
          }));
          return receipt.id;
        },
        addReceipts: (entries) => {
          const s = get();
          const receipts = { ...s.receipts };
          const added: string[] = [];
          for (const { id, draft } of entries) {
            if (id && receipts[id]) continue;
            const serial = issueSerial();
            const receipt = makeReceipt({ ...draft, receiptNo: `RR-${serial}`, barcodeData: `RR${serial}` });
            if (id) receipt.id = id;
            receipts[receipt.id] = receipt;
            added.push(receipt.id);
          }
          if (added.length) set({ receipts: prune(receipts, s.activeId) });
          return added;
        },
        patchDraft: (id, patch) =>
          set((s) => {
            const r = s.receipts[id];
            return r
              ? { receipts: { ...s.receipts, [id]: { ...r, draft: { ...r.draft, ...patch }, updatedAt: nowIso() } } }
              : s;
          }),
        applyMerchant: (patch) => editActive((d) => ({ ...d, ...patch })),
        openReceipt: (id) => {
          const s = get();
          if (s.receipts[id] && s.activeId !== id) set({ activeId: id, ...resetHistory });
        },
        duplicateReceipt: (id) => {
          const s = get();
          const source = s.receipts[id];
          if (!source) return null;
          const serial = issueSerial();
          const copy = makeReceipt({
            ...source.draft,
            receiptNo: `RR-${serial}`,
            barcodeData: `RR${serial}`,
            items: source.draft.items.map((it) => ({ ...it, id: newId() })),
          });
          set({ receipts: prune({ ...s.receipts, [copy.id]: copy }, copy.id) });
          return copy.id;
        },
        deleteReceipt: (id) => {
          const s = get();
          const removed = s.receipts[id];
          if (!removed) return null;
          const receipts = { ...s.receipts };
          delete receipts[id];
          let activeId = s.activeId;
          if (activeId === id) {
            const next = Object.values(receipts).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
            if (next) activeId = next.id;
            else {
              const fresh = makeReceipt(createBlankDraft());
              receipts[fresh.id] = fresh;
              activeId = fresh.id;
            }
          }
          set({ receipts, activeId, ...(activeId !== s.activeId && resetHistory) });
          return removed;
        },
        restoreReceipt: (receipt) => set((s) => ({ receipts: { ...s.receipts, [receipt.id]: receipt } })),
        setPinned: (id, pinned) =>
          set((s) => {
            const r = s.receipts[id];
            return r ? { receipts: { ...s.receipts, [id]: { ...r, isPinned: pinned, updatedAt: nowIso() } } } : s;
          }),
        upsertFromCloud: ({ id, isPinned, draft, updatedAt }) =>
          set((s) => {
            const existing = s.receipts[id];
            // Never clobber unsynced local edits with an older cloud copy.
            if (existing && isDirty(existing) && existing.updatedAt > updatedAt) return s;
            const receipt: LocalReceipt = {
              id,
              draft: normalizeDraft(draft),
              isPinned,
              createdAt: existing?.createdAt ?? updatedAt,
              updatedAt,
              syncedAt: updatedAt,
            };
            return { receipts: prune({ ...s.receipts, [id]: receipt }, s.activeId) };
          }),
        markSynced: (versions) =>
          set((s) => {
            const receipts = { ...s.receipts };
            for (const { id, updatedAt } of versions) {
              const r = receipts[id];
              // Only mark synced if no edit happened after the version we sent.
              if (r && r.updatedAt <= updatedAt) receipts[id] = { ...r, syncedAt: r.updatedAt };
            }
            return { receipts };
          }),
        clearLibrary: () => {
          const fresh = makeReceipt(createBlankDraft());
          set({ receipts: { [fresh.id]: fresh }, activeId: fresh.id, presets: [], ...resetHistory });
        },

        addLocalPreset: (preset) => set((s) => ({ presets: [...s.presets, { ...preset, id: newId() }].slice(-50) })),
        removeLocalPreset: (id) => set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
      };
    },
    {
      name: "ryannreceipt:draft",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ receipts: s.receipts, activeId: s.activeId, presets: s.presets }),
      migrate: (persisted, version) => {
        // v1 kept a single `draft`; wrap it as the first library entry.
        if (version < 2) {
          const old = (persisted as { draft?: Partial<ReceiptDraft> } | undefined)?.draft;
          const receipt = makeReceipt(normalizeDraft(old ?? createSampleDraft()));
          return { receipts: { [receipt.id]: receipt }, activeId: receipt.id, presets: [] };
        }
        return persisted as Pick<ReceiptStore, "receipts" | "activeId" | "presets">;
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<Pick<ReceiptStore, "receipts" | "activeId" | "presets">> | undefined;
        if (!p?.receipts || Object.keys(p.receipts).length === 0) return current;
        const receipts: Record<string, LocalReceipt> = {};
        for (const [id, r] of Object.entries(p.receipts)) receipts[id] = { ...r, draft: normalizeDraft(r.draft) };
        const activeId = p.activeId && receipts[p.activeId] ? p.activeId : Object.keys(receipts)[0];
        return { ...current, receipts, activeId, presets: p.presets ?? [] };
      },
      skipHydration: true,
    },
  ),
);

/** The draft currently open in the studio. */
export function useActiveDraft() {
  return useReceiptStore((s) => s.receipts[s.activeId]?.draft);
}

const persistApi = useReceiptStore.persist;
const subscribeHydration = (onChange: () => void) => persistApi.onFinishHydration(onChange);

/**
 * Load the local library from localStorage once on the client. Returns false on
 * the server and during the first client render, so markup always matches.
 */
export function useLibraryHydrated() {
  const hydrated = useSyncExternalStore(subscribeHydration, () => persistApi.hasHydrated(), () => false);
  useEffect(() => {
    if (!persistApi.hasHydrated()) void persistApi.rehydrate();
  }, []);
  return hydrated;
}

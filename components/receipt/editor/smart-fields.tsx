"use client";

import { Camera, History, LoaderCircle, Trash2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { fieldDomId, inputClass } from "@/components/receipt/editor/fields";
import { Combobox } from "@/components/ui/combobox";
import { useT } from "@/lib/i18n/messages";
import { buildMerchantMemory, suggestMerchants, type MerchantMemory } from "@/lib/memory/merchants";
import { useAuthStore } from "@/lib/store/auth-store";
import { useReceiptStore } from "@/lib/store/receipt-store";
import { toast } from "@/lib/store/toast-store";
import { deleteReceiptPhoto, receiptPhotoUrl, uploadReceiptPhoto } from "@/lib/sync/photos";

/** Merchant memory from this device's receipts (excluding the open one). */
export function useMerchantMemory() {
  const receipts = useReceiptStore((s) => s.receipts);
  const activeId = useReceiptStore((s) => s.activeId);
  return useMemo(
    () => buildMerchantMemory(Object.values(receipts).filter((r) => r.id !== activeId)),
    [receipts, activeId],
  );
}

/**
 * Store name with suggestions from past receipts. Picking one fills the
 * address, phone, category, payment, wallet and tax in a single undo step.
 */
export function MerchantInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT();
  const memory = useMerchantMemory();
  const applyMerchant = useReceiptStore((s) => s.applyMerchant);
  const undo = useReceiptStore((s) => s.undo);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const suggestions = open ? suggestMerchants(memory, value) : [];

  function pick(m: MerchantMemory) {
    applyMerchant({
      merchantName: m.name,
      merchantAddress: m.address,
      merchantPhone: m.phone,
      category: m.category,
      paymentMethod: m.paymentMethod,
      wallet: m.wallet,
      taxRate: m.taxRate,
      taxLabel: m.taxLabel,
      taxInclusive: m.taxInclusive,
      serviceChargeRate: m.serviceChargeRate,
      tags: m.tags,
    });
    setOpen(false);
    toast(t("memory.filled", { name: m.name }), { action: { label: t("common.undo"), onClick: undo } });
  }

  return (
    <div className="relative">
      <input
        id={fieldDomId("merchantName")}
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        className={inputClass}
        maxLength={60}
        placeholder={t("field.storeNamePh")}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!suggestions.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(suggestions[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-xl"
        >
          {suggestions.map((m, i) => (
            <li
              key={m.name}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
                i === active ? "bg-surface-muted" : ""
              }`}
            >
              <History className="size-3.5 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
              <span className="shrink-0 text-xs text-muted">{t("memory.visits", { count: m.visits })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Free-form tags as removable chips; Enter or comma adds one. */
export function TagsInput({
  value,
  onChange,
  suggestions,
  id,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  id: string;
}) {
  const t = useT();
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const tag = raw.trim().replace(/^#/, "").toLowerCase().slice(0, 24);
    if (!tag || value.includes(tag) || value.length >= 10) return;
    onChange([...value, tag]);
    setDraft("");
  }

  return (
    <div className={`${inputClass} flex min-h-10 flex-wrap items-center gap-1.5 py-1.5`}>
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs">
          #{tag}
          <button
            type="button"
            aria-label={t("tags.remove", { tag })}
            onClick={() => onChange(value.filter((x) => x !== tag))}
            className="text-muted hover:text-foreground"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <Combobox
        id={id}
        value={draft}
        placeholder={value.length ? "" : t("tags.placeholder")}
        options={suggestions.filter((s) => !value.includes(s)).map((s) => ({ value: s }))}
        onChange={(v) => {
          if (v.endsWith(",")) add(v.slice(0, -1));
          else setDraft(v);
        }}
        onPick={(option) => add(option.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
        className="min-w-20 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}

/**
 * Photo of the paper receipt, kept in the user's private cloud folder.
 * Guests are told to sign in (photos are too big for browser storage).
 */
export function PhotoField({ receiptId, hasPhoto, onChange }: { receiptId: string; hasPhoto: boolean; onChange: (has: boolean) => void }) {
  const t = useT();
  const signedIn = useAuthStore((s) => s.status === "signed-in");
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signedIn || !hasPhoto) return;
    let cancelled = false;
    receiptPhotoUrl(receiptId).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn, hasPhoto, receiptId]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await uploadReceiptPhoto(receiptId, file);
      onChange(true);
      setUrl(await receiptPhotoUrl(receiptId));
    } catch {
      toast(t("photo.uploadFailed"), { tone: "error" });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteReceiptPhoto(receiptId);
      onChange(false);
      setUrl(null);
    } catch {
      toast(t("photo.deleteFailed"), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn) {
    return <p className="rounded-lg bg-surface-muted px-3 py-2.5 text-xs text-muted">{t("photo.signIn")}</p>;
  }

  return (
    <div className="relative flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      {hasPhoto && url ? (
        <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={t("photo.alt")} className="h-20 w-16 rounded-md object-cover shadow-sm ring-1 ring-border" />
        </a>
      ) : (
        <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted">
          <Camera className="size-5" aria-hidden />
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button
          id={fieldDomId("photo")}
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ring-1 ring-border hover:bg-surface-muted disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : <Camera className="size-3.5" aria-hidden />}
          {hasPhoto ? t("photo.replace") : t("photo.add")}
        </button>
        {hasPhoto && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-surface-muted hover:text-danger"
          >
            <Trash2 className="size-3.5" aria-hidden />
            {t("photo.remove")}
          </button>
        )}
      </div>
    </div>
  );
}

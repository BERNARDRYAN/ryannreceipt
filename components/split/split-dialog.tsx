"use client";

import { Check, Copy, Download, Equal, MessageCircle, Minus, Plus, Share2, Trash2, UserPlus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { ReceiptCanvas } from "@/components/receipt/receipt-canvas";
import { inputClass } from "@/components/receipt/editor/fields";
import { Combobox } from "@/components/ui/combobox";
import { buttonStyles, Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/messages";
import { computeSplit, newSplit, shareDraft, splitEqually, type PersonShare } from "@/lib/split/calc";
import { payInfoLine, splitMessage } from "@/lib/split/message";
import { useAuthStore } from "@/lib/store/auth-store";
import { isDirty, useReceiptStore } from "@/lib/store/receipt-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { toast } from "@/lib/store/toast-store";
import { useUiStore } from "@/lib/store/ui-store";
import { pushReceipts } from "@/lib/sync/cloud";
import { formatAmount, lineTotal } from "@/lib/utils/currency";
import { canShareFiles, downloadNodeAsPng, exportBasename, shareNodeAsImage } from "@/lib/utils/export-canvas";
import { ME, type ReceiptDraft, type Split } from "@/lib/validators/receipt-schema";

const AVATAR_COLORS = ["bg-[#c2410c]", "bg-[#1d4ed8]", "bg-[#047857]", "bg-[#6d28d9]", "bg-[#be185d]", "bg-[#a16207]"];

function Avatar({ name, index }: { name: string; index: number }) {
  return (
    <span
      aria-hidden
      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
        AVATAR_COLORS[index % AVATAR_COLORS.length]
      }`}
    >
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/** Off-screen render of one person's share as a receipt, for image export. */
function ShareImage({ draft, share, payerName, onReady }: { draft: ReceiptDraft; share: PersonShare; payerName: string; onReady: (node: HTMLDivElement) => void }) {
  const t = useT();
  const payInfo = useSettingsStore((s) => s.payInfo);
  const info = payInfoLine(payInfo);
  const note = share.isPayer
    ? t("split.imgPayer")
    : [t("split.imgPayTo", { name: payerName }), info].filter(Boolean).join("\n");
  const shareReceipt = shareDraft(draft, share, `${t("split.imgTitle")}: ${share.name}`, note);
  return (
    <div aria-hidden className="pointer-events-none fixed top-0 left-[-200vw]">
      <ReceiptCanvas
        ref={(el) => {
          if (el) onReady(el);
        }}
        draft={shareReceipt}
      />
    </div>
  );
}

function SplitEditor({ receiptId, onClose }: { receiptId: string; onClose: () => void }) {
  const t = useT();
  const receipt = useReceiptStore((s) => s.receipts[receiptId]);
  const patchDraft = useReceiptStore((s) => s.patchDraft);
  const friends = useSettingsStore((s) => s.friends);
  const payInfo = useSettingsStore((s) => s.payInfo);
  const rememberFriends = useSettingsStore((s) => s.rememberFriends);
  const [personName, setPersonName] = useState("");
  const [imageFor, setImageFor] = useState<{ share: PersonShare; mode: "share" | "download" } | null>(null);
  const busyImage = useRef(false);

  const draft = receipt?.draft;
  const meLabel = t("split.me");
  const split: Split = useMemo(() => draft?.split ?? newSplit(meLabel), [draft?.split, meLabel]);
  const result = useMemo(() => (draft ? computeSplit(draft, split) : null), [draft, split]);
  if (!draft || !result) return null;

  const name = (id: string, n: string) => (id === ME ? meLabel : n);
  const money = (n: number) => `${draft.currency} ${formatAmount(n, draft.currency)}`;
  const update = (next: Split) => patchDraft(receiptId, { split: next });

  function addPerson(raw: string) {
    const clean = raw.trim().slice(0, 30);
    if (!clean || split.people.length >= 20) return;
    if (split.people.some((p) => p.name.toLowerCase() === clean.toLowerCase())) return;
    const known = friends.find((f) => f.name.toLowerCase() === clean.toLowerCase());
    const person = known ?? { id: crypto.randomUUID(), name: clean };
    update({ ...split, people: [...split.people, person] });
    rememberFriends([person]);
    setPersonName("");
  }

  function removePerson(id: string) {
    const shares: Split["shares"] = {};
    for (const [itemId, s] of Object.entries(split.shares)) {
      const rest = { ...s };
      delete rest[id];
      shares[itemId] = rest;
    }
    const paid = { ...split.paid };
    delete paid[id];
    update({
      ...split,
      people: split.people.filter((p) => p.id !== id),
      payerId: split.payerId === id ? ME : split.payerId,
      shares,
      paid,
    });
  }

  function setUnits(itemId: string, personId: string, units: number) {
    const current = { ...(split.shares[itemId] ?? {}) };
    if (units <= 0) delete current[personId];
    else current[personId] = units;
    update({ ...split, shares: { ...split.shares, [itemId]: current } });
  }

  function togglePaid(personId: string) {
    const was = !!split.paid[personId];
    update({ ...split, paid: { ...split.paid, [personId]: was ? "" : new Date().toISOString() } });
  }

  const message = splitMessage(draft, result, payInfo, t, name);

  async function shareMessage() {
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  async function onImageReady(node: HTMLDivElement) {
    if (!imageFor || busyImage.current) return;
    busyImage.current = true;
    const { share, mode } = imageFor;
    const base = exportBasename(draft!.merchantName, share.name);
    try {
      if (mode === "share") await shareNodeAsImage(node, base, `${draft!.merchantName} · ${share.name}`);
      else await downloadNodeAsPng(node, base, 4);
    } catch {
      toast(t("export.failed"), { tone: "error" });
    } finally {
      busyImage.current = false;
      setImageFor(null);
    }
  }

  const payer = result.people.find((p) => p.isPayer)!;
  const friendOptions = friends
    .filter((f) => !split.people.some((p) => p.name.toLowerCase() === f.name.toLowerCase()))
    .map((f) => ({ value: f.name }));
  const canShareImg = typeof window !== "undefined" && canShareFiles();

  return (
    <div className="space-y-5">
      {/* People */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">{t("split.people")}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {split.people.map((p, i) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted py-1 pr-1.5 pl-1 text-sm">
              <Avatar name={name(p.id, p.name)} index={i} />
              {name(p.id, p.name)}
              {p.id !== ME && (
                <button
                  type="button"
                  aria-label={t("split.removePerson", { name: p.name })}
                  onClick={() => removePerson(p.id)}
                  className="rounded-full p-0.5 text-muted hover:text-foreground"
                >
                  <X className="size-3" aria-hidden />
                </button>
              )}
            </span>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addPerson(personName);
          }}
        >
          <div className="relative flex-1">
            <UserPlus className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Combobox
              aria-label={t("split.addPerson")}
              placeholder={t("split.addPersonPh")}
              value={personName}
              onChange={setPersonName}
              onPick={(o) => addPerson(o.value)}
              options={friendOptions}
              className={`${inputClass} pl-9`}
            />
          </div>
          <button type="submit" className={buttonStyles.secondary} disabled={!personName.trim()}>
            {t("split.add")}
          </button>
        </form>
        {friendOptions.length > 0 && !personName && (
          <div className="flex flex-wrap gap-1.5">
            {friendOptions.slice(0, 8).map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => addPerson(f.value)}
                className="rounded-full px-2.5 py-1 text-xs ring-1 ring-border hover:bg-surface-muted"
              >
                + {f.value}
              </button>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <span className="shrink-0 whitespace-nowrap text-muted">{t("split.paidBy")}</span>
          <select
            className={`${inputClass} max-w-56 py-1.5`}
            value={split.payerId}
            onChange={(e) => update({ ...split, payerId: e.target.value })}
          >
            {split.people.map((p) => (
              <option key={p.id} value={p.id}>
                {name(p.id, p.name)}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* Items */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">{t("split.whoHadWhat")}</h3>
          <button
            type="button"
            onClick={() => update(splitEqually(draft, split))}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-border hover:bg-surface-muted"
          >
            <Equal className="size-3.5" aria-hidden />
            {t("split.equally")}
          </button>
        </div>
        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {draft.items
            .filter((item) => item.name.trim() || item.price > 0)
            .map((item) => {
              const shares = split.shares[item.id] ?? {};
              const assignedUnits = Object.values(shares).reduce((s, u) => s + u, 0);
              return (
                <li key={item.id} className={`rounded-xl p-2.5 ring-1 ${assignedUnits ? "ring-border" : "ring-warning/50"}`}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium">
                      {item.qty > 1 && <span className="text-muted">{item.qty}× </span>}
                      {item.name || t("list.untitled")}
                    </span>
                    <span className="shrink-0 tabular-nums">{formatAmount(lineTotal(item, draft.currency), draft.currency)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {split.people.map((p, i) => {
                      const units = shares[p.id] ?? 0;
                      const on = units > 0;
                      return (
                        <span key={p.id} className="inline-flex items-center">
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => setUnits(item.id, p.id, on ? 0 : 1)}
                            className={`inline-flex items-center gap-1 rounded-full py-0.5 pr-2.5 pl-0.5 text-xs font-medium transition-colors ${
                              on ? "bg-accent text-accent-contrast" : "text-muted ring-1 ring-border hover:text-foreground"
                            }`}
                          >
                            <Avatar name={name(p.id, p.name)} index={i} />
                            {name(p.id, p.name)}
                            {on && item.qty > 1 && <span className="opacity-80">×{units}</span>}
                          </button>
                          {on && item.qty > 1 && (
                            <span className="ml-0.5 inline-flex">
                              <button
                                type="button"
                                aria-label={t("split.less", { name: p.name })}
                                onClick={() => setUnits(item.id, p.id, units - 1)}
                                className="rounded-full p-0.5 text-muted hover:text-foreground"
                              >
                                <Minus className="size-3" aria-hidden />
                              </button>
                              <button
                                type="button"
                                aria-label={t("split.more", { name: p.name })}
                                onClick={() => setUnits(item.id, p.id, units + 1)}
                                className="rounded-full p-0.5 text-muted hover:text-foreground"
                              >
                                <Plus className="size-3" aria-hidden />
                              </button>
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </li>
              );
            })}
        </ul>
        {result.unassigned.length > 0 && (
          <p className="text-xs text-warning">{t("split.unassigned", { count: result.unassigned.length, name: name(payer.id, payer.name) })}</p>
        )}
      </section>

      {/* Totals */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">{t("split.owes")}</h3>
        <ul className="divide-y divide-border rounded-xl ring-1 ring-border">
          {result.people.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2.5 px-3 py-2.5">
              <Avatar name={name(p.id, p.name)} index={i} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {name(p.id, p.name)}
                  {p.isPayer && <span className="ml-1.5 text-xs font-normal text-muted">· {t("split.paidTheBill")}</span>}
                </p>
                <p className="truncate text-xs text-muted">
                  {t("split.breakdown", {
                    items: formatAmount(p.subtotal - p.discount, draft.currency),
                    extra: formatAmount(p.serviceCharge + (draft.taxInclusive ? 0 : p.taxAmount), draft.currency),
                  })}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{money(p.total)}</span>
              {!p.isPayer && (
                <button
                  type="button"
                  onClick={() => togglePaid(p.id)}
                  aria-pressed={p.paid}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${
                    p.paid ? "bg-success/15 text-success" : "text-muted ring-1 ring-border hover:text-foreground"
                  }`}
                >
                  {p.paid && <Check className="size-3" aria-hidden />}
                  {p.paid ? t("split.paidShort") : t("split.markPaid")}
                </button>
              )}
              <button
                type="button"
                aria-label={t("split.image", { name: name(p.id, p.name) })}
                title={t("split.image", { name: name(p.id, p.name) })}
                onClick={() => setImageFor({ share: p, mode: canShareImg ? "share" : "download" })}
                className="shrink-0 rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
              >
                {canShareImg ? <Share2 className="size-4" aria-hidden /> : <Download className="size-4" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
        {!payInfoLine(payInfo) && payer.id === ME && (
          <p className="text-xs text-muted">{t("split.payInfoHint")}</p>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => {
            patchDraft(receiptId, { split: null });
            onClose();
          }}
          className={`${buttonStyles.ghost} text-danger`}
        >
          <Trash2 className="size-4" aria-hidden />
          {t("split.remove")}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(message);
              toast(t("split.copied"), { tone: "success" });
            }}
            className={buttonStyles.secondary}
          >
            <Copy className="size-4" aria-hidden />
            {t("split.copy")}
          </button>
          <button type="button" onClick={() => void shareMessage()} className={buttonStyles.primary}>
            <MessageCircle className="size-4" aria-hidden />
            {t("split.send")}
          </button>
        </div>
      </div>

      {imageFor && (
        <ShareImage draft={draft} share={imageFor.share} payerName={name(payer.id, payer.name)} onReady={(n) => void onImageReady(n)} />
      )}
    </div>
  );
}

/** Split the bill of a receipt between friends (opened from the studio or History). */
export function SplitDialog() {
  const t = useT();
  const receiptId = useUiStore((s) => s.splitReceiptId);
  const setSplitReceiptId = useUiStore((s) => s.setSplitReceiptId);

  function close() {
    // Save the result to the cloud for signed-in users (studio autosave only
    // covers the receipt that's open in the editor).
    if (receiptId && useAuthStore.getState().status === "signed-in") {
      const r = useReceiptStore.getState().receipts[receiptId];
      if (r && isDirty(r)) void pushReceipts([r]).catch(() => undefined);
    }
    setSplitReceiptId(null);
  }

  return (
    <Dialog open={receiptId !== null} onClose={close} size="lg" title={t("split.title")} description={t("split.subtitle")}>
      {receiptId && <SplitEditor receiptId={receiptId} onClose={close} />}
    </Dialog>
  );
}

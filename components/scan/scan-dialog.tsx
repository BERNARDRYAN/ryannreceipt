"use client";

import { Camera, ImageUp, LoaderCircle, RotateCcw, ScanText, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CATEGORY_ICONS } from "@/components/quick-add/category-icons";
import { inputClass, NumberInput } from "@/components/receipt/editor/fields";
import { buttonStyles, Dialog } from "@/components/ui/dialog";
import { useT, type MessageKey } from "@/lib/i18n/messages";
import { createBlankDraft, localDateTimeNow } from "@/lib/receipts/defaults";
import { prepareForOcr } from "@/lib/scan/image";
import { recognizeReceipt, type OcrProgress } from "@/lib/scan/ocr";
import { parseReceiptText, reconcileItems } from "@/lib/scan/parse-receipt";
import { useAuthStore } from "@/lib/store/auth-store";
import { useReceiptStore } from "@/lib/store/receipt-store";
import { toast } from "@/lib/store/toast-store";
import { useUiStore } from "@/lib/store/ui-store";
import { pushReceipts } from "@/lib/sync/cloud";
import { uploadReceiptPhoto } from "@/lib/sync/photos";
import { formatAmount } from "@/lib/utils/currency";
import { CATEGORIES, PAYMENT_METHODS, type Category, type ReceiptDraft } from "@/lib/validators/receipt-schema";

type Review = {
  merchantName: string;
  merchantAddress: string;
  merchantPhone: string;
  receiptDate: string;
  category: Category;
  paymentMethod: ReceiptDraft["paymentMethod"];
  wallet: string;
  taxRate: number;
  serviceChargeRate: number;
  items: { id: string; name: string; qty: number; price: number }[];
};

type Phase = { kind: "pick" } | { kind: "reading"; progress: OcrProgress } | { kind: "review"; review: Review } | { kind: "error" };

/**
 * Photo → receipt. OCR runs on the device; the parsed fields are shown for a
 * quick check before anything is saved. Signed-in users can keep the photo.
 */
function Scanner({ initialFile, onDone }: { initialFile: File | null; onDone: () => void }) {
  const t = useT();
  const router = useRouter();
  const signedIn = useAuthStore((s) => s.status === "signed-in");
  const addReceipts = useReceiptStore((s) => s.addReceipts);
  const [file, setFile] = useState<File | null>(initialFile);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() =>
    initialFile ? URL.createObjectURL(initialFile) : null,
  );
  const [chinese, setChinese] = useState(false);
  const [keepPhoto, setKeepPhoto] = useState(true);
  const [phase, setPhase] = useState<Phase>(() =>
    initialFile ? { kind: "reading", progress: { stage: "loading", progress: 0 } } : { kind: "pick" },
  );
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  function scan(image: File) {
    setFile(image);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(image);
    });
    setPhase({ kind: "reading", progress: { stage: "loading", progress: 0 } });
    void read(image);
  }

  /** OCR + parse; only sets state after awaiting, so it's safe to start from an effect. */
  async function read(image: File, withChinese = chinese) {
    try {
      const canvas = await prepareForOcr(image);
      const text = await recognizeReceipt(canvas, {
        chinese: withChinese,
        onProgress: (progress) => setPhase({ kind: "reading", progress }),
      });
      const parsed = parseReceiptText(text);
      const fallbackName = parsed.merchantName || t("scan.purchase");
      const { items, taxRate, serviceChargeRate } = reconcileItems(parsed, fallbackName, t("scan.charges"));
      setPhase({
        kind: "review",
        review: {
          merchantName: parsed.merchantName,
          merchantAddress: parsed.merchantAddress,
          merchantPhone: parsed.merchantPhone,
          receiptDate: parsed.receiptDate || localDateTimeNow(),
          category: parsed.category ?? "General",
          paymentMethod: parsed.paymentMethod ?? "CASH",
          wallet: parsed.wallet,
          taxRate,
          serviceChargeRate,
          items: items.map((i) => ({ ...i, id: crypto.randomUUID() })),
        },
      });
    } catch {
      setPhase({ kind: "error" });
    }
  }

  // Started from the share sheet or with a file already chosen.
  useEffect(() => {
    if (initialFile && !started.current) {
      started.current = true;
      void read(initialFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function create(review: Review) {
    setSaving(true);
    const draft: ReceiptDraft = {
      ...createBlankDraft(),
      title: "Receipt",
      merchantName: review.merchantName.slice(0, 60),
      merchantAddress: review.merchantAddress.slice(0, 160),
      merchantPhone: review.merchantPhone.slice(0, 32),
      receiptDate: review.receiptDate,
      category: review.category,
      paymentMethod: review.paymentMethod,
      wallet: review.wallet.slice(0, 30),
      taxRate: review.taxRate,
      serviceChargeRate: review.serviceChargeRate,
      // Cash receipts are usually already rounded; keep the scanned total.
      roundCash: review.paymentMethod === "CASH",
      notes: "",
      tags: ["scanned"],
      items: review.items.filter((i) => i.name.trim() || i.price > 0).slice(0, 100),
    };
    const [id] = addReceipts([{ draft }]);
    try {
      if (id && signedIn) {
        if (keepPhoto && file) {
          await uploadReceiptPhoto(id, file);
          useReceiptStore.getState().patchDraft(id, { hasPhoto: true });
        }
        const receipt = useReceiptStore.getState().receipts[id];
        if (receipt) await pushReceipts([receipt]);
      }
    } catch {
      toast(t("photo.uploadFailed"), { tone: "error" });
    } finally {
      setSaving(false);
    }
    if (id) {
      toast(t("scan.created"), { tone: "success" });
      router.push(`/studio?id=${id}`);
    }
    onDone();
  }

  const fileInputs = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])}
      />
      <input
        ref={pickRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])}
      />
    </>
  );

  if (phase.kind === "pick" || phase.kind === "error") {
    return (
      <div className="relative space-y-4">
        {fileInputs}
        {phase.kind === "error" && (
          <p role="alert" className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-danger">
            {t("scan.failed")}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-2xl bg-accent px-4 py-6 text-sm font-medium text-accent-contrast hover:opacity-90"
          >
            <Camera className="size-6" aria-hidden />
            {t("scan.takePhoto")}
          </button>
          <button
            type="button"
            onClick={() => pickRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-2xl px-4 py-6 text-sm font-medium ring-1 ring-border hover:bg-surface-muted"
          >
            <ImageUp className="size-6" aria-hidden />
            {t("scan.choose")}
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={chinese} onChange={(e) => setChinese(e.target.checked)} />
          {t("scan.chinese")}
        </label>
        {signedIn && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={keepPhoto} onChange={(e) => setKeepPhoto(e.target.checked)} />
            {t("scan.keepPhoto")}
          </label>
        )}
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("scan.privacy")}
        </p>
      </div>
    );
  }

  if (phase.kind === "reading") {
    const { stage, progress } = phase.progress;
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="max-h-56 rounded-lg object-contain shadow-md" />
        )}
        <div className="w-full space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              {stage === "loading" ? t("scan.loading") : t("scan.reading")}
            </span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full rounded-full bg-viz-accent transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    );
  }

  const review = phase.review;
  const update = (patch: Partial<Review>) => setPhase({ kind: "review", review: { ...review, ...patch } });
  const total =
    review.items.reduce((s, i) => s + i.qty * i.price, 0) *
    (1 + review.serviceChargeRate / 100) *
    (1 + review.taxRate / 100);

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted">{t("scan.checkHint")}</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 space-y-1.5">
          <span className="block text-xs font-medium text-muted">{t("field.storeName")}</span>
          <input className={inputClass} value={review.merchantName} onChange={(e) => update({ merchantName: e.target.value })} />
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">{t("field.date")}</span>
          <input
            type="datetime-local"
            className={inputClass}
            value={review.receiptDate}
            onChange={(e) => e.target.value && update({ receiptDate: e.target.value })}
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">{t("field.paymentMethod")}</span>
          <select
            className={inputClass}
            value={review.paymentMethod}
            onChange={(e) => update({ paymentMethod: e.target.value as Review["paymentMethod"] })}
          >
            {PAYMENT_METHODS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>

      <div role="radiogroup" aria-label={t("field.category")} className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICONS[c];
          const active = review.category === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => update({ category: c })}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                active ? "bg-accent text-accent-contrast" : "text-muted ring-1 ring-border hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" aria-hidden />
              {t(`cat.${c}` as MessageKey)}
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-muted">{t("items.title")}</span>
        <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
          {review.items.map((item, i) => (
            <li key={item.id} className="grid grid-cols-[1fr_3rem_5rem_2rem] gap-1.5">
              <input
                aria-label={`Item ${i + 1} name`}
                className={inputClass}
                value={item.name}
                onChange={(e) =>
                  update({ items: review.items.map((it) => (it.id === item.id ? { ...it, name: e.target.value } : it)) })
                }
              />
              <NumberInput
                aria-label={`Item ${i + 1} quantity`}
                integer
                max={9999}
                className="px-2 text-right"
                value={item.qty}
                onValueChange={(qty) =>
                  update({ items: review.items.map((it) => (it.id === item.id ? { ...it, qty } : it)) })
                }
              />
              <NumberInput
                aria-label={`Item ${i + 1} unit price`}
                decimals={2}
                max={1_000_000}
                className="px-2 text-right"
                value={item.price}
                onValueChange={(price) =>
                  update({ items: review.items.map((it) => (it.id === item.id ? { ...it, price } : it)) })
                }
              />
              <button
                type="button"
                aria-label={`Remove item ${i + 1}`}
                onClick={() => update({ items: review.items.filter((it) => it.id !== item.id) })}
                className="flex items-center justify-center rounded-md text-muted hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <p className="text-right text-sm font-semibold tabular-nums">
          {t("summary.total")}: {formatAmount(total, "MYR")}
          {(review.taxRate > 0 || review.serviceChargeRate > 0) && (
            <span className="font-normal text-muted">
              {" "}
              ({[review.serviceChargeRate && `+${review.serviceChargeRate}%`, review.taxRate && `SST ${review.taxRate}%`]
                .filter(Boolean)
                .join(", ")})
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => file && scan(file)}
          className={buttonStyles.ghost}
          disabled={!file || saving}
        >
          <RotateCcw className="size-4" aria-hidden />
          {t("scan.rescan")}
        </button>
        <button type="button" onClick={() => void create(review)} className={buttonStyles.primary} disabled={saving}>
          {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <ScanText className="size-4" aria-hidden />}
          {t("scan.create")}
        </button>
      </div>
    </div>
  );
}

export function ScanDialog() {
  const t = useT();
  const open = useUiStore((s) => s.scanOpen);
  const file = useUiStore((s) => s.scanFile);
  const close = useUiStore((s) => s.closeScan);
  return (
    <Dialog open={open} onClose={close} title={t("scan.title")} description={t("scan.subtitle")}>
      {open && <Scanner initialFile={file} onDone={close} />}
    </Dialog>
  );
}

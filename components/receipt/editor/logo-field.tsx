"use client";

import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { useRef, useState } from "react";

import { toast } from "@/lib/store/toast-store";
import { ditherLogo, LogoError } from "@/lib/utils/dither";

export function LogoField({ value, onChange }: { value: string; onChange: (logo: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await ditherLogo(file));
    } catch (err) {
      toast(err instanceof LogoError ? err.message : "Couldn't process that image.", { tone: "error" });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1">
      <span className="block text-xs font-medium text-muted">Logo</span>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-[#faf9f5]">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Logo preview" className="max-h-12 max-w-20 [image-rendering:pixelated]" />
          ) : (
            <span className="text-[11px] text-neutral-500">No logo</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ring-1 ring-border hover:bg-surface-muted disabled:opacity-50"
          >
            {busy ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="size-3.5" aria-hidden />
            )}
            {value ? "Replace" : "Upload"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-surface-muted hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      <p className="text-[11px] text-muted">Converted to 1-bit dots, like a real thermal printer.</p>
    </div>
  );
}

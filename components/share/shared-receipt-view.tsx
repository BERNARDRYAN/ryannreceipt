"use client";

import { Download } from "lucide-react";
import { useRef, useState } from "react";

import { ReceiptCanvas } from "@/components/receipt/receipt-canvas";
import { downloadNodeAsPng, exportBasename } from "@/lib/utils/export-canvas";
import type { ReceiptDraft } from "@/lib/validators/receipt-schema";

/** Read-only receipt with a download button, for the public share page. */
export function SharedReceiptView({ draft }: { draft: ReceiptDraft }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!ref.current) return;
    setBusy(true);
    try {
      await downloadNodeAsPng(ref.current, exportBasename(draft.merchantName, draft.receiptNo), 2);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="receipt-shadow">
        <ReceiptCanvas ref={ref} draft={draft} />
      </div>
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast shadow-sm hover:opacity-90 disabled:opacity-50"
      >
        <Download className="size-4" aria-hidden />
        Download image
      </button>
      <p className="max-w-xs text-center text-xs text-muted">
        A view-only copy shared with RyannReceipt. Private details like payment accounts are never included.
      </p>
    </div>
  );
}

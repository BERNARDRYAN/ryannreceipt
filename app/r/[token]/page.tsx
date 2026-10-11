import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BrandMark } from "@/components/brand-mark";
import { SharedReceiptView } from "@/components/share/shared-receipt-view";
import { normalizeDraft } from "@/lib/receipts/defaults";
import { createPublicClient } from "@/lib/supabase/public";
import { receiptDraftSchema, type ReceiptDraft } from "@/lib/validators/receipt-schema";

export const metadata: Metadata = {
  title: "Shared receipt",
  description: "A receipt shared with RyannReceipt.",
  // Private links: keep them out of search engines.
  robots: { index: false, follow: false },
};

async function loadSnapshot(token: string): Promise<ReceiptDraft | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const { data, error } = await createPublicClient().rpc("get_receipt_share", { p_token: token });
  if (error || !data) return null;
  const parsed = receiptDraftSchema.safeParse(normalizeDraft(data as Partial<ReceiptDraft>));
  return parsed.success ? parsed.data : null;
}

async function SharedReceipt({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const draft = await loadSnapshot(token);
  if (!draft) notFound();
  return <SharedReceiptView draft={draft} />;
}

/** Public, view-only page for a shared receipt (no account needed). */
export default function SharedReceiptPage({ params }: PageProps<"/r/[token]">) {
  return (
    <div className="desk-surface flex min-h-dvh flex-col items-center px-4 py-8">
      <header className="mb-6 flex w-full max-w-md items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark className="size-6" />
          <span className="font-mono text-sm font-bold">RyannReceipt</span>
        </Link>
        <Link href="/studio" className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast">
          Make your own
        </Link>
      </header>
      <Suspense fallback={<div className="h-[520px] w-[302px] animate-pulse rounded-sm bg-surface/50" />}>
        <SharedReceipt params={params} />
      </Suspense>
    </div>
  );
}

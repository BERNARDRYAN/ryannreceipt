import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";

export const SUPPORT_EMAIL = "ryannplan.app@gmail.com";

/** Plain, readable layout for the privacy policy and terms (English only). */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-surface/90">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 rounded-md p-1 text-sm font-bold">
            <BrandMark className="size-6" />
            <span className="font-mono tracking-tight">RyannReceipt</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
        <div className="legal mt-8 space-y-4 text-[15px] leading-relaxed">{children}</div>
        <p className="mt-12 border-t border-border pt-6 text-sm text-muted">
          Questions? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>
          .{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="underline underline-offset-2">
            Terms
          </Link>
        </p>
      </main>
    </div>
  );
}

export const H2 = ({ children }: { children: ReactNode }) => <h2 className="pt-4 text-lg font-semibold">{children}</h2>;
export const UL = ({ children }: { children: ReactNode }) => <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;

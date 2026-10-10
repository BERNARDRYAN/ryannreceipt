import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-4">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">Ryann Suite</p>
        <h1 className="font-mono text-4xl font-bold tracking-tight sm:text-5xl">RyannReceipt</h1>
        <p className="max-w-md text-lg text-muted">
          Print-perfect thermal receipts in your browser, plus a quiet little ledger for expenses and
          warranties.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/studio"
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast hover:opacity-90"
        >
          Open the studio
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <span className="text-sm text-muted">No account needed. Drafts stay on this device.</span>
      </div>
      <pre aria-hidden className="select-none font-mono text-xs leading-relaxed text-muted">
        {"--------------------------------\n  THANK YOU · PLEASE COME AGAIN\n--------------------------------"}
      </pre>
      <p className="text-xs text-muted">
        Questions or feedback?{" "}
        <a href="mailto:ryannplan.app@gmail.com" className="underline underline-offset-2 hover:text-foreground">
          ryannplan.app@gmail.com
        </a>
      </p>
    </main>
  );
}

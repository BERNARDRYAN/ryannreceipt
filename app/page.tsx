import {
  ArrowRight,
  Calculator,
  CloudCog,
  FileDown,
  History,
  Printer,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { SampleReceipt } from "@/components/landing/sample-receipt";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Printer,
    title: "Looks genuinely printed",
    body: "80mm or 58mm rolls, torn edges, mono, typewriter or dot-matrix type, and logos dithered to 1-bit dots.",
  },
  {
    icon: Calculator,
    title: "Totals done right",
    body: "SST or VAT (added or included), service charge, discounts, 5-sen cash rounding and change, all in exact cents.",
  },
  {
    icon: FileDown,
    title: "Export anywhere",
    body: "PNG at up to 4x, a PDF sized to the roll, print straight to a thermal printer, or copy and share the image.",
  },
  {
    icon: History,
    title: "Spending at a glance",
    body: "Monthly totals and category breakdowns build up automatically from the receipts you keep.",
  },
  {
    icon: ShieldCheck,
    title: "Warranty reminders",
    body: "Add a warranty date and History flags anything expiring in the next 30 days.",
  },
  {
    icon: CloudCog,
    title: "Local-first, cloud when you want",
    body: "Works without an account, even offline. Sign in with Google to back up and sync across devices.",
  },
];

const STEPS = [
  { title: "Design", body: "Fill in the merchant, items and charges. The paper updates as you type." },
  { title: "Export", body: "Download a crisp PNG or PDF, print it, or paste it straight into a chat." },
  { title: "Keep", body: "Every receipt lands in History with spending summaries and warranty tracking." },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark className="size-7" />
          <span className="font-mono text-sm font-bold tracking-tight">RyannReceipt</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          <Link href="/history" className="rounded-md px-3 py-1.5 text-muted hover:text-foreground">
            History
          </Link>
          <Link
            href="/studio"
            className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-contrast hover:opacity-90"
          >
            Open studio
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16 lg:pb-24">
          <div className="space-y-6">
            <p className="font-mono text-xs tracking-[0.3em] text-muted uppercase">Ryann Suite</p>
            <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Receipts that look printed. Records that stay organised.
            </h1>
            <p className="max-w-lg text-lg text-pretty text-muted">
              Design authentic thermal receipts in your browser, export them anywhere, and keep a quiet ledger of
              your spending and warranties.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/studio"
                className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-medium text-accent-contrast hover:opacity-90"
              >
                Make a receipt
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/history"
                className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-medium ring-1 ring-border hover:bg-surface"
              >
                View history
              </Link>
            </div>
            <p className="text-sm text-muted">Free · No account needed · Drafts stay on your device</p>
          </div>
          <div className="flex justify-center rounded-2xl bg-desk px-6 py-10 sm:py-14">
            <SampleReceipt />
          </div>
        </section>

        <section aria-labelledby="features-heading" className="border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <h2 id="features-heading" className="text-2xl font-semibold tracking-tight">
              Everything a receipt needs
            </h2>
            <div className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <Icon className="size-5" aria-hidden />
                  <h3 className="mt-3 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="how-heading" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="how-heading" className="text-2xl font-semibold tracking-tight">
            How it works
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-xl border border-border bg-surface p-5">
                <span className="font-mono text-xs text-muted">0{i + 1}</span>
                <h3 className="mt-2 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-xl bg-accent px-6 py-6 text-accent-contrast sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold">Your first receipt takes about a minute.</p>
              <p className="text-sm opacity-75">Install it as an app from your browser to use it offline.</p>
            </div>
            <Link
              href="/studio"
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-accent-contrast px-4 py-2 text-sm font-medium text-accent hover:opacity-90"
            >
              Open the studio
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>RyannReceipt · part of the Ryann Suite, alongside RyannPlan and RyannPace.</p>
          <p>
            Questions or feedback?{" "}
            <a href="mailto:ryannplan.app@gmail.com" className="underline underline-offset-2 hover:text-foreground">
              ryannplan.app@gmail.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

"use client";

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
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { BrandMark } from "@/components/brand-mark";
import { SampleReceipt } from "@/components/landing/sample-receipt";
import { SettingsMenu } from "@/components/settings-menu";
import { useT, type MessageKey } from "@/lib/i18n/messages";

// Tracking first; the receipt maker is the bonus.
const FEATURES: { icon: LucideIcon; title: MessageKey; body: MessageKey }[] = [
  { icon: History, title: "landing.f4Title", body: "landing.f4Body" },
  { icon: ShieldCheck, title: "landing.f5Title", body: "landing.f5Body" },
  { icon: CloudCog, title: "landing.f6Title", body: "landing.f6Body" },
  { icon: Printer, title: "landing.f1Title", body: "landing.f1Body" },
  { icon: Calculator, title: "landing.f2Title", body: "landing.f2Body" },
  { icon: FileDown, title: "landing.f3Title", body: "landing.f3Body" },
];

const STEPS: { title: MessageKey; body: MessageKey }[] = [
  { title: "landing.s1Title", body: "landing.s1Body" },
  { title: "landing.s2Title", body: "landing.s2Body" },
  { title: "landing.s3Title", body: "landing.s3Body" },
];

export function LandingContent() {
  const t = useT();
  const router = useRouter();

  // Returning users came to track spending: take them straight home.
  useEffect(() => {
    try {
      if (localStorage.getItem("ryannreceipt:home") === "1") router.replace("/history");
    } catch {
      // Storage blocked: stay on the landing page.
    }
  }, [router]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark className="size-7" />
          <span className="font-mono text-sm font-bold tracking-tight">RyannReceipt</span>
        </Link>
        <nav aria-label={t("nav.main")} className="flex items-center gap-1 text-sm">
          <Link href="/studio" className="hidden rounded-lg px-3 py-1.5 text-muted hover:text-foreground sm:inline">
            {t("nav.studio")}
          </Link>
          <SettingsMenu />
          <Link
            href="/history"
            className="ml-1 rounded-lg bg-accent px-3.5 py-1.5 font-medium text-accent-contrast shadow-sm hover:opacity-90"
          >
            {t("landing.openStudio")}
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-14 lg:pb-24">
          <div className="space-y-7 animate-[fade-up_500ms_ease-out]">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] tracking-[0.25em] text-muted uppercase">
              <span className="size-1.5 rounded-full bg-viz-accent" aria-hidden />
              {t("landing.eyebrow")}
            </p>
            <h1 className="text-[2.6rem] leading-[1.02] font-semibold tracking-tight text-balance sm:text-6xl lg:text-[4.25rem]">
              {t("landing.titleA")}{" "}
              <span className="font-display font-normal tracking-normal italic">{t("landing.titleAccent")}</span>
              <span className="mt-2 block text-muted">{t("landing.titleB")}</span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-pretty text-muted">{t("landing.sub")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/history"
                className="group inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-medium text-accent-contrast shadow-lg shadow-black/10 transition-transform hover:-translate-y-0.5"
              >
                {t("landing.cta")}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <Link
                href="/studio"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium ring-1 ring-border hover:bg-surface"
              >
                {t("landing.viewHistory")}
              </Link>
            </div>
            <p className="text-sm text-muted">{t("landing.note")}</p>
          </div>
          <div className="desk-surface relative flex justify-center overflow-hidden rounded-3xl px-6 pt-0 pb-10 shadow-inner">
            <div className="flex flex-col items-center">
              <div className="printer" style={{ width: 346 }} aria-hidden>
                <span className="printer-label">RYANN·80</span>
                <span className="printer-led" />
              </div>
              <div className="-mt-2.5 overflow-hidden px-6 pb-6">
                <div className="receipt-feed">
                  <SampleReceipt />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="features-heading" className="border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 id="features-heading" className="font-display text-4xl tracking-tight sm:text-5xl">
              {t("landing.featuresTitle")}
            </h2>
            <div className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-surface-muted">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-semibold">{t(title)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(body)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="how-heading" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 id="how-heading" className="font-display text-4xl tracking-tight sm:text-5xl">
            {t("landing.howTitle")}
          </h2>
          <ol className="mt-10 grid gap-5 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-2xl border border-border bg-surface p-6">
                <span className="font-display text-3xl text-muted italic">0{i + 1}</span>
                <h3 className="mt-3 font-semibold">{t(step.title)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(step.body)}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex flex-col items-start justify-between gap-5 rounded-3xl bg-accent px-7 py-8 text-accent-contrast sm:flex-row sm:items-center">
            <div>
              <p className="font-display text-3xl">{t("landing.ctaTitle")}</p>
              <p className="mt-1 text-sm opacity-75">{t("landing.ctaBody")}</p>
            </div>
            <Link
              href="/history"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent-contrast px-5 py-3 text-sm font-medium text-accent hover:opacity-90"
            >
              {t("history.openStudio")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{t("landing.footer")}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href="/privacy" className="underline-offset-2 hover:text-foreground hover:underline">
              {t("legal.privacy")}
            </Link>
            <Link href="/terms" className="underline-offset-2 hover:text-foreground hover:underline">
              {t("legal.terms")}
            </Link>
            <span>
            {t("landing.contact")}{" "}
            <a href="mailto:ryannplan.app@gmail.com" className="underline underline-offset-2 hover:text-foreground">
              ryannplan.app@gmail.com
            </a>
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}

"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import type { PublicUser } from "@/lib/auth/public-user";
import { useLocale, useT } from "@/lib/i18n/messages";
import { useAuthStore } from "@/lib/store/auth-store";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
// The nonce cookie lives 10 minutes; re-arm GIS a little before it expires.
const NONCE_REFRESH_MS = 9 * 60 * 1000;

async function fetchHashedNonce() {
  const res = await fetch("/api/auth/google/token", { cache: "no-store" });
  if (!res.ok) throw new Error("nonce");
  const { nonce } = (await res.json()) as { nonce: string };
  return nonce;
}

// Each nonce request overwrites the single nonce cookie, so requests must never
// overlap: if two raced (e.g. StrictMode's double effect), GIS could end up
// initialised with one nonce while the cookie holds the other. Serialising them
// means the last nonce handed to GIS is always the one in the cookie.
let nonceQueue: Promise<unknown> = Promise.resolve();
function nextHashedNonce() {
  const next = nonceQueue.then(fetchHashedNonce);
  nonceQueue = next.catch(() => undefined);
  return next;
}

/**
 * "Sign in with Google" via Google Identity Services.
 *
 * Every attempt uses a fresh server-issued nonce (see the token route), so GIS is
 * re-initialised after each credential and periodically while idle.
 */
const GIS_LOCALE = { en: "en", zh: "zh_CN", ms: "ms" } as const;

export function GoogleAuthButton() {
  const t = useT();
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [gisReady, setGisReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gisReady) return;
    let cancelled = false;

    async function arm() {
      const gis = window.google?.accounts.id;
      if (!gis || !containerRef.current) return;
      try {
        const nonce = await nextHashedNonce();
        if (cancelled || !containerRef.current) return;
        gis.initialize({
          client_id: CLIENT_ID,
          nonce,
          callback: onCredential,
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
          context: "signin",
          itp_support: true,
          use_fedcm_for_button: true,
        });
        // Icon-only on phones, where the studio header is tight.
        const compact = window.matchMedia("(max-width: 639px)").matches;
        gis.renderButton(containerRef.current, {
          type: compact ? "icon" : "standard",
          theme: "outline",
          size: "medium",
          text: "signin",
          shape: "pill",
          logo_alignment: "left",
          locale: GIS_LOCALE[locale],
        });
      } catch {
        if (!cancelled) setError(t("auth.unavailable"));
      }
    }

    async function onCredential({ credential }: google.accounts.id.CredentialResponse) {
      setError(null);
      try {
        const res = await fetch("/api/auth/google/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
          throw new Error(body.detail ?? body.error ?? String(res.status));
        }
        const { user } = (await res.json()) as { user: PublicUser };
        useAuthStore.getState().setUser(user);
      } catch (err) {
        console.warn("[RyannReceipt] Google sign-in failed:", err instanceof Error ? err.message : err);
        if (!cancelled) setError(t("auth.failed"));
        // The nonce was burned by the attempt; issue a new one.
        void arm();
      }
    }

    void arm();
    const timer = window.setInterval(() => void arm(), NONCE_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [gisReady, locale, t]);

  return (
    <div className="flex items-center gap-2">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setGisReady(true)} />
      {error && (
        <span role="alert" className="hidden text-xs text-danger lg:inline">
          {error}
        </span>
      )}
      {/* Fixed height keeps the header steady while Google renders its iframe. */}
      <div ref={containerRef} className="flex h-8 min-w-8 items-center overflow-hidden sm:min-w-22" />
    </div>
  );
}

"use client";

import { CloudUpload, X } from "lucide-react";

import { useT } from "@/lib/i18n/messages";
import { useAuthStore } from "@/lib/store/auth-store";
import { usePrefsHydrated, usePrefsStore } from "@/lib/store/prefs-store";
import { toast } from "@/lib/store/toast-store";

/**
 * Explains why to sign in (backup + sync) instead of a lone button. The CTA
 * opens Google One Tap with the already-armed nonce; if the browser suppresses
 * it, we point at the header button.
 */
export function SignInBanner() {
  const t = useT();
  const signedOut = useAuthStore((s) => s.status === "signed-out");
  const hydrated = usePrefsHydrated();
  const dismissed = usePrefsStore((s) => s.signInBannerDismissed);
  const guideDone = usePrefsStore((s) => s.guideDone);
  const dismiss = usePrefsStore((s) => s.dismissSignInBanner);

  // Wait until the first-visit tour is done so the screen isn't crowded.
  if (!hydrated || !signedOut || dismissed || !guideDone) return null;

  function signIn() {
    const gis = window.google?.accounts.id;
    if (!gis) {
      toast(t("auth.useButton"));
      return;
    }
    gis.prompt();
    const button = document.querySelector<HTMLElement>('[data-guide="sign-in"]');
    button?.animate(
      [{ boxShadow: "0 0 0 0 rgba(235,104,52,.7)" }, { boxShadow: "0 0 0 12px rgba(235,104,52,0)" }],
      { duration: 900, iterations: 3 },
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface-muted/60 px-4 py-2 text-sm animate-[fade-up_200ms_ease-out]">
      <CloudUpload className="size-4 shrink-0 text-muted" aria-hidden />
      <p className="min-w-0 flex-1 text-muted">{t("banner.text")}</p>
      <button
        type="button"
        onClick={signIn}
        className="shrink-0 rounded-lg bg-accent px-3 py-1 text-xs font-medium text-accent-contrast hover:opacity-90"
      >
        {t("banner.cta")}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("common.dismiss")}
        className="shrink-0 rounded-md p-1 text-muted hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

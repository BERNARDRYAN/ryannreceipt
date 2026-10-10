"use client";

import { useEffect } from "react";

import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { UserMenu } from "@/components/auth/user-menu";
import { useAuthStore } from "@/lib/store/auth-store";

/** Header slot: Google button when signed out, avatar menu when signed in. */
export function AuthControl() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const load = useAuthStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "loading") {
    return <div aria-hidden className="size-8 animate-pulse rounded-full bg-surface-muted" />;
  }
  return status === "signed-in" && user ? <UserMenu user={user} /> : <GoogleAuthButton />;
}

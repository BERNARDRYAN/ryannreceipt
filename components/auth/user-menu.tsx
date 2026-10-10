"use client";

import { LoaderCircle, LogOut } from "lucide-react";
import Image from "next/image";
import { useId, useState } from "react";

import type { PublicUser } from "@/lib/auth/public-user";
import { useAuthStore } from "@/lib/store/auth-store";

function Avatar({ user, size }: { user: PublicUser; size: number }) {
  if (user.avatarUrl) {
    return (
      <Image
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        unoptimized
        referrerPolicy="no-referrer"
        className="rounded-full"
      />
    );
  }
  const initial = (user.name ?? user.email ?? "?").charAt(0).toUpperCase();
  return (
    <span
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-contrast"
    >
      {initial}
    </span>
  );
}

/** Avatar button with a native-popover account menu (light-dismiss + Esc for free). */
export function UserMenu({ user }: { user: PublicUser }) {
  const signOut = useAuthStore((s) => s.signOut);
  const [signingOut, setSigningOut] = useState(false);
  const menuId = useId();

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
  }

  return (
    <>
      <button
        type="button"
        popoverTarget={menuId}
        aria-label={`Account: ${user.name ?? user.email ?? "signed in"}`}
        className="rounded-full p-0.5 ring-1 ring-border hover:ring-foreground/40"
      >
        <Avatar user={user} size={28} />
      </button>
      <div
        id={menuId}
        popover="auto"
        className="fixed inset-auto top-14 right-4 m-0 w-64 rounded-lg border border-border bg-surface p-1.5 text-foreground shadow-lg"
      >
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar user={user} size={36} />
          <div className="min-w-0">
            {user.name && <p className="truncate text-sm font-medium">{user.name}</p>}
            {user.email && <p className="truncate text-xs text-muted">{user.email}</p>}
          </div>
        </div>
        <div className="my-1 border-t border-border" />
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-50"
        >
          {signingOut ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <LogOut className="size-4" aria-hidden />
          )}
          Sign out
        </button>
      </div>
    </>
  );
}

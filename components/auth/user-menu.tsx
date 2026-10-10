"use client";

import { History, LoaderCircle, LogOut, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";

import { buttonStyles, Dialog } from "@/components/ui/dialog";
import type { PublicUser } from "@/lib/auth/public-user";
import { useT } from "@/lib/i18n/messages";
import { useAuthStore } from "@/lib/store/auth-store";
import { useReceiptStore } from "@/lib/store/receipt-store";
import { toast } from "@/lib/store/toast-store";
import { deleteAccountData } from "@/lib/sync/cloud";

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

const menuItem =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-50";

/** Avatar button with a native-popover account menu (light-dismiss + Esc for free). */
export function UserMenu({ user }: { user: PublicUser }) {
  const t = useT();
  const signOut = useAuthStore((s) => s.signOut);
  const clearLibrary = useReceiptStore((s) => s.clearLibrary);
  const [signingOut, setSigningOut] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [alsoLocal, setAlsoLocal] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const menuId = useId();

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const { deleted } = await deleteAccountData();
      if (alsoLocal) clearLibrary();
      setConfirmOpen(false);
      toast(t("delete.done", { receipts: deleted.receipts, presets: deleted.presets }), { tone: "success" });
      await signOut();
    } catch {
      toast(t("delete.failed"), { tone: "error" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        popoverTarget={menuId}
        aria-label={t("menu.account", { name: user.name ?? user.email ?? "" })}
        className="rounded-full p-0.5 ring-1 ring-border hover:ring-foreground/40"
      >
        <Avatar user={user} size={28} />
      </button>
      <div
        id={menuId}
        popover="auto"
        className="fixed inset-auto top-14 right-4 m-0 w-64 rounded-xl border border-border bg-surface p-1.5 text-foreground shadow-xl shadow-black/10"
      >
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar user={user} size={36} />
          <div className="min-w-0">
            {user.name && <p className="truncate text-sm font-medium">{user.name}</p>}
            {user.email && <p className="truncate text-xs text-muted">{user.email}</p>}
          </div>
        </div>
        <div className="my-1 border-t border-border" />
        <Link href="/history" className={menuItem}>
          <History className="size-4" aria-hidden />
          {t("menu.history")}
        </Link>
        <button type="button" onClick={handleSignOut} disabled={signingOut} className={menuItem}>
          {signingOut ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <LogOut className="size-4" aria-hidden />
          )}
          {t("menu.signOut")}
        </button>
        <div className="my-1 border-t border-border" />
        <button
          type="button"
          onClick={() => {
            document.getElementById(menuId)?.hidePopover();
            setConfirmText("");
            setConfirmOpen(true);
          }}
          className={`${menuItem} text-danger`}
        >
          <Trash2 className="size-4" aria-hidden />
          {t("menu.deleteData")}
        </button>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => !deleting && setConfirmOpen(false)}
        title={t("delete.title")}
        description={t("delete.body")}
        actions={
          <>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className={buttonStyles.ghost}
              disabled={deleting}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className={buttonStyles.danger}
              disabled={deleting || confirmText !== "DELETE"}
            >
              {deleting && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {t("delete.confirm")}
            </button>
          </>
        }
      >
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={alsoLocal} onChange={(e) => setAlsoLocal(e.target.checked)} />
          {t("delete.alsoLocal")}
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted">{t("delete.typeToConfirm", { word: "DELETE" })}</span>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-sm outline-none focus:border-foreground/60"
          />
        </label>
      </Dialog>
    </>
  );
}

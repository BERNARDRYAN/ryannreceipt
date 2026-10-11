"use client";

import { Copy, Link2, LoaderCircle, MessageCircle, RefreshCw, Unlink } from "lucide-react";
import { useEffect, useState } from "react";

import { inputClass } from "@/components/receipt/editor/fields";
import { buttonStyles, Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/messages";
import { useAuthStore } from "@/lib/store/auth-store";
import { isDirty, useReceiptStore } from "@/lib/store/receipt-store";
import { toast } from "@/lib/store/toast-store";
import { useUiStore } from "@/lib/store/ui-store";
import { pushReceipts } from "@/lib/sync/cloud";

const api = (id: string) => `/api/receipts/${encodeURIComponent(id)}/share`;

function ShareLink({ receiptId }: { receiptId: string }) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(api(receiptId), { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { url: null }))
      .then((data: { url: string | null }) => {
        if (!cancelled) setUrl(data.url);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [receiptId]);

  /** Create or refresh the link from the latest saved version. */
  async function publish() {
    setBusy(true);
    try {
      const r = useReceiptStore.getState().receipts[receiptId];
      if (r && isDirty(r)) await pushReceipts([r]);
      const res = await fetch(api(receiptId), { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { url: string };
      setUrl(data.url);
      await navigator.clipboard.writeText(data.url).catch(() => undefined);
      toast(t("link.copied"), { tone: "success" });
    } catch {
      toast(t("link.failed"), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      const res = await fetch(api(receiptId), { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      setUrl(null);
      toast(t("link.revoked"));
    } catch {
      toast(t("link.failed"), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-4 text-sm text-muted">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {t("common.loading")}
      </p>
    );
  }

  if (!url) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">{t("link.explain")}</p>
        <button type="button" onClick={() => void publish()} disabled={busy} className={buttonStyles.primary}>
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
          {t("link.create")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input readOnly value={url} aria-label={t("link.title")} className={`${inputClass} font-mono text-xs`} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            toast(t("link.copied"), { tone: "success" });
          }}
          className={`${buttonStyles.secondary} shrink-0`}
        >
          <Copy className="size-4" aria-hidden />
          {t("link.copy")}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonStyles.primary}
        >
          <MessageCircle className="size-4" aria-hidden />
          {t("split.send")}
        </a>
        <button type="button" onClick={() => void publish()} disabled={busy} className={buttonStyles.secondary}>
          <RefreshCw className="size-4" aria-hidden />
          {t("link.update")}
        </button>
        <button type="button" onClick={() => void revoke()} disabled={busy} className={`${buttonStyles.ghost} text-danger`}>
          <Unlink className="size-4" aria-hidden />
          {t("link.stop")}
        </button>
      </div>
      <p className="text-xs text-muted">{t("link.note")}</p>
    </div>
  );
}

export function ShareLinkDialog() {
  const t = useT();
  const receiptId = useUiStore((s) => s.shareLinkReceiptId);
  const setId = useUiStore((s) => s.setShareLinkReceiptId);
  const signedIn = useAuthStore((s) => s.status === "signed-in");
  return (
    <Dialog open={receiptId !== null} onClose={() => setId(null)} title={t("link.title")} description={t("link.subtitle")}>
      {receiptId && (signedIn ? <ShareLink receiptId={receiptId} /> : <p className="text-sm text-muted">{t("link.signIn")}</p>)}
    </Dialog>
  );
}

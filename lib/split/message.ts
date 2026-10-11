import type { TFunction } from "@/lib/i18n/messages";
import type { SplitResult } from "@/lib/split/calc";
import { formatAmount } from "@/lib/utils/currency";
import { ME, type PayInfo, type ReceiptDraft } from "@/lib/validators/receipt-schema";

/** "DuitNow 012-345 6789 · Maybank 1234 5678 (Ryan Sim)" from whatever is filled in. */
export function payInfoLine(info: PayInfo) {
  const parts = [
    info.duitnow && `DuitNow ${info.duitnow}`,
    (info.bank || info.account) && `${info.bank} ${info.account}`.trim(),
  ].filter(Boolean);
  if (!parts.length) return "";
  return `${parts.join(" · ")}${info.name ? ` (${info.name})` : ""}`;
}

/**
 * A chat-ready summary of who owes what, for WhatsApp/Telegram. Written in the
 * user's language; amounts and dish names stay as on the receipt.
 */
export function splitMessage(
  draft: ReceiptDraft,
  result: SplitResult,
  payInfo: PayInfo,
  t: TFunction,
  displayName: (id: string, name: string) => string,
) {
  const money = (n: number) => `${draft.currency} ${formatAmount(n, draft.currency)}`;
  const payer = result.people.find((p) => p.isPayer)!;
  const lines = [
    `🧾 ${draft.merchantName || t("list.untitled")} · ${draft.receiptDate.slice(0, 10)}`,
    "",
  ];
  for (const p of result.people) {
    if (p.isPayer) continue;
    const dishes = p.items.map((i) => (i.qty > 1 ? `${i.qty}× ${i.name}` : i.name)).join(", ");
    const status = p.paid ? ` ✅ ${t("split.paidShort")}` : "";
    lines.push(`• ${displayName(p.id, p.name)}: ${money(p.total)}${dishes ? ` (${dishes})` : ""}${status}`);
  }
  lines.push("");
  lines.push(t("split.msgTotal", { total: money(result.people.reduce((s, p) => s + p.total, 0)), payer: displayName(payer.id, payer.name) }));
  if (payer.id === ME) {
    const info = payInfoLine(payInfo);
    if (info) lines.push(t("split.msgPayMe", { info }));
    if (payInfo.note) lines.push(payInfo.note);
  }
  lines.push("", t("split.msgFooter"));
  return lines.join("\n");
}

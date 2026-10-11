import type { NextRequest } from "next/server";
import { z } from "zod";

import { dbError, json, jsonError, requireUser } from "@/lib/api/guard";
import { rowToRecord, type ReceiptRow } from "@/lib/receipts/mapping";
import type { ReceiptDraft } from "@/lib/validators/receipt-schema";

/**
 * View-only share links. The link shows a frozen snapshot of the *printed*
 * receipt: private extras (split names, wallet, tags, tax relief, photo) are
 * stripped. One link per receipt; sharing again refreshes the snapshot but
 * keeps the same URL.
 */

async function receiptId(routeCtx: RouteContext<"/api/receipts/[id]/share">) {
  const { id } = await routeCtx.params;
  const parsed = z.uuid().safeParse(id);
  return parsed.success ? parsed.data : null;
}

function publicSnapshot(draft: ReceiptDraft): ReceiptDraft {
  return { ...draft, split: null, wallet: "", tags: [], taxRelief: "", hasPhoto: false };
}

function newToken() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
}

const linkFor = (request: NextRequest, token: string) => new URL(`/r/${token}`, request.nextUrl.origin).toString();

/** The existing link for this receipt, if any. */
export async function GET(request: NextRequest, routeCtx: RouteContext<"/api/receipts/[id]/share">) {
  const ctx = await requireUser(request, { limit: 120 });
  if (ctx instanceof Response) return ctx;
  const id = await receiptId(routeCtx);
  if (!id) return jsonError("Not found", 404);

  const { data, error } = await ctx.supabase
    .from("receipt_shares")
    .select("token")
    .eq("user_id", ctx.user.id)
    .eq("receipt_id", id)
    .maybeSingle<{ token: string }>();
  if (error) return dbError("get share", error);
  return json({ url: data ? linkFor(request, data.token) : null });
}

/** Create (or refresh) the link from the receipt as currently saved in the cloud. */
export async function POST(request: NextRequest, routeCtx: RouteContext<"/api/receipts/[id]/share">) {
  const ctx = await requireUser(request, { limit: 30 });
  if (ctx instanceof Response) return ctx;
  const id = await receiptId(routeCtx);
  if (!id) return jsonError("Not found", 404);

  const { data: row, error: rowError } = await ctx.supabase
    .from("receipt_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .maybeSingle<ReceiptRow>();
  if (rowError) return dbError("load receipt for share", rowError);
  if (!row) return jsonError("Save the receipt to your account first", 404);

  const snapshot = publicSnapshot(rowToRecord(row).draft);
  const { data: existing } = await ctx.supabase
    .from("receipt_shares")
    .select("token")
    .eq("user_id", ctx.user.id)
    .eq("receipt_id", id)
    .maybeSingle<{ token: string }>();

  const token = existing?.token ?? newToken();
  const { error } = await ctx.supabase
    .from("receipt_shares")
    .upsert({ token, user_id: ctx.user.id, receipt_id: id, snapshot }, { onConflict: "user_id,receipt_id" });
  if (error) return dbError("save share", error);
  return json({ url: linkFor(request, token) });
}

/** Stop sharing: the link stops working immediately. */
export async function DELETE(request: NextRequest, routeCtx: RouteContext<"/api/receipts/[id]/share">) {
  const ctx = await requireUser(request, { limit: 30 });
  if (ctx instanceof Response) return ctx;
  const id = await receiptId(routeCtx);
  if (!id) return jsonError("Not found", 404);

  const { error } = await ctx.supabase.from("receipt_shares").delete().eq("user_id", ctx.user.id).eq("receipt_id", id);
  if (error) return dbError("delete share", error);
  return json({ ok: true });
}

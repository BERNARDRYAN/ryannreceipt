import type { NextRequest } from "next/server";
import { z } from "zod";

import { dbError, json, jsonError, parseJson, requireUser } from "@/lib/api/guard";
import { draftToRow, rowToRecord, type ReceiptRow } from "@/lib/receipts/mapping";
import { receiptPatchSchema } from "@/lib/validators/receipt-schema";

const idSchema = z.uuid();

async function readId(ctx: RouteContext<"/api/receipts/[id]">) {
  const { id } = await ctx.params;
  const parsed = idSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

/** Full receipt (items, style, logo) for opening in the studio. */
export async function GET(request: NextRequest, routeCtx: RouteContext<"/api/receipts/[id]">) {
  const ctx = await requireUser(request, { limit: 120 });
  if (ctx instanceof Response) return ctx;
  const id = await readId(routeCtx);
  if (!id) return jsonError("Not found", 404);

  const { data, error } = await ctx.supabase
    .from("receipt_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .maybeSingle<ReceiptRow>();

  if (error) return dbError("get receipt", error);
  if (!data) return jsonError("Not found", 404);
  return json({ receipt: rowToRecord(data) });
}

/** Pin/unpin and/or replace the draft content. */
export async function PATCH(request: NextRequest, routeCtx: RouteContext<"/api/receipts/[id]">) {
  const ctx = await requireUser(request);
  if (ctx instanceof Response) return ctx;
  const id = await readId(routeCtx);
  if (!id) return jsonError("Not found", 404);

  const body = await parseJson(request, receiptPatchSchema, 1_000_000);
  if ("error" in body) return body.error;
  const { isPinned, draft } = body.data;

  const update: Record<string, unknown> = draft ? draftToRow(id, ctx.user.id, isPinned ?? false, draft) : {};
  // id/user_id are never updatable from the client; pin only changes when asked.
  delete update.id;
  delete update.user_id;
  if (isPinned === undefined) delete update.is_pinned;
  else update.is_pinned = isPinned;

  const { data, error } = await ctx.supabase
    .from("receipt_items")
    .update(update)
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .select("id,updated_at")
    .maybeSingle();

  if (error) return dbError("update receipt", error);
  if (!data) return jsonError("Not found", 404);
  return json({ saved: { id: data.id as string, updatedAt: data.updated_at as string } });
}

export async function DELETE(request: NextRequest, routeCtx: RouteContext<"/api/receipts/[id]">) {
  const ctx = await requireUser(request);
  if (ctx instanceof Response) return ctx;
  const id = await readId(routeCtx);
  if (!id) return jsonError("Not found", 404);

  const { error } = await ctx.supabase.from("receipt_items").delete().eq("id", id).eq("user_id", ctx.user.id);
  if (error) return dbError("delete receipt", error);
  // Best effort: a receipt may have no share link or photo.
  await ctx.supabase.from("receipt_shares").delete().eq("user_id", ctx.user.id).eq("receipt_id", id);
  await ctx.supabase.storage.from("receipt-photos").remove([`${ctx.user.id}/${id}.jpg`]);
  return json({ ok: true });
}

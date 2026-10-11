import type { NextRequest } from "next/server";
import { z } from "zod";

import { dbError, json, jsonError, requireUser } from "@/lib/api/guard";

const BUCKET = "receipt-photos";
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/webp"]);

async function photoPath(routeCtx: RouteContext<"/api/receipts/[id]/photo">, userId: string) {
  const { id } = await routeCtx.params;
  const parsed = z.uuid().safeParse(id);
  // Folder = owner's id, enforced again by the Storage RLS policies.
  return parsed.success ? `${userId}/${parsed.data}.jpg` : null;
}

/** Short-lived signed URL for the receipt photo (bucket is private). */
export async function GET(request: NextRequest, routeCtx: RouteContext<"/api/receipts/[id]/photo">) {
  const ctx = await requireUser(request, { limit: 120 });
  if (ctx instanceof Response) return ctx;
  const path = await photoPath(routeCtx, ctx.user.id);
  if (!path) return jsonError("Not found", 404);

  const { data, error } = await ctx.supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data) return jsonError("Not found", 404);
  return json({ url: data.signedUrl });
}

/** Upload or replace the photo. Body: the compressed image bytes. */
export async function PUT(request: NextRequest, routeCtx: RouteContext<"/api/receipts/[id]/photo">) {
  const ctx = await requireUser(request, { limit: 30 });
  if (ctx instanceof Response) return ctx;
  const path = await photoPath(routeCtx, ctx.user.id);
  if (!path) return jsonError("Not found", 404);

  const type = request.headers.get("content-type")?.split(";")[0] ?? "";
  if (!TYPES.has(type)) return jsonError("Use a JPEG or WebP image", 415);
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return jsonError("Photo too large", 413);

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return jsonError("Photo too large", 413);
  // Magic bytes: JPEG FF D8 FF, WebP "RIFF....WEBP".
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45;
  if (!isJpeg && !isWebp) return jsonError("Not an image", 415);

  const { error } = await ctx.supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: type, upsert: true, cacheControl: "3600" });
  if (error) return dbError("upload photo", { message: error.message });
  return json({ ok: true });
}

export async function DELETE(request: NextRequest, routeCtx: RouteContext<"/api/receipts/[id]/photo">) {
  const ctx = await requireUser(request, { limit: 30 });
  if (ctx instanceof Response) return ctx;
  const path = await photoPath(routeCtx, ctx.user.id);
  if (!path) return jsonError("Not found", 404);

  const { error } = await ctx.supabase.storage.from(BUCKET).remove([path]);
  if (error) return dbError("delete photo", { message: error.message });
  return json({ ok: true });
}

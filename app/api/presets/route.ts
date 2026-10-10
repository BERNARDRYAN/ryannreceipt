import type { NextRequest } from "next/server";
import { z } from "zod";

import { dbError, json, jsonError, parseJson, requireUser } from "@/lib/api/guard";
import { presetToRow, rowToPreset, type PresetRow } from "@/lib/receipts/mapping";
import { presetInputSchema } from "@/lib/validators/receipt-schema";

const MAX_PRESETS = 50;

export async function GET(request: NextRequest) {
  const ctx = await requireUser(request, { limit: 120 });
  if (ctx instanceof Response) return ctx;

  const { data, error } = await ctx.supabase
    .from("receipt_presets")
    .select("*")
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: true })
    .limit(MAX_PRESETS)
    .returns<PresetRow[]>();

  if (error) return dbError("list presets", error);
  return json({ presets: data.map(rowToPreset) });
}

export async function POST(request: NextRequest) {
  const ctx = await requireUser(request, { limit: 30 });
  if (ctx instanceof Response) return ctx;

  const body = await parseJson(request, presetInputSchema, 400_000);
  if ("error" in body) return body.error;

  const { count, error: countError } = await ctx.supabase
    .from("receipt_presets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.user.id);
  if (countError) return dbError("count presets", countError);
  if ((count ?? 0) >= MAX_PRESETS) return jsonError(`You can keep up to ${MAX_PRESETS} presets`, 409);

  const { data, error } = await ctx.supabase
    .from("receipt_presets")
    .insert(presetToRow(ctx.user.id, body.data))
    .select("*")
    .single<PresetRow>();

  if (error) return dbError("create preset", error);
  return json({ preset: rowToPreset(data) }, 201);
}

export async function DELETE(request: NextRequest) {
  const ctx = await requireUser(request, { limit: 30 });
  if (ctx instanceof Response) return ctx;

  const id = z.uuid().safeParse(request.nextUrl.searchParams.get("id"));
  if (!id.success) return jsonError("Not found", 404);

  const { error } = await ctx.supabase
    .from("receipt_presets")
    .delete()
    .eq("id", id.data)
    .eq("user_id", ctx.user.id);
  if (error) return dbError("delete preset", error);
  return json({ ok: true });
}

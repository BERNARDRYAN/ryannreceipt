import type { NextRequest } from "next/server";

import { dbError, json, parseJson, requireUser } from "@/lib/api/guard";
import { userSettingsSchema } from "@/lib/validators/receipt-schema";

// Defaults for fields added after a user's settings were first saved.
const DEFAULTS = {
  friends: [],
  payInfo: { duitnow: "", bank: "", account: "", name: "", note: "" },
  homeCurrency: "MYR",
};

/** The signed-in user's synced settings (budgets, recurring expenses), or null. */
export async function GET(request: NextRequest) {
  const ctx = await requireUser(request, { limit: 120 });
  if (ctx instanceof Response) return ctx;

  const { data, error } = await ctx.supabase
    .from("receipt_settings")
    .select("data")
    .eq("user_id", ctx.user.id)
    .maybeSingle<{ data: unknown }>();
  if (error) return dbError("get settings", error);

  // Anything stored before a schema change is dropped rather than trusted.
  const parsed = data ? userSettingsSchema.safeParse({ ...DEFAULTS, ...(data.data as object) }) : null;
  return json({ settings: parsed?.success ? parsed.data : null });
}

/** Replace the settings document (last write wins, by `updatedAt`). */
export async function PUT(request: NextRequest) {
  const ctx = await requireUser(request, { limit: 60 });
  if (ctx instanceof Response) return ctx;

  const body = await parseJson(request, userSettingsSchema, 64_000);
  if ("error" in body) return body.error;

  const { error } = await ctx.supabase
    .from("receipt_settings")
    .upsert({ user_id: ctx.user.id, data: body.data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return dbError("save settings", error);
  return json({ ok: true });
}

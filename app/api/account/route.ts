import type { NextRequest } from "next/server";

import { dbError, json, requireUser } from "@/lib/api/guard";

/**
 * Delete everything RyannReceipt stores for this user, then sign out.
 *
 * Deliberately does NOT delete the auth user: the Supabase project is shared
 * across the Ryann Suite, so removing `auth.users` would also wipe the person's
 * RyannPace and RyannPlan accounts. RLS already limits the deletes to own rows;
 * the explicit user_id filters are belt and braces.
 */
export async function DELETE(request: NextRequest) {
  const ctx = await requireUser(request, { limit: 5 });
  if (ctx instanceof Response) return ctx;

  const receipts = await ctx.supabase
    .from("receipt_items")
    .delete({ count: "exact" })
    .eq("user_id", ctx.user.id);
  if (receipts.error) return dbError("delete account receipts", receipts.error);

  const presets = await ctx.supabase
    .from("receipt_presets")
    .delete({ count: "exact" })
    .eq("user_id", ctx.user.id);
  if (presets.error) return dbError("delete account presets", presets.error);

  await ctx.supabase.auth.signOut();
  return json({ deleted: { receipts: receipts.count ?? 0, presets: presets.count ?? 0 } });
}

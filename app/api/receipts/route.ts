import type { NextRequest } from "next/server";

import { dbError, json, parseJson, requireUser } from "@/lib/api/guard";
import { draftToRow, RECEIPT_SUMMARY_COLUMNS, type ReceiptSummaryRow } from "@/lib/receipts/mapping";
import { receiptBatchSchema } from "@/lib/validators/receipt-schema";

const MAX_LIST = 1000;

/** List the signed-in user's receipts as lightweight summaries (no items/logo). */
export async function GET(request: NextRequest) {
  const ctx = await requireUser(request, { limit: 120 });
  if (ctx instanceof Response) return ctx;

  const { data, error } = await ctx.supabase
    .from("receipt_items")
    .select(RECEIPT_SUMMARY_COLUMNS)
    .eq("user_id", ctx.user.id)
    .order("is_pinned", { ascending: false })
    .order("receipt_date", { ascending: false })
    .limit(MAX_LIST)
    .returns<ReceiptSummaryRow[]>();

  if (error) return dbError("list receipts", error);
  return json({
    receipts: data.map((r) => ({
      id: r.id,
      title: r.title,
      merchantName: r.merchant_name,
      receiptNo: r.receipt_no ?? "",
      receiptDate: r.receipt_date.slice(0, 16),
      currency: r.currency,
      total: Number(r.total),
      category: r.category,
      paymentMethod: r.payment_method,
      warrantyUntil: r.warranty_until ?? "",
      isPinned: r.is_pinned,
      wallet: typeof r.meta?.wallet === "string" ? r.meta.wallet : "",
      tags: Array.isArray(r.meta?.tags) ? r.meta.tags : [],
      taxRelief: r.meta?.taxRelief ?? "",
      myShare: typeof r.meta?.myShare === "number" ? r.meta.myShare : Number(r.total),
      split: r.meta?.splitSummary ?? null,
      updatedAt: r.updated_at,
    })),
  });
}

/**
 * Create or update up to 50 receipts (local-draft sync and studio autosave).
 * Rows are keyed by the client's uuid; RLS rejects ids owned by someone else.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireUser(request, { limit: 60 });
  if (ctx instanceof Response) return ctx;

  const body = await parseJson(request, receiptBatchSchema, 4_000_000);
  if ("error" in body) return body.error;

  const rows = body.data.receipts.map((r) => draftToRow(r.id, ctx.user.id, r.isPinned, r.draft));
  const { data, error } = await ctx.supabase
    .from("receipt_items")
    .upsert(rows, { onConflict: "id" })
    .select("id,updated_at");

  if (error) return dbError("upsert receipts", error);
  return json({ saved: data.map((r) => ({ id: r.id as string, updatedAt: r.updated_at as string })) });
}

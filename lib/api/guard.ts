import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { ZodType } from "zod";

import { clientIp, isSameOrigin, rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const noStore = { "Cache-Control": "no-store" };

export function jsonError(message: string, status: number, headers: HeadersInit = {}) {
  return NextResponse.json({ error: message }, { status, headers: { ...noStore, ...headers } });
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

type AuthedContext = { supabase: SupabaseClient; user: User };

/**
 * Common BFF gate for authenticated routes:
 *   1. same-origin check on mutating methods (CSRF),
 *   2. per-IP throttle (cheap, before touching Supabase),
 *   3. verified user via `getUser()` (also refreshes the session cookies),
 *   4. per-user throttle.
 * Returns either the context or a ready-to-send error response.
 */
export async function requireUser(
  request: NextRequest,
  { limit = 60 }: { limit?: number } = {},
): Promise<AuthedContext | NextResponse> {
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (mutating && !isSameOrigin(request.headers)) return jsonError("Forbidden", 403);

  const ipLimit = await rateLimit(`ip:${clientIp(request.headers)}`, limit * 2);
  if (!ipLimit.ok) return tooMany(ipLimit.resetAt);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return jsonError("Not signed in", 401);

  const userLimit = await rateLimit(`user:${data.user.id}:${request.method}`, limit);
  if (!userLimit.ok) return tooMany(userLimit.resetAt);

  return { supabase, user: data.user };
}

function tooMany(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return jsonError("Too many requests", 429, { "Retry-After": String(retryAfter) });
}

/** Parse and validate a JSON body against `schema`, with a byte cap. */
export async function parseJson<T>(
  request: NextRequest,
  schema: ZodType<T>,
  maxBytes = 1_000_000,
): Promise<{ data: T } | { error: NextResponse }> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return { error: jsonError("Payload too large", 413) };

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { error: jsonError("Invalid body", 400) };
  }
  if (text.length > maxBytes) return { error: jsonError("Payload too large", 413) };

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { error: jsonError("Invalid JSON body", 400) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Paths only, never values: enough to debug without echoing user input.
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join(".") || "(root)"))].slice(0, 5);
    return { error: NextResponse.json({ error: "Invalid request", fields }, { status: 400, headers: noStore }) };
  }
  return { data: parsed.data };
}

/** Log the real database error server-side; send a generic message to the client. */
export function dbError(context: string, error: { message: string; code?: string }) {
  console.error(`[api] ${context}: ${error.code ?? ""} ${error.message}`);
  return jsonError("Database error", 500);
}

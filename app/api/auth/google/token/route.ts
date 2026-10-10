import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toPublicUser } from "@/lib/auth/public-user";
import { clientIp, isSameOrigin, rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * Google Identity Services -> Supabase sign-in, with replay-safe nonces.
 *
 *  1. GET  issues a fresh random nonce. The raw value is stored in a short-lived
 *     httpOnly cookie; only its SHA-256 hex digest is returned to the browser.
 *  2. The browser initialises GIS with `nonce: <hashed>`, so Google embeds the
 *     hash in the ID token's `nonce` claim.
 *  3. POST receives the GIS credential, reads the raw nonce from the cookie
 *     (single use), and hands both to `signInWithIdToken`. Supabase hashes the
 *     raw nonce and compares it to the token claim. Session cookies are then set
 *     httpOnly by `lib/supabase/server.ts`.
 */

const NONCE_COOKIE = "rr_gis_nonce";
const NONCE_TTL_SECONDS = 10 * 60;
const isProd = process.env.NODE_ENV === "production";

const nonceCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "strict" as const,
  path: "/api/auth/google",
};

const noStore = { "Cache-Control": "no-store" };

const tokenRequestSchema = z.strictObject({
  // Google ID tokens are compact JWS strings: three base64url segments.
  credential: z
    .string()
    .min(20)
    .max(4096)
    .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),
});

function toBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function jsonError(message: string, status: number, headers: HeadersInit = {}) {
  return NextResponse.json({ error: message }, { status, headers: { ...noStore, ...headers } });
}

export async function GET(request: NextRequest) {
  const limit = rateLimit(`gis-nonce:${clientIp(request.headers)}`, 30);
  if (!limit.ok) return jsonError("Too many requests", 429);

  const cookieStore = await cookies();
  const rawNonce = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  cookieStore.set(NONCE_COOKIE, rawNonce, { ...nonceCookieOptions, maxAge: NONCE_TTL_SECONDS });

  return NextResponse.json({ nonce: await sha256Hex(rawNonce) }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers)) return jsonError("Forbidden", 403);

  const limit = rateLimit(`gis-token:${clientIp(request.headers)}`, 10);
  if (!limit.ok) {
    const retryAfter = Math.ceil((limit.resetAt - Date.now()) / 1000);
    return jsonError("Too many requests", 429, { "Retry-After": String(retryAfter) });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = tokenRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid credential", 400);

  const cookieStore = await cookies();
  const rawNonce = cookieStore.get(NONCE_COOKIE)?.value;
  // Single use: burn the nonce whether or not sign-in succeeds.
  cookieStore.delete({ name: NONCE_COOKIE, path: nonceCookieOptions.path });
  if (!rawNonce) return jsonError("Nonce missing or expired", 400);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: parsed.data.credential,
    nonce: rawNonce,
  });

  if (error || !data.user) {
    const reason = error?.message ?? "no user returned";
    console.error(`[auth/google] signInWithIdToken failed: ${reason}`);
    // Supabase's reason is useful while developing; production stays generic.
    return NextResponse.json(
      { error: "Google sign-in failed", ...(isProd ? {} : { detail: reason }) },
      { status: 401, headers: noStore },
    );
  }

  return NextResponse.json({ user: toPublicUser(data.user) }, { headers: noStore });
}

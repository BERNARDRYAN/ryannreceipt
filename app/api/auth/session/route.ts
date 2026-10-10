import { NextResponse, type NextRequest } from "next/server";

import { toPublicUser } from "@/lib/auth/public-user";
import { clientIp, isSameOrigin, rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

const noStore = { "Cache-Control": "no-store" };

/**
 * Who is signed in. `getUser()` verifies the JWT with Supabase (never trusts the
 * cookie blindly) and refreshes an expired access token, rewriting the httpOnly
 * cookies on this response.
 */
export async function GET(request: NextRequest) {
  const limit = await rateLimit(`session:${clientIp(request.headers)}`, 120);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: noStore });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = error || !data.user ? null : toPublicUser(data.user);
  return NextResponse.json({ user }, { headers: noStore });
}

/** Sign out: revokes the refresh token and clears the session cookies. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request.headers)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true }, { headers: noStore });
}

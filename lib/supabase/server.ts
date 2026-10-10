import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const isProd = process.env.NODE_ENV === "production";

/**
 * Server Supabase client bound to the request's cookies.
 *
 * Every auth cookie it writes is forced to httpOnly + SameSite=Lax (+ Secure in
 * production) so browser JavaScript can never read the access/refresh tokens.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                httpOnly: true,
                secure: isProd,
                sameSite: "lax",
                path: "/",
              }),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Session refresh happens in route handlers / the proxy instead.
          }
        },
      },
    },
  );
}

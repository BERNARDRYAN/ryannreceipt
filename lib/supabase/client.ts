import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client.
 *
 * Session cookies are httpOnly (see `server.ts`), so this client never sees the
 * user's JWT and acts as the anonymous role only. Authenticated reads/writes go
 * through the BFF routes under `/app/api`. Persistence is disabled so the client
 * can't write tokens into JS-readable storage.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

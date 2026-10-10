import type { User } from "@supabase/supabase-js";

/** The only user fields the BFF ever sends to the browser. */
export type PublicUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

export function toPublicUser(user: User): PublicUser {
  const meta = user.user_metadata ?? {};
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    id: user.id,
    email: user.email ?? null,
    name: str(meta.full_name) ?? str(meta.name),
    avatarUrl: str(meta.avatar_url) ?? str(meta.picture),
  };
}

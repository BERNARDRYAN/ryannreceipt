import "server-only";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; remaining: number; resetAt: number };

/** Fixed-window counter in this isolate's memory (fast first line of defence). */
function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  bucket.count += 1;
  return {
    ok: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/**
 * Cloudflare's Rate Limiting binding (see wrangler.jsonc), shared by every
 * isolate in a location. Absent under `next dev` / `next start`, where only
 * the in-memory limiter applies.
 */
async function edgeLimit(key: string, limit: number): Promise<boolean> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const binding = limit <= 10 ? env.RL_AUTH : limit <= 60 ? env.RL_WRITE : env.RL_READ;
    if (!binding) return true;
    const { success } = await binding.limit({ key });
    return success;
  } catch {
    return true;
  }
}

/** In-memory window plus, on Cloudflare, the edge rate limiter. Both must pass. */
export async function rateLimit(key: string, limit = 60, windowMs = 60_000): Promise<RateLimitResult> {
  const local = memoryLimit(key, limit, windowMs);
  if (!local.ok) return local;
  const edgeOk = await edgeLimit(key, limit);
  return edgeOk ? local : { ok: false, remaining: 0, resetAt: Date.now() + windowMs };
}

export function clientIp(headers: Headers) {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Rejects cross-site POSTs: the Origin header must match this request's host. */
export function isSameOrigin(headers: Headers) {
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

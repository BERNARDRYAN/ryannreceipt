import "server-only";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Fixed-window, in-memory rate limiter. Per-instance only: swap for a KV/Redis
 * store when running on multiple instances or on Workers.
 */
export function rateLimit(key: string, limit = 60, windowMs = 60_000) {
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

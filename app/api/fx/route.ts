import { NextResponse, type NextRequest } from "next/server";

import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { CURRENCIES } from "@/lib/validators/receipt-schema";

/**
 * Daily reference exchange rates (European Central Bank, via the free
 * Frankfurter API), relative to EUR, for the currencies RyannReceipt supports.
 * Proxied so the browser CSP stays closed and the upstream is hit rarely.
 */

type Rates = { date: string; base: "EUR"; rates: Record<string, number> };

const SOURCES = ["https://api.frankfurter.dev/v1/latest?base=EUR", "https://api.frankfurter.app/latest?from=EUR"];
const TTL_MS = 6 * 60 * 60 * 1000;
let cache: { at: number; data: Rates } | null = null;

async function fetchRates(): Promise<Rates> {
  for (const url of SOURCES) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const json = (await res.json()) as { date?: string; rates?: Record<string, number> };
      if (!json.rates || !json.date) continue;
      const rates: Record<string, number> = { EUR: 1 };
      for (const c of CURRENCIES) {
        const r = json.rates[c];
        if (typeof r === "number" && r > 0) rates[c] = r;
      }
      return { date: json.date, base: "EUR", rates };
    } catch {
      // try the next source
    }
  }
  throw new Error("rates unavailable");
}

export async function GET(request: NextRequest) {
  const limit = await rateLimit(`fx:${clientIp(request.headers)}`, 60);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  if (!cache || Date.now() - cache.at > TTL_MS) {
    try {
      cache = { at: Date.now(), data: await fetchRates() };
    } catch {
      // Serve stale rates rather than nothing.
      if (!cache) return NextResponse.json({ error: "Rates unavailable" }, { status: 503 });
    }
  }
  return NextResponse.json(cache.data, { headers: { "Cache-Control": "public, max-age=21600" } });
}

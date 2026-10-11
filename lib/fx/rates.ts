"use client";

import { useEffect, useState } from "react";

import type { Currency } from "@/lib/validators/receipt-schema";

export type FxRates = { date: string; rates: Record<string, number> };

const KEY = "ryannreceipt:fx";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

function readCache(): (FxRates & { at: number }) | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

/**
 * Convert between currencies via EUR cross rates. Same currency is exact;
 * returns null when a rate is unknown (the caller decides what to show).
 */
export function convert(amount: number, from: Currency, to: Currency, fx: FxRates | null): number | null {
  if (from === to) return amount;
  const a = fx?.rates[from];
  const b = fx?.rates[to];
  if (!a || !b) return null;
  return Math.round(((amount / a) * b + Number.EPSILON) * 100) / 100;
}

/**
 * Today's reference rates: from this device's cache when fresh (works
 * offline), otherwise from /api/fx. Null until something is available.
 */
export function useFxRates(needed: boolean) {
  const [fx, setFx] = useState<FxRates | null>(null);

  useEffect(() => {
    if (!needed) return;
    let cancelled = false;
    const cached = readCache();
    const fresh = cached && Date.now() - cached.at < MAX_AGE_MS;
    // Read through a microtask so this effect never sets state synchronously.
    void Promise.resolve().then(() => {
      if (!cancelled && cached) setFx({ date: cached.date, rates: cached.rates });
    });
    if (fresh) return;
    fetch("/api/fx")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: FxRates) => {
        if (cancelled) return;
        setFx({ date: data.date, rates: data.rates });
        try {
          localStorage.setItem(KEY, JSON.stringify({ ...data, at: Date.now() }));
        } catch {
          // storage full or blocked: rates still work for this session
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [needed]);

  return fx;
}

import { describe, expect, it } from "vitest";

import { convert } from "@/lib/fx/rates";

const fx = { date: "2026-10-09", rates: { EUR: 1, MYR: 4.5777, THB: 37.574, SGD: 1.4348 } };

describe("convert", () => {
  it("is exact for the same currency", () => {
    expect(convert(12.34, "MYR", "MYR", null)).toBe(12.34);
  });

  it("converts through EUR cross rates", () => {
    // 100 THB -> EUR 2.6614 -> MYR 12.18
    expect(convert(100, "THB", "MYR", fx)).toBe(12.18);
    expect(convert(10, "SGD", "MYR", fx)).toBe(31.9);
  });

  it("returns null when a rate is missing", () => {
    expect(convert(10, "JPY", "MYR", fx)).toBeNull();
    expect(convert(10, "THB", "MYR", null)).toBeNull();
  });
});

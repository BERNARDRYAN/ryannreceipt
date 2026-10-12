import { describe, expect, it } from "vitest";

import { smartTitle } from "@/lib/utils/text";

describe("smartTitle", () => {
  it("keeps acronyms and brands in capitals", () => {
    expect(smartTitle("tnb bill")).toBe("TNB Bill");
    expect(smartTitle("kfc")).toBe("KFC");
    expect(smartTitle("mr diy")).toBe("MR DIY");
    expect(smartTitle("AEON BIG KL")).toBe("AEON Big KL");
    expect(smartTitle("bbq chicken")).toBe("BBQ Chicken");
  });

  it("title-cases ordinary words and leaves mixed case alone", () => {
    expect(smartTitle("nasi lemak ayam")).toBe("Nasi Lemak Ayam");
    expect(smartTitle("JAYA GROCER")).toBe("Jaya Grocer");
    expect(smartTitle("iPhone case")).toBe("iPhone Case");
    expect(smartTitle("McDonald's")).toBe("McDonald's");
    expect(smartTitle("7-eleven")).toBe("7-eleven");
  });
});

describe("stripCompanySuffix", () => {
  it("keeps the brand before a company suffix", async () => {
    const { stripCompanySuffix } = await import("@/lib/scan/parse-receipt");
    expect(stripCompanySuffix("KKV Business Managenent SDN.BHD Be")).toBe("KKV Business Managenent");
    expect(stripCompanySuffix("MR DIY (M) SDN BHD (1234-X)")).toBe("MR DIY");
    expect(stripCompanySuffix("AEON CO. (M) BHD")).toBe("AEON CO");
    expect(stripCompanySuffix("Jaya Grocer")).toBe("Jaya Grocer");
    expect(stripCompanySuffix("SDN BHD")).toBe("SDN BHD");
  });
});

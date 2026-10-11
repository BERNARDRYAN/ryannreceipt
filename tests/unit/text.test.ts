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

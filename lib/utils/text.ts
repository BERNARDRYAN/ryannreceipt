/** Brands and abbreviations that are always written in capitals. */
const ALWAYS_UPPER = new Set(["AEON", "IKEA", "KFC", "TNB", "TNG", "IWK", "DBKL", "LHDN", "KL", "MR", "DIY", "MCD", "GSC", "TGV", "SST", "ATM", "TV", "USB", "BBQ", "KLCC", "LRT", "MRT", "KTM", "ERL", "MBPJ"]);

/**
 * Title-case a shop or item name without mangling acronyms:
 * "tnb bill" → "TNB Bill", "AEON BIG KL" → "AEON Big KL", "iPhone case" → "iPhone Case".
 * Words the user already wrote in mixed case are left alone.
 */
export function smartTitle(text: string) {
  return text.replace(/[\p{L}\p{N}'’-]+/gu, (word) => {
    const upper = word.toUpperCase();
    if (ALWAYS_UPPER.has(upper)) return upper;
    // Short consonant-only words are almost always abbreviations (TNB, BBQ, KK).
    if (/^\p{L}{3,4}$/u.test(word) && !/[aeiouy]/i.test(word) && /^[a-z]+$/i.test(word)) return upper;
    const mixed = /\p{Ll}/u.test(word) && /\p{Lu}/u.test(word.slice(1));
    if (mixed) return word;
    const lower = word === upper ? word.toLowerCase() : word;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

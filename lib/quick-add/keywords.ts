import type { Category } from "@/lib/validators/receipt-schema";

type PaymentMethod = "CASH" | "CARD" | "E-WALLET" | "QR PAY" | "BANK TRANSFER";

/**
 * Words that hint at a category, in English, Malay and Chinese, plus common
 * Malaysian merchants. Matched against whole words (Latin) or substrings (CJK).
 */
export const CATEGORY_KEYWORDS: Record<Exclude<Category, "General" | "Other">, string[]> = {
  "Food & Drink": [
    "food", "lunch", "dinner", "breakfast", "brunch", "supper", "coffee", "tea", "drink", "snack", "cafe",
    "restaurant", "makan", "minum", "sarapan", "nasi", "mee", "roti", "kopi", "teh", "ayam", "ikan",
    "satay", "laksa", "mamak", "kopitiam", "hawker", "kfc", "mcd", "mcdonald", "mcdonalds", "starbucks",
    "zus", "tealive", "chagee", "subway", "pizza", "dominos", "texas", "secret recipe", "oldtown", "boba",
    "bubble", "grabfood", "foodpanda", "shopeefood", "饭", "面", "咖啡", "茶", "早餐", "午餐", "晚餐", "宵夜", "奶茶",
  ],
  Groceries: [
    "grocery", "groceries", "supermarket", "market", "pasar", "runcit", "sayur", "beras", "telur", "susu",
    "aeon", "lotus", "lotuss", "tesco", "giant", "mydin", "jaya grocer", "village grocer", "speedmart",
    "99 speedmart", "kk mart", "family mart", "familymart", "7-eleven", "7eleven", "econsave", "nsk",
    "菜", "超市", "杂货",
  ],
  Transport: [
    "grab", "taxi", "uber", "bus", "lrt", "mrt", "ktm", "erl", "train", "flight", "airasia", "parking",
    "parkir", "toll", "tol", "petrol", "minyak", "fuel", "shell", "petronas", "petron", "caltex", "bhp",
    "rapidkl", "touch n go reload", "airport", "车", "油", "停车", "过路费", "机票",
  ],
  Shopping: [
    "shopping", "shopee", "lazada", "zalora", "uniqlo", "zara", "h&m", "ikea", "mr diy", "mrdiy", "daiso",
    "watsons", "sephora", "clothes", "baju", "kasut", "shoes", "gift", "hadiah", "衣服", "购物", "礼物",
  ],
  Electronics: [
    "electronics", "laptop", "phone", "handphone", "iphone", "ipad", "macbook", "samsung", "xiaomi", "huawei",
    "apple", "harvey norman", "senheng", "courts", "charger", "cable", "headphone", "earbuds", "电脑", "手机",
  ],
  Utilities: [
    "tnb", "electric", "electricity", "elektrik", "water", "air selangor", "syabas", "bill", "bil", "unifi",
    "maxis", "celcom", "digi", "umobile", "internet", "wifi", "astro", "rent", "sewa",
    "indah water", "电费", "水费", "网费", "房租",
  ],
  Health: [
    "clinic", "klinik", "doctor", "doktor", "hospital", "pharmacy", "farmasi", "medicine", "ubat", "guardian",
    "caring", "alpro", "dental", "dentist", "gigi", "vitamin", "gym", "医生", "诊所", "药", "医院",
  ],
};

/** Payment words → method, and (for e-wallets / banks) the account name. */
export const PAYMENT_KEYWORDS: { words: string[]; method: PaymentMethod; wallet?: string }[] = [
  { words: ["cash", "tunai", "现金"], method: "CASH" },
  { words: ["tng", "touchngo", "touch n go", "touch'n go", "tnge"], method: "E-WALLET", wallet: "Touch 'n Go eWallet" },
  { words: ["grabpay"], method: "E-WALLET", wallet: "GrabPay" },
  { words: ["boost"], method: "E-WALLET", wallet: "Boost" },
  { words: ["shopeepay", "spaylater"], method: "E-WALLET", wallet: "ShopeePay" },
  { words: ["setel"], method: "E-WALLET", wallet: "Setel" },
  { words: ["bigpay"], method: "E-WALLET", wallet: "BigPay" },
  { words: ["ewallet", "e-wallet", "电子钱包"], method: "E-WALLET" },
  { words: ["duitnow", "qr", "qrpay"], method: "QR PAY" },
  { words: ["transfer", "fpx", "ibg", "banking", "转账"], method: "BANK TRANSFER" },
  { words: ["maybank", "mae"], method: "CARD", wallet: "Maybank" },
  { words: ["cimb"], method: "CARD", wallet: "CIMB" },
  { words: ["public bank", "pbb"], method: "CARD", wallet: "Public Bank" },
  { words: ["rhb"], method: "CARD", wallet: "RHB" },
  { words: ["hong leong", "hlb"], method: "CARD", wallet: "Hong Leong" },
  { words: ["ambank"], method: "CARD", wallet: "AmBank" },
  { words: ["uob"], method: "CARD", wallet: "UOB" },
  { words: ["hsbc"], method: "CARD", wallet: "HSBC" },
  { words: ["card", "kad", "credit", "debit", "visa", "mastercard", "master", "amex", "信用卡"], method: "CARD" },
];

/** Wallet names offered as suggestions before the user has history. */
export const COMMON_WALLETS = [
  "Cash",
  "Touch 'n Go eWallet",
  "GrabPay",
  "Boost",
  "ShopeePay",
  "Maybank",
  "CIMB",
  "Public Bank",
  "RHB",
  "Hong Leong",
];

const isCjk = (s: string) => /[㐀-鿿]/.test(s);

/** Does `text` (lowercased) contain `word` as a whole word (or substring for CJK)? */
export function hasWord(text: string, word: string) {
  if (isCjk(word)) return text.includes(word);
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(text);
}

export function guessCategory(text: string): Category | null {
  const lower = text.toLowerCase();
  let best: { category: Category; length: number } | null = null;
  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS) as [Category, string[]][]) {
    for (const word of words) {
      // Prefer the most specific (longest) match, e.g. "jaya grocer" over "grocer".
      if (hasWord(lower, word) && (!best || word.length > best.length)) best = { category, length: word.length };
    }
  }
  return best?.category ?? null;
}

export function guessPayment(text: string): { method: PaymentMethod; wallet: string } | null {
  const lower = text.toLowerCase();
  let method: PaymentMethod | null = null;
  let wallet = "";
  for (const entry of PAYMENT_KEYWORDS) {
    if (entry.words.some((w) => hasWord(lower, w))) {
      // A named wallet beats a generic word; the first named match wins.
      if (entry.wallet && !wallet) {
        wallet = entry.wallet;
        method = entry.method;
      } else if (!method) {
        method = entry.method;
      }
    }
  }
  return method ? { method, wallet } : null;
}

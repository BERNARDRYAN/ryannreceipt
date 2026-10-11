import { CATEGORY_KEYWORDS, guessCategory, guessPayment, hasWord, PAYMENT_KEYWORDS } from "@/lib/quick-add/keywords";
import type { Category, PAYMENT_METHODS } from "@/lib/validators/receipt-schema";
import { smartTitle } from "@/lib/utils/text";

export type QuickParse = {
  /** Amount spent, or null if none found. */
  amount: number | null;
  /** What it was (item or shop), title-cased. */
  name: string;
  category: Category | null;
  paymentMethod: (typeof PAYMENT_METHODS)[number] | null;
  wallet: string;
  /** YYYY-MM-DD, or null for "today / not given". */
  date: string | null;
  tags: string[];
};

const DAY_MS = 86_400_000;
const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, ahad: 0, mon: 1, monday: 1, isnin: 1, tue: 2, tues: 2, tuesday: 2, selasa: 2,
  wed: 3, wednesday: 3, rabu: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, khamis: 4,
  fri: 5, friday: 5, jumaat: 5, sat: 6, saturday: 6, sabtu: 6,
};

const keyOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);


/**
 * Parse a one-line expense such as `nasi lemak 12.90 tng yesterday #work`.
 * Order-insensitive; anything not recognised becomes the name.
 */
export function parseQuickAdd(input: string, today: string): QuickParse {
  let rest = ` ${input.trim()} `;
  const todayMs = Date.parse(`${today}T00:00:00Z`);

  // #tags
  const tags: string[] = [];
  rest = rest.replace(/#([\p{L}\p{N}_-]{1,24})/gu, (_, tag: string) => {
    if (!tags.includes(tag.toLowerCase())) tags.push(tag.toLowerCase());
    return " ";
  });

  // Dates: explicit d/m(/y), relative words, weekdays.
  let date: string | null = null;
  rest = rest.replace(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/, (match, d: string, m: string, y?: string) => {
    const year = y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : Number(today.slice(0, 4));
    const ms = Date.UTC(year, Number(m) - 1, Number(d));
    if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31 || Number.isNaN(ms)) return match;
    date = keyOf(ms);
    return " ";
  });
  const relative: [RegExp, number][] = [
    [/\b(today|tdy|hari ini)\b|今天/i, 0],
    [/\b(yesterday|ytd|ystd|semalam)\b|昨天/i, 1],
    [/前天/, 2],
  ];
  for (const [re, days] of relative) {
    if (re.test(rest)) {
      date ??= keyOf(todayMs - days * DAY_MS);
      rest = rest.replace(re, " ");
    }
  }
  rest = rest.replace(/\b(\d{1,2})\s*(days?|hari)\s*(ago|lepas|lalu)\b/i, (_, n: string) => {
    date ??= keyOf(todayMs - Number(n) * DAY_MS);
    return " ";
  });
  rest = rest.replace(/\b(?:last\s+)?([a-z]+)\b/gi, (match, word: string) => {
    const wd = WEEKDAYS[word.toLowerCase()];
    if (wd === undefined || date) return match;
    const todayWd = new Date(todayMs).getUTCDay();
    const back = (todayWd - wd + 7) % 7 || 7; // most recent past weekday
    date = keyOf(todayMs - back * DAY_MS);
    return " ";
  });

  // Amount: the last number, optionally with a currency mark (RM12.90, 12.90rm, $5).
  let amount: number | null = null;
  const amountRe = /(?:rm|myr|\$|usd|sgd)?\s?(\d{1,7}(?:[.,]\d{1,2})?)\s?(?:rm|myr|ringgit|块|元)?(?=\s|$)/gi;
  let last: RegExpExecArray | null = null;
  for (let m = amountRe.exec(rest); m; m = amountRe.exec(rest)) last = m;
  if (last) {
    amount = Number(last[1].replace(",", "."));
    rest = rest.slice(0, last.index) + " " + rest.slice(last.index + last[0].length);
  }

  // Payment words are removed from the name once recognised.
  const payment = guessPayment(rest);
  if (payment) {
    const lower = rest.toLowerCase();
    for (const entry of PAYMENT_KEYWORDS) {
      for (const word of entry.words) {
        if (hasWord(lower, word)) rest = rest.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ");
      }
    }
  }
  rest = rest.replace(/\b(paid|pay|bayar|by|with|using|via|guna|on|at|for)\b/gi, " ");

  const name = smartTitle(rest.replace(/\s+/g, " ").trim());
  const category = guessCategory(input);

  return {
    amount,
    name,
    category,
    paymentMethod: payment?.method ?? null,
    wallet: payment?.wallet ?? "",
    date,
    tags,
  };
}

/** Keywords per category, exposed for the UI's "why this category" hint. */
export const KNOWN_CATEGORIES = Object.keys(CATEGORY_KEYWORDS) as Category[];

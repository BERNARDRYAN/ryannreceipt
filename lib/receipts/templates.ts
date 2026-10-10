import { createBlankDraft, DEFAULT_STYLE, localDateTimeNow, newId } from "@/lib/receipts/defaults";
import type { MessageKey } from "@/lib/i18n/messages";
import type { ReceiptDraft, ReceiptLineItem, ReceiptStyle } from "@/lib/validators/receipt-schema";

export type TemplateId = "kopitiam" | "grocery" | "electronics" | "ride" | "hawker" | "blank";

export type ReceiptTemplate = {
  id: TemplateId;
  name: MessageKey;
  description: MessageKey;
  /** Builds a fresh draft (new ids, current date) each time it's used. */
  build: () => ReceiptDraft;
};

const items = (...rows: [string, number, number][]): ReceiptLineItem[] =>
  rows.map(([name, qty, price]) => ({ id: newId(), name, qty, price }));

const style = (overrides: Partial<ReceiptStyle>): ReceiptStyle => ({ ...DEFAULT_STYLE, ...overrides });

/** `YYYY-MM-DD` one year from today (local calendar). */
function oneYearFromToday() {
  const today = localDateTimeNow().slice(0, 10);
  const [y, m, d] = today.split("-");
  return `${Number(y) + 1}-${m}-${d}`;
}

export const TEMPLATES: ReceiptTemplate[] = [
  {
    id: "kopitiam",
    name: "templates.kopitiam",
    description: "templates.kopitiamDesc",
    build: () => ({
      ...createBlankDraft(),
      merchantName: "Ryann Kopitiam",
      merchantAddress: "12 Jalan Bukit Bintang, 55100 Kuala Lumpur",
      merchantPhone: "+60 3-2141 0000",
      category: "Food & Drink",
      taxRate: 6,
      serviceChargeRate: 10,
      amountTendered: 50,
      cashier: "AMIR",
      tableNo: "07",
      orderType: "DINE-IN",
      items: items(["Kopi O Kosong", 2, 2.8], ["Roti Bakar Kaya", 1, 4.5], ["Nasi Lemak Ayam", 1, 12.9]),
    }),
  },
  {
    id: "grocery",
    name: "templates.grocery",
    description: "templates.groceryDesc",
    build: () => ({
      ...createBlankDraft(),
      title: "Tax Invoice",
      merchantName: "Segar Mart",
      merchantAddress: "Lot 3, Jalan SS2/24, 47300 Petaling Jaya",
      merchantPhone: "+60 3-7876 5432",
      category: "Groceries",
      paymentMethod: "CARD",
      roundCash: false,
      cashier: "MEI LING",
      notes: "Thank you for shopping with us!\nGoods sold are not returnable.",
      items: items(
        ["Beras Wangi 5kg", 1, 26.9],
        ["Telur Gred A x30", 1, 13.5],
        ["Susu Segar 1L", 2, 7.65],
        ["Sawi Hijau 500g", 1, 3.2],
        ["Roti Gardenia", 1, 4.3],
      ),
      styleConfig: style({ showQr: true }),
    }),
  },
  {
    id: "electronics",
    name: "templates.electronics",
    description: "templates.electronicsDesc",
    build: () => ({
      ...createBlankDraft(),
      title: "Tax Invoice",
      merchantName: "Volt Electronics",
      merchantAddress: "Level 3, Mid Valley Megamall, 59200 Kuala Lumpur",
      merchantPhone: "+60 3-2287 1100",
      category: "Electronics",
      paymentMethod: "CARD",
      roundCash: false,
      taxRate: 8,
      taxInclusive: true,
      cashier: "DANIEL",
      warrantyUntil: oneYearFromToday(),
      notes: "Keep this receipt for warranty claims.",
      items: items(["Wireless Earbuds Pro", 1, 399], ["USB-C Charger 30W", 1, 79]),
      styleConfig: style({ fontFamily: "typewriter", showQr: true }),
    }),
  },
  {
    id: "ride",
    name: "templates.ride",
    description: "templates.rideDesc",
    build: () => ({
      ...createBlankDraft(),
      title: "Trip Receipt",
      merchantName: "Laju Ride",
      merchantAddress: "KLCC → Bangsar South",
      merchantPhone: "",
      category: "Transport",
      paymentMethod: "E-WALLET",
      roundCash: false,
      notes: "Driver: Azman · WXY 1234\nThanks for riding with us!",
      items: items(["Base fare", 1, 4], ["Distance 7.8 km", 1, 9.36], ["Time 22 min", 1, 3.3], ["Toll", 1, 1.6]),
      styleConfig: style({ fontFamily: "dotmatrix", showBarcode: false, showQr: true }),
    }),
  },
  {
    id: "hawker",
    name: "templates.hawker",
    description: "templates.hawkerDesc",
    build: () => ({
      ...createBlankDraft(),
      title: "Receipt",
      merchantName: "Ah Seng Char Kuey Teow",
      merchantAddress: "Gerai 12, Medan Selera Jalan Alor",
      merchantPhone: "",
      category: "Food & Drink",
      orderType: "TAKEAWAY",
      amountTendered: 20,
      notes: "Terima kasih! 谢谢!",
      items: items(["Char Kuey Teow (Besar)", 1, 9.5], ["Teh Ais", 1, 2.6], ["Telur tambah", 1, 1]),
      styleConfig: style({ paperTheme: "aged", fontFamily: "typewriter", monochromeDither: true }),
    }),
  },
  {
    id: "blank",
    name: "templates.blank",
    description: "templates.blankDesc",
    build: () => createBlankDraft(),
  },
];

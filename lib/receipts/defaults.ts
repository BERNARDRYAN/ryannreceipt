import type { ReceiptDraft, ReceiptStyle } from "@/lib/validators/receipt-schema";

// Shared by the client store and the server BFF, so no "use client" here.

export function newId() {
  return crypto.randomUUID();
}

/** `YYYY-MM-DDTHH:mm` in local time, the format `<input type="datetime-local">` expects. */
export function localDateTimeNow() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const DEFAULT_STYLE: ReceiptStyle = {
  width: "80mm",
  fontFamily: "mono",
  paperTheme: "clean",
  showBarcode: true,
  showQr: false,
  tearEdge: true,
  monochromeDither: false,
  logo: "",
};

export function newSerial() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Fields every draft starts from; `createSampleDraft` layers demo content on top. */
export function createBlankDraft(): ReceiptDraft {
  const serial = newSerial();
  return {
    title: "Sales Receipt",
    merchantName: "",
    merchantAddress: "",
    merchantPhone: "",
    receiptNo: `RR-${serial}`,
    receiptDate: localDateTimeNow(),
    currency: "MYR",
    taxRate: 0,
    taxLabel: "SST",
    taxInclusive: false,
    serviceChargeRate: 0,
    discountAmount: 0,
    roundCash: true,
    amountTendered: 0,
    paymentMethod: "CASH",
    category: "General",
    cashier: "",
    tableNo: "",
    orderType: "",
    notes: "Thank you! Please come again.",
    barcodeData: `RR${serial}`,
    qrData: "",
    warrantyUntil: "",
    items: [{ id: newId(), name: "", qty: 1, price: 0 }],
    styleConfig: DEFAULT_STYLE,
  };
}

export function createSampleDraft(): ReceiptDraft {
  return {
    ...createBlankDraft(),
    merchantName: "Ryann Kopitiam",
    merchantAddress: "12 Jalan Bukit Bintang, 55100 Kuala Lumpur",
    merchantPhone: "+60 3-2141 0000",
    taxRate: 6,
    serviceChargeRate: 10,
    amountTendered: 50,
    category: "Food & Drink",
    cashier: "AMIR",
    tableNo: "07",
    orderType: "DINE-IN",
    items: [
      { id: newId(), name: "Kopi O Kosong", qty: 2, price: 2.8 },
      { id: newId(), name: "Roti Bakar Kaya", qty: 1, price: 4.5 },
      { id: newId(), name: "Nasi Lemak Ayam", qty: 1, price: 12.9 },
    ],
  };
}

/** Fill fields added in later versions from defaults, so old drafts stay valid. */
export function normalizeDraft(draft: Partial<ReceiptDraft>): ReceiptDraft {
  const base = createBlankDraft();
  return {
    ...base,
    ...draft,
    items: draft.items ?? base.items,
    styleConfig: { ...DEFAULT_STYLE, ...draft.styleConfig },
  };
}


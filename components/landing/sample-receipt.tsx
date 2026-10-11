"use client";

import { ReceiptCanvas } from "@/components/receipt/receipt-canvas";
import { DEFAULT_STYLE } from "@/lib/receipts/defaults";
import type { ReceiptDraft } from "@/lib/validators/receipt-schema";

// Fixed content (no random ids or dates) so the landing page prerenders identically.
const SAMPLE: ReceiptDraft = {
  title: "Sales Receipt",
  merchantName: "Ryann Kopitiam",
  merchantAddress: "12 Jalan Bukit Bintang, 55100 Kuala Lumpur",
  merchantPhone: "+60 3-2141 0000",
  receiptNo: "RR-240611",
  receiptDate: "2026-10-11T08:42",
  currency: "MYR",
  taxRate: 6,
  taxLabel: "SST",
  taxInclusive: false,
  serviceChargeRate: 10,
  discountAmount: 0,
  roundCash: true,
  amountTendered: 50,
  paymentMethod: "CASH",
  category: "Food & Drink",
  cashier: "AMIR",
  tableNo: "07",
  orderType: "DINE-IN",
  notes: "Thank you! Please come again.",
  barcodeData: "RR240611",
  qrData: "",
  warrantyUntil: "",
  wallet: "",
  tags: [],
  taxRelief: "",
  hasPhoto: false,
  items: [
    { id: "00000000-0000-4000-8000-000000000001", name: "Kopi O Kosong", qty: 2, price: 2.8 },
    { id: "00000000-0000-4000-8000-000000000002", name: "Roti Bakar Kaya", qty: 1, price: 4.5 },
    { id: "00000000-0000-4000-8000-000000000003", name: "Nasi Lemak Ayam", qty: 1, price: 12.9 },
  ],
  styleConfig: DEFAULT_STYLE,
};

export function SampleReceipt() {
  return (
    <div className="receipt-shadow">
      <ReceiptCanvas draft={SAMPLE} />
    </div>
  );
}

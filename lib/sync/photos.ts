"use client";

import { compressForUpload } from "@/lib/scan/image";

const url = (id: string) => `/api/receipts/${encodeURIComponent(id)}/photo`;

/** Compress and store a receipt photo in the user's private cloud folder. */
export async function uploadReceiptPhoto(id: string, file: Blob) {
  const blob = await compressForUpload(file);
  const res = await fetch(url(id), { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
}

/** Short-lived signed URL for viewing the photo. */
export async function receiptPhotoUrl(id: string): Promise<string | null> {
  const res = await fetch(url(id), { cache: "no-store" });
  if (!res.ok) return null;
  const { url: signed } = (await res.json()) as { url: string };
  return signed;
}

export async function deleteReceiptPhoto(id: string) {
  const res = await fetch(url(id), { method: "DELETE" });
  if (!res.ok) throw new Error(`delete failed (${res.status})`);
}

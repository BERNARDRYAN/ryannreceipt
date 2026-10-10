"use client";

import { toPng } from "html-to-image";

export const PNG_SCALES = [1, 2, 4] as const;
export type PngScale = (typeof PNG_SCALES)[number];

/** Rasterise a DOM node to a PNG data URL at `scale`x pixel density. */
export async function renderNodeToPng(node: HTMLElement, scale: number) {
  // Wait for webfonts so the monospace glyphs are embedded, not fallbacks.
  await document.fonts.ready;
  return toPng(node, { pixelRatio: scale, cacheBust: true });
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
}

export async function downloadNodeAsPng(node: HTMLElement, basename: string, scale: PngScale = 2) {
  const dataUrl = await renderNodeToPng(node, scale);
  triggerDownload(dataUrl, `${basename}@${scale}x.png`);
}

/**
 * Single-page PDF sized to the physical roll: page width is the paper width in
 * mm, page height follows the receipt's aspect ratio. Rendered at 4x for print.
 */
export async function downloadNodeAsPdf(node: HTMLElement, basename: string, paperWidthMm: number) {
  const [{ jsPDF }, dataUrl] = await Promise.all([import("jspdf"), renderNodeToPng(node, 4)]);
  const heightMm = (node.offsetHeight / node.offsetWidth) * paperWidthMm;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [paperWidthMm, heightMm],
    compress: true,
  });
  pdf.addImage(dataUrl, "PNG", 0, 0, paperWidthMm, heightMm, undefined, "FAST");
  pdf.save(`${basename}.pdf`);
}

/** Filesystem-safe export basename, e.g. `ryannreceipt-ryann-kopitiam-rr-123456`. */
export function exportBasename(...parts: string[]) {
  const slug = parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `ryannreceipt-${slug || "receipt"}`;
}

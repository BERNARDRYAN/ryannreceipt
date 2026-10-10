"use client";

import { toBlob, toPng } from "html-to-image";

export const PNG_SCALES = [1, 2, 4] as const;
export type PngScale = (typeof PNG_SCALES)[number];

const renderOptions = (scale: number) => ({ pixelRatio: scale, cacheBust: true });

/** Rasterise a DOM node to a PNG data URL at `scale`x pixel density. */
export async function renderNodeToPng(node: HTMLElement, scale: number) {
  // Wait for webfonts so the receipt glyphs are embedded, not fallbacks.
  await document.fonts.ready;
  return toPng(node, renderOptions(scale));
}

async function renderNodeToBlob(node: HTMLElement, scale: number) {
  await document.fonts.ready;
  const blob = await toBlob(node, renderOptions(scale));
  if (!blob) throw new Error("render failed");
  return blob;
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

export const canCopyImage = () =>
  typeof window !== "undefined" && "ClipboardItem" in window && !!navigator.clipboard?.write;

/** Copy the receipt as a PNG so it can be pasted into chat apps. */
export async function copyNodeAsImage(node: HTMLElement, scale = 2) {
  // Passing a promise keeps Safari's user-activation window open while rendering.
  const item = new ClipboardItem({ "image/png": renderNodeToBlob(node, scale) });
  await navigator.clipboard.write([item]);
}

export function canShareFiles() {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

/** Native share sheet (mobile): resolves false if the user cancelled. */
export async function shareNodeAsImage(node: HTMLElement, basename: string, title: string) {
  const blob = await renderNodeToBlob(node, 3);
  const file = new File([blob], `${basename}.png`, { type: "image/png" });
  try {
    await navigator.share({ files: [file], title });
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return false;
    throw err;
  }
}

/**
 * Print just the receipt on a page exactly the roll's size, so thermal printer
 * drivers feed the right length. See the `@media print` rules in globals.css.
 */
export function printNode(node: HTMLElement, paperWidthMm: number) {
  const heightMm = Math.ceil((node.offsetHeight / node.offsetWidth) * paperWidthMm);
  const style = document.createElement("style");
  style.textContent = `@page { size: ${paperWidthMm}mm ${heightMm}mm; margin: 0; }
@media print { [data-print-root] .receipt-paper { width: ${paperWidthMm}mm !important; } }`;
  document.head.appendChild(style);
  // Mark the wrapper (it carries the on-screen zoom and shadow, reset for print).
  const root = node.parentElement ?? node;
  root.setAttribute("data-print-root", "");
  const cleanup = () => {
    style.remove();
    root.removeAttribute("data-print-root");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
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

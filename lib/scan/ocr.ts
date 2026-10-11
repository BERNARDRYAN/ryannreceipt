"use client";

export type OcrProgress = { stage: "loading" | "reading"; progress: number };

/**
 * Read text from a receipt image entirely in the browser (Tesseract.js, free).
 * The engine and language data come from the jsDelivr CDN on first use and
 * are cached by the browser; the photo itself never leaves the device.
 */
export async function recognizeReceipt(
  image: HTMLCanvasElement,
  { chinese = false, onProgress }: { chinese?: boolean; onProgress?: (p: OcrProgress) => void } = {},
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const langs = chinese ? ["eng", "chi_sim"] : ["eng"];
  const worker = await createWorker(langs, 1, {
    logger: (m: { status: string; progress: number }) => {
      if (!onProgress) return;
      const reading = m.status === "recognizing text";
      onProgress({ stage: reading ? "reading" : "loading", progress: Math.round((m.progress ?? 0) * 100) });
    },
  });
  try {
    // Receipts are a single column of short lines.
    await worker.setParameters({ tessedit_pageseg_mode: "6" as never, preserve_interword_spaces: "1" });
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

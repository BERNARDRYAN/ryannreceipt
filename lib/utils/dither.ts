"use client";

import { MAX_LOGO_LENGTH } from "@/lib/validators/receipt-schema";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
/** Logo width in printer dots: ~ 2/3 of an 80mm head (576 dots) at our 1/2 scale. */
const TARGET_WIDTH = 192;
const MAX_HEIGHT = 128;

export class LogoError extends Error {}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new LogoError("That image couldn't be read."));
    };
    img.src = url;
  });
}

/**
 * Turn any image into a 1-bit thermal-printer logo: scale to the print head,
 * flatten onto white, convert to luminance, and Atkinson-dither (the classic
 * Mac look, which keeps highlights clean). Ink pixels are opaque black; paper
 * pixels are transparent so the paper tint shows through.
 */
export async function ditherLogo(file: File): Promise<string> {
  if (!ACCEPTED.includes(file.type)) throw new LogoError("Use a PNG, JPG, WebP, GIF or SVG image.");
  if (file.size > MAX_INPUT_BYTES) throw new LogoError("That image is larger than 8 MB.");

  const img = await loadImage(file);
  const scale = Math.min(TARGET_WIDTH / img.naturalWidth, MAX_HEIGHT / img.naturalHeight, 1);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new LogoError("Your browser can't process images here.");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const px = image.data;

  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
  }

  // Atkinson: spread 6/8 of the error to six neighbours.
  const spread = [
    [1, 0],
    [2, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
    [0, 2],
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const ink = lum[i] < 128;
      const err = (lum[i] - (ink ? 0 : 255)) / 8;
      for (const [dx, dy] of spread) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < w && ny < h) lum[ny * w + nx] += err;
      }
      px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = 0;
      px[i * 4 + 3] = ink ? 255 : 0;
    }
  }

  ctx.clearRect(0, 0, w, h);
  ctx.putImageData(image, 0, 0);
  const dataUrl = canvas.toDataURL("image/png");
  if (dataUrl.length > MAX_LOGO_LENGTH) throw new LogoError("That logo is too detailed. Try a simpler image.");
  return dataUrl;
}

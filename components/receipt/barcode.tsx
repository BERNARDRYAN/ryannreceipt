"use client";

import JsBarcode from "jsbarcode";
import { useEffect, useRef } from "react";

type BarcodeProps = {
  value: string;
  /** Bar module width in px; the SVG scales down to fit its container. */
  barWidth?: number;
  height?: number;
  color?: string;
  className?: string;
};

/** CODE128 supports ASCII 32–126; anything else is stripped before encoding. */
export function sanitizeBarcodeValue(value: string) {
  return value.replace(/[^\x20-\x7E]/g, "").slice(0, 48);
}

export function Barcode({ value, barWidth = 1.6, height = 48, color = "#1A1A1A", className }: BarcodeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const clean = sanitizeBarcodeValue(value);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !clean) return;
    try {
      JsBarcode(svg, clean, {
        format: "CODE128",
        width: barWidth,
        height,
        margin: 0,
        displayValue: false,
        background: "transparent",
        lineColor: color,
      });
    } catch {
      svg.replaceChildren();
    }
  }, [clean, barWidth, height, color]);

  if (!clean) return null;

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Barcode ${clean}`}
      className={className}
      style={{ display: "block", maxWidth: "100%", height: "auto" }}
    />
  );
}

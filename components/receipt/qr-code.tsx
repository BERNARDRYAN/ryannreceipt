"use client";

import { QRCodeSVG } from "qrcode.react";

type QrCodeProps = {
  value: string;
  size?: number;
  color?: string;
  className?: string;
};

export function QrCode({ value, size = 96, color = "#1A1A1A", className }: QrCodeProps) {
  if (!value) return null;
  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="M"
      marginSize={0}
      bgColor="transparent"
      fgColor={color}
      className={className}
      role="img"
      aria-label="QR code"
    />
  );
}

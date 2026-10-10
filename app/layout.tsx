import type { Metadata, Viewport } from "next";
import { Courier_Prime, Doto, Geist, Space_Mono } from "next/font/google";

import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { Toaster } from "@/components/ui/toaster";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const doto = Doto({
  variable: "--font-doto",
  subsets: ["latin"],
  weight: ["700", "900"],
});

export const metadata: Metadata = {
  title: {
    default: "RyannReceipt",
    template: "%s · RyannReceipt",
  },
  description: "Retro thermal-receipt generator and expense & warranty tracker. Part of the Ryann Suite.",
  applicationName: "RyannReceipt",
  appleWebApp: { capable: true, title: "RyannReceipt", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#141412" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${spaceMono.variable} ${courierPrime.variable} ${doto.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}

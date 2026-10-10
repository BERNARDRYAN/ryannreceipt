import type { Metadata, Viewport } from "next";
import { Courier_Prime, Doto, Geist, Instrument_Serif, Space_Mono } from "next/font/google";

import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { Toaster } from "@/components/ui/toaster";
import { PrefsSync, themeBootScript } from "@/lib/store/prefs-store";

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

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const doto = Doto({
  variable: "--font-doto",
  subsets: ["latin"],
  weight: ["700", "900"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    siteName: "RyannReceipt",
    title: "RyannReceipt",
    description: "Retro thermal receipts, expenses and warranty reminders. Part of the Ryann Suite.",
  },
  twitter: { card: "summary_large_image" },
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
    <html
      lang="en"
      // data-theme is set by the boot script before React hydrates.
      suppressHydrationWarning
      className={`${geistSans.variable} ${spaceMono.variable} ${courierPrime.variable} ${doto.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
        <RegisterServiceWorker />
        <PrefsSync />
      </body>
    </html>
  );
}

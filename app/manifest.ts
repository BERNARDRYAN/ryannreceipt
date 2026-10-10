import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RyannReceipt",
    short_name: "Receipt",
    description: "Retro thermal-receipt generator and expense & warranty tracker. Part of the Ryann Suite.",
    start_url: "/studio",
    scope: "/",
    display: "standalone",
    background_color: "#f3f1ec",
    theme_color: "#1c1b19",
    categories: ["finance", "productivity", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New receipt", url: "/studio", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "History & warranties", url: "/history", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

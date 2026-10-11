import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RyannReceipt",
    short_name: "Receipt",
    description: "Expense tracker with one-tap logging, budgets, split bills and printed-style receipts. Part of the Ryann Suite.",
    start_url: "/history",
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
    // Share a receipt photo from the gallery straight into the scanner.
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: { files: [{ name: "receipt", accept: ["image/*"] }] },
    },
    shortcuts: [
      { name: "Add expense", url: "/history?add=1", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Receipt maker", url: "/studio", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

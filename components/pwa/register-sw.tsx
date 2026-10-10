"use client";

import { useEffect } from "react";

/** Register the offline service worker in production builds only. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Offline support is a progressive enhancement; ignore failures.
    });
  }, []);
  return null;
}

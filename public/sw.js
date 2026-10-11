/* RyannReceipt service worker: offline studio & history (local-first). */

const VERSION = "rr-v2";
const SHARE_CACHE = "rr-share";
const SHARED_FILE_PATH = "/__shared-receipt";
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const APP_SHELL = ["/", "/studio", "/history"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION) && k !== SHARE_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Web Share Target: stash the shared photo and open the scanner.
  if (request.method === "POST" && url.origin === self.location.origin && url.pathname === "/share-target") {
    event.respondWith(
      (async () => {
        try {
          const form = await request.formData();
          const file = form.get("receipt");
          if (file && typeof file !== "string" && file.size <= 15 * 1024 * 1024) {
            const cache = await caches.open(SHARE_CACHE);
            await cache.put(SHARED_FILE_PATH, new Response(file, { headers: { "Content-Type": file.type } }));
          }
        } catch {
          // Fall through to the scanner with no file.
        }
        return Response.redirect("/studio?scan=shared", 303);
      })(),
    );
    return;
  }

  if (request.method !== "GET") return;

  // Only same-origin; never cache the BFF (private data, auth) or Google sign-in.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Hashed build assets and fonts never change: cache-first.
  if (url.pathname.startsWith("/_next/static/") || /\/icon[^/]*\.png$/.test(url.pathname)) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Pages: network-first so deploys show up immediately; cache as offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && APP_SHELL.includes(url.pathname)) {
            const copy = res.clone();
            caches.open(PAGES).then((cache) => cache.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(PAGES);
          return (await cache.match(url.pathname)) || (await cache.match("/studio")) || Response.error();
        }),
    );
  }
});

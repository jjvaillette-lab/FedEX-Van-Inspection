/* Last Mile Assist — driver app offline shell.
 * Caches the driver hub, the inspection flow, their assets, and the latest
 * checklist so the app opens and runs without signal. Submissions made
 * offline are queued in IndexedDB by the page (lib/offline.ts) — this worker
 * only handles GET requests.
 */
const CACHE = "lma-driver-v1";
const SHELL = ["/driver", "/inspection"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Checklist + settings: freshest wins, cached copy keeps offline working.
  if (url.pathname === "/api/questions") {
    event.respondWith(networkFirst(req));
    return;
  }
  // Other APIs are live-only (trip detection handles its own offline fallback).
  if (url.pathname.startsWith("/api/")) return;

  // App pages: network first, cached shell offline.
  if (req.mode === "navigate") {
    if (url.pathname === "/driver" || url.pathname === "/inspection") {
      event.respondWith(networkFirst(req));
    }
    return;
  }

  // Static assets (JS/CSS chunks, silhouettes, icons): cache first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/silhouettes/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".webmanifest")
  ) {
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
    if (hit) return hit;
    throw new Error("offline");
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}
